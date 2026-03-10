import mysql from "mysql2/promise";
import { randomUUID } from "crypto";

const {
  DB_HOST = "localhost",
  DB_PORT = "3306",
  DB_USER = "root",
  DB_PASSWORD = "N1mp3dr0j0",
  DB_NAME = "soccertag",
} = process.env;

export const pool = mysql.createPool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  connectionLimit: 10,
});

async function columnExists(
  conn: mysql.PoolConnection,
  table: string,
  column: string
) {
  const [rows] = await conn.query(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [table, column]
  );
  return (rows as any[]).length > 0;
}

async function constraintExists(
  conn: mysql.PoolConnection,
  table: string,
  constraint: string
) {
  const [rows] = await conn.query(
    `
      SELECT 1
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND CONSTRAINT_NAME = ?
      LIMIT 1
    `,
    [table, constraint]
  );
  return (rows as any[]).length > 0;
}

export async function runMigrations() {
  const conn = await pool.getConnection();
  try {
    // --- Core auth / ownership ---
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        team_name VARCHAR(255) NULL,
        created_at DATETIME NOT NULL
      )
    `);

    // --- Catalog tables (analytics model) ---
    await conn.query(`
      CREATE TABLE IF NOT EXISTS seasons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        start_date DATE NULL,
        end_date DATE NULL,
        created_at DATETIME NOT NULL
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(64) NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        created_at DATETIME NOT NULL
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS players (
        id INT AUTO_INCREMENT PRIMARY KEY,
        team_id INT NOT NULL,
        number INT NULL,
        name VARCHAR(255) NULL,
        created_at DATETIME NOT NULL,
        CONSTRAINT fk_players_team
          FOREIGN KEY (team_id) REFERENCES teams(id)
          ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS event_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        created_at DATETIME NOT NULL
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS zones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        created_at DATETIME NOT NULL
      )
    `);

    // --- Matches and events (existing) ---
    await conn.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        match_id VARCHAR(64) NOT NULL UNIQUE,
        created_at DATETIME NOT NULL,
        home_team VARCHAR(255) NOT NULL,
        away_team VARCHAR(255) NOT NULL
      )
    `);

    // FASE 0: extensiones de matches (idempotentes)
    if (!(await columnExists(conn, "matches", "season_id"))) {
      await conn.query(`ALTER TABLE matches ADD COLUMN season_id INT NULL`);
    }
    if (!(await columnExists(conn, "matches", "date"))) {
      await conn.query(`ALTER TABLE matches ADD COLUMN date DATE NULL`);
    }
    if (!(await columnExists(conn, "matches", "venue"))) {
      await conn.query(`ALTER TABLE matches ADD COLUMN venue VARCHAR(255) NULL`);
    }
    if (!(await columnExists(conn, "matches", "round"))) {
      await conn.query(`ALTER TABLE matches ADD COLUMN round VARCHAR(64) NULL`);
    }
    if (!(await columnExists(conn, "matches", "home_team_id"))) {
      await conn.query(`ALTER TABLE matches ADD COLUMN home_team_id INT NULL`);
    }
    if (!(await columnExists(conn, "matches", "away_team_id"))) {
      await conn.query(`ALTER TABLE matches ADD COLUMN away_team_id INT NULL`);
    }
    if (!(await columnExists(conn, "matches", "notes"))) {
      await conn.query(`ALTER TABLE matches ADD COLUMN notes TEXT NULL`);
    }
    if (!(await columnExists(conn, "matches", "home_goals"))) {
      await conn.query(
        `ALTER TABLE matches ADD COLUMN home_goals INT NOT NULL DEFAULT 0`
      );
    }
    if (!(await columnExists(conn, "matches", "away_goals"))) {
      await conn.query(
        `ALTER TABLE matches ADD COLUMN away_goals INT NOT NULL DEFAULT 0`
      );
    }
    if (!(await constraintExists(conn, "matches", "fk_matches_season"))) {
      await conn.query(
        `ALTER TABLE matches ADD CONSTRAINT fk_matches_season FOREIGN KEY (season_id) REFERENCES seasons(id)`
      );
    }
    if (!(await constraintExists(conn, "matches", "fk_matches_home_team"))) {
      await conn.query(
        `ALTER TABLE matches ADD CONSTRAINT fk_matches_home_team FOREIGN KEY (home_team_id) REFERENCES teams(id)`
      );
    }
    if (!(await constraintExists(conn, "matches", "fk_matches_away_team"))) {
      await conn.query(
        `ALTER TABLE matches ADD CONSTRAINT fk_matches_away_team FOREIGN KEY (away_team_id) REFERENCES teams(id)`
      );
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        match_id VARCHAR(64) NOT NULL,
        period VARCHAR(4) NOT NULL,
        t_match_ms INT NOT NULL,
        t_wall DATETIME NOT NULL,
        selections TEXT NOT NULL,
        notes TEXT NULL,
        created_at DATETIME NOT NULL,
        INDEX idx_match_created (match_id, created_at)
      )
    `);

    // FASE 0B: tabla de hechos normalizada para analytics
    await conn.query(`
      CREATE TABLE IF NOT EXISTS fact_events (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        source_event_id INT NOT NULL,
        match_id VARCHAR(64) NOT NULL,
        period VARCHAR(4) NOT NULL,
        minute INT NULL,
        t_match_ms INT NOT NULL,
        t_wall DATETIME NOT NULL,
        event_type_id INT NULL,
        team_id INT NULL,
        player_id INT NULL,
        zone_id INT NULL,
        notes TEXT NULL,
        created_at DATETIME NOT NULL,
        UNIQUE KEY uq_fact_events_source (source_event_id),
        INDEX idx_fact_events_match (match_id),
        INDEX idx_fact_events_match_period_minute (match_id, period, minute),
        INDEX idx_fact_events_team (team_id),
        INDEX idx_fact_events_player (player_id),
        INDEX idx_fact_events_zone (zone_id),
        CONSTRAINT fk_fact_events_event_type
          FOREIGN KEY (event_type_id) REFERENCES event_types(id),
        CONSTRAINT fk_fact_events_team
          FOREIGN KEY (team_id) REFERENCES teams(id),
        CONSTRAINT fk_fact_events_player
          FOREIGN KEY (player_id) REFERENCES players(id),
        CONSTRAINT fk_fact_events_zone
          FOREIGN KEY (zone_id) REFERENCES zones(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS match_lineups (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        match_id VARCHAR(64) NOT NULL,
        team_id INT NOT NULL,
        player_id INT NOT NULL,
        minute_in INT NULL,
        minute_out INT NULL,
        created_at DATETIME NOT NULL,
        INDEX idx_match_lineups_match_team_player (match_id, team_id, player_id),
        CONSTRAINT fk_match_lineups_team
          FOREIGN KEY (team_id) REFERENCES teams(id),
        CONSTRAINT fk_match_lineups_player
          FOREIGN KEY (player_id) REFERENCES players(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS lineup_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        team_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        is_default TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL,
        CONSTRAINT fk_lineup_templates_team
          FOREIGN KEY (team_id) REFERENCES teams(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS lineup_template_players (
        id INT AUTO_INCREMENT PRIMARY KEY,
        template_id INT NOT NULL,
        player_id INT NOT NULL,
        is_starter TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL,
        CONSTRAINT fk_ltpl_template
          FOREIGN KEY (template_id) REFERENCES lineup_templates(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_ltpl_player
          FOREIGN KEY (player_id) REFERENCES players(id)
      )
    `);

    // Seeds mínimos para catálogos (idempotentes, usando INSERT IGNORE)
    const now = new Date();

    // Event types basados en los botones actuales del tablero
    await conn.query(
      `
        INSERT IGNORE INTO event_types (code, name, created_at)
        VALUES
          ('GOAL', 'Gol', ?),
          ('SHOT_OFF', 'Tiro fuera', ?),
          ('SHOT_ON', 'Tiro a puerta', ?),
          ('FOUL', 'Falta', ?),
          ('YELLOW_CARD', 'Tarjeta amarilla', ?),
          ('RED_CARD', 'Tarjeta roja', ?),
          ('SUBSTITUTION', 'Cambio', ?)
      `,
      [now, now, now, now, now, now, now]
    );

    // Zones 1-12 según la UI actual
    const zoneValues: [string, string, Date][] = [];
    for (let i = 1; i <= 12; i++) {
      zoneValues.push([String(i), `Zona ${i}`, now]);
    }
    await conn.query(
      `
        INSERT IGNORE INTO zones (code, name, created_at)
        VALUES ${zoneValues.map(() => "(?, ?, ?)").join(", ")}
      `,
      zoneValues.flat()
    );
  } finally {
    conn.release();
  }
}

export function newMatchId() {
  return randomUUID();
}
