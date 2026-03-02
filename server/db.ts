import mysql from "mysql2/promise";
import { randomUUID } from "crypto";

const {
  DB_HOST = "localhost",
  DB_PORT = "3306",
  DB_USER = "root",
  DB_PASSWORD = "",
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

export async function runMigrations() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        match_id VARCHAR(64) NOT NULL UNIQUE,
        created_at DATETIME NOT NULL,
        home_team VARCHAR(255) NOT NULL,
        away_team VARCHAR(255) NOT NULL
      )
    `);

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
  } finally {
    conn.release();
  }
}

export function newMatchId() {
  return randomUUID();
}

