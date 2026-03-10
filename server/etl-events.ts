import "dotenv/config";
import { pool } from "./db.js";

type ETLParams = {
  matchId?: string;
  since?: string;
};

function minuteFromMs(ms: number | null): number | null {
  if (ms == null) return null;
  if (ms < 0) return null;
  return Math.floor(ms / 60000);
}

async function resolveOrCreateTeamId(matchId: string, rawTeam: string | undefined | null): Promise<number | null> {
  if (!rawTeam) return null;

  // En la UI actual esperamos "propio" o "rival" como equipo
  const [matchRows] = await pool.query(
    "SELECT home_team, away_team FROM matches WHERE match_id = ?",
    [matchId]
  );
  const matchRow = (matchRows as any[])[0];
  if (!matchRow) return null;

  let teamName: string | null = null;
  if (rawTeam === "propio") {
    teamName = matchRow.home_team;
  } else if (rawTeam === "rival") {
    teamName = matchRow.away_team;
  } else {
    teamName = rawTeam;
  }
  if (!teamName) return null;

  const now = new Date();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.query("SELECT id FROM teams WHERE name = ? FOR UPDATE", [
      teamName,
    ]);
    const ex = (existing as any[])[0];
    if (ex) {
      await conn.commit();
      return ex.id as number;
    }

    const [result] = await conn.query(
      "INSERT INTO teams (name, created_at) VALUES (?, ?)",
      [teamName, now]
    );
    const insertId = (result as any).insertId as number;
    await conn.commit();
    return insertId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function resolvePlayerId(teamId: number | null, playerNumber: string | undefined | null): Promise<number | null> {
  if (!teamId || !playerNumber) return null;
  const num = Number(playerNumber);
  if (!Number.isFinite(num)) return null;

  const [rows] = await pool.query(
    "SELECT id FROM players WHERE team_id = ? AND number = ?",
    [teamId, num]
  );
  const row = (rows as any[])[0];
  if (!row) return null;
  return row.id as number;
}

async function resolveEventTypeId(eventName: string | undefined | null): Promise<number | null> {
  if (!eventName) return null;
  const [rows] = await pool.query(
    "SELECT id FROM event_types WHERE name = ?",
    [eventName]
  );
  const row = (rows as any[])[0];
  if (!row) return null;
  return row.id as number;
}

async function resolveZoneId(zoneCode: string | undefined | null): Promise<number | null> {
  if (!zoneCode) return null;
  const [rows] = await pool.query(
    "SELECT id FROM zones WHERE code = ?",
    [zoneCode]
  );
  const row = (rows as any[])[0];
  if (!row) return null;
  return row.id as number;
}

export async function runEventsETL(params: ETLParams = {}) {
  const { matchId, since } = params;

  const whereClauses: string[] = [];
  const whereParams: any[] = [];
  if (matchId) {
    whereClauses.push("e.match_id = ?");
    whereParams.push(matchId);
  }
  if (since) {
    whereClauses.push("e.created_at >= ?");
    whereParams.push(since);
  }

  const whereSql =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `
      SELECT
        e.id,
        e.match_id,
        e.period,
        e.t_match_ms,
        e.t_wall,
        e.selections,
        e.notes,
        e.created_at
      FROM events e
      LEFT JOIN fact_events f
        ON f.source_event_id = e.id
      ${whereSql}
        AND f.id IS NULL
      ORDER BY e.created_at ASC
    `,
    whereParams
  );

  const events = rows as any[];
  if (events.length === 0) {
    console.log("[etl:events] No hay eventos nuevos para procesar");
    return;
  }

  for (const e of events) {
    let selections: Record<string, string[]> = {};
    try {
      selections = JSON.parse(e.selections || "{}");
    } catch (err) {
      console.warn(
        `[etl:events] No se pudo parsear selections JSON para event_id=${e.id}:`,
        err
      );
      selections = {};
    }

    const evento = Array.isArray(selections.evento) ? selections.evento[0] : undefined;
    const equipo = Array.isArray(selections.equipo) ? selections.equipo[0] : undefined;
    const jugador = Array.isArray(selections.jugador) ? selections.jugador[0] : undefined;
    const zona = Array.isArray(selections.zona) ? selections.zona[0] : undefined;

    const [eventTypeId, teamId, zoneIdPromise] = await Promise.all([
      resolveEventTypeId(evento),
      resolveOrCreateTeamId(e.match_id, equipo),
      resolveZoneId(zona),
    ]);

    const playerId = await resolvePlayerId(teamId, jugador);
    const zoneId = await zoneIdPromise;

    const minute = minuteFromMs(e.t_match_ms);

    if (!eventTypeId) {
      console.warn(
        `[etl:events] WARNING: no se resolvió event_type para event_id=${e.id} evento="${evento}"`
      );
    }
    if (!teamId) {
      console.warn(
        `[etl:events] WARNING: no se resolvió team para event_id=${e.id} equipo="${equipo}"`
      );
    }
    if (jugador && !playerId) {
      console.warn(
        `[etl:events] WARNING: no se resolvió player para event_id=${e.id} dorsal="${jugador}" equipoId=${teamId}`
      );
    }
    if (zona && !zoneId) {
      console.warn(
        `[etl:events] WARNING: no se resolvió zone para event_id=${e.id} zona="${zona}"`
      );
    }

    await pool.query(
      `
        INSERT IGNORE INTO fact_events (
          source_event_id,
          match_id,
          period,
          minute,
          t_match_ms,
          t_wall,
          event_type_id,
          team_id,
          player_id,
          zone_id,
          notes,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        e.id,
        e.match_id,
        e.period,
        minute,
        e.t_match_ms,
        e.t_wall,
        eventTypeId ?? null,
        teamId ?? null,
        playerId ?? null,
        zoneId ?? null,
        e.notes ?? null,
        new Date(),
      ]
    );
  }

  console.log(`[etl:events] Procesados ${events.length} eventos a fact_events`);
}

// Permitir ejecución directa vía node
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  let matchIdArg: string | undefined;
  let sinceArg: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--matchId" && args[i + 1]) {
      matchIdArg = args[i + 1];
      i++;
    } else if (arg === "--since" && args[i + 1]) {
      sinceArg = args[i + 1];
      i++;
    }
  }

  const { runMigrations } = await import("./db.js");

  (async () => {
    await runMigrations();
    await runEventsETL({ matchId: matchIdArg, since: sinceArg });
    process.exit(0);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
