import { FastifyInstance } from "fastify";
import { pool, newMatchId } from "../db";

export async function registerAppRoutes(app: FastifyInstance) {
  app.post<{
    Body: { home: string; away: string };
  }>("/api/matches", async (request, reply) => {
    const { home, away } = request.body;
    if (!home || !away) {
      return reply.code(400).send({ error: "home and away are required" });
    }
    const matchId = newMatchId();
    const now = new Date();
    await pool.query(
      "INSERT INTO matches (match_id, created_at, home_team, away_team) VALUES (?, ?, ?, ?)",
      [matchId, now, home, away]
    );
    return { matchId };
  });

  app.post<{
    Body: {
      matchId: string;
      period: "1T" | "2T";
      tMatchMs: number;
      selections: Record<string, string[]>;
      notes?: string;
    };
  }>("/api/events", async (request, reply) => {
    const { matchId, period, tMatchMs, selections, notes } = request.body;
    if (!matchId) {
      return reply.code(400).send({ error: "matchId is required" });
    }
    const now = new Date();
    await pool.query(
      "INSERT INTO events (match_id, period, t_match_ms, t_wall, selections, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [matchId, period, tMatchMs, now, JSON.stringify(selections), notes ?? null, now]
    );
    return { ok: true };
  });

  app.delete<{
    Querystring: { matchId: string };
  }>("/api/events/last", async (request, reply) => {
    const { matchId } = request.query;
    if (!matchId) {
      return reply.code(400).send({ error: "matchId is required" });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(
        "SELECT id FROM events WHERE match_id = ? ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
        [matchId]
      );
      const row = (rows as any[])[0];
      if (!row) {
        await conn.rollback();
        return reply.code(404).send({ error: "No events to undo" });
      }
      await conn.query("DELETE FROM events WHERE id = ?", [row.id]);
      await conn.commit();
      return { ok: true };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  });

  app.get<{
    Params: { id: string };
  }>("/api/matches/:id/export", async (request, reply) => {
    const matchId = request.params.id;
    const [matches] = await pool.query(
      "SELECT match_id, created_at, home_team, away_team FROM matches WHERE match_id = ?",
      [matchId]
    );
    const matchRow = (matches as any[])[0];
    if (!matchRow) {
      return reply.code(404).send({ error: "Match not found" });
    }

    const [events] = await pool.query(
      "SELECT period, t_match_ms as tMatchMs, t_wall as tWall, selections, notes FROM events WHERE match_id = ? ORDER BY created_at ASC",
      [matchId]
    );

    const meta = {
      matchId: matchRow.match_id,
      createdAt: matchRow.created_at,
      teams: { home: matchRow.home_team, away: matchRow.away_team },
      configVersion: 1,
    };

    const mappedEvents = (events as any[]).map((e) => ({
      matchId: matchRow.match_id,
      period: e.period,
      tMatchMs: e.tMatchMs,
      tWall: e.tWall,
      selections: JSON.parse(e.selections),
      notes: e.notes ?? undefined,
    }));

    return { meta, events: mappedEvents };
  });
}

