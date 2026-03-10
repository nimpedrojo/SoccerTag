import { FastifyInstance } from "fastify";
import { pool, newMatchId } from "../db.js";

export async function registerAppRoutes(app: FastifyInstance) {
  // --- User / team management ---
  app.post<{
    Body: { username: string; password: string; teamName?: string };
  }>("/api/register", async (request, reply) => {
    const { username, password, teamName } = request.body;
    if (!username || !password) {
      return reply.code(400).send({ error: "username and password are required" });
    }

    const [rows] = await pool.query("SELECT id FROM users WHERE username = ?", [
      username,
    ]);
    if ((rows as any[]).length > 0) {
      return reply.code(409).send({ error: "username already exists" });
    }

    const now = new Date();
    const [result] = await pool.query(
      "INSERT INTO users (username, password, team_name, created_at) VALUES (?, ?, ?, ?)",
      [username, password, teamName ?? null, now]
    );

    const insertId = (result as any).insertId as number;
    return { userId: insertId, username, teamName: teamName ?? null };
  });

  // --- Catálogos (Fase 0) ---
  app.get("/catalog/event-types", async () => {
    const [rows] = await pool.query(
      "SELECT id, code, name FROM event_types ORDER BY id ASC"
    );
    return rows;
  });

  app.get("/catalog/zones", async () => {
    const [rows] = await pool.query(
      "SELECT id, code, name FROM zones ORDER BY CAST(code AS UNSIGNED), code"
    );
    return rows;
  });

  app.get("/catalog/teams", async () => {
    const [rows] = await pool.query(
      "SELECT id, code, name FROM teams ORDER BY name ASC"
    );
    return rows;
  });

  app.get("/catalog/seasons", async () => {
    const [rows] = await pool.query(
      "SELECT id, code, name, start_date as startDate, end_date as endDate FROM seasons ORDER BY start_date DESC, id DESC"
    );
    return rows;
  });

  app.get<{
    Querystring: { teamId?: string };
  }>("/catalog/players", async (request, reply) => {
    const { teamId } = request.query;
    if (!teamId) {
      return reply.code(400).send({ error: "teamId is required" });
    }
    const [rows] = await pool.query(
      "SELECT id, team_id as teamId, number, name FROM players WHERE team_id = ? ORDER BY number ASC, name ASC",
      [teamId]
    );
    return rows;
  });

  app.post<{
    Params: { matchId: string };
    Body: {
      teamId: number;
      outPlayerId: number;
      inPlayerId: number;
      tMatchMs: number;
      period: "1T" | "2T";
    };
  }>("/api/matches/:matchId/substitution", async (request, reply) => {
    const { matchId } = request.params;
    const { teamId, outPlayerId, inPlayerId, tMatchMs } = request.body;
    if (!teamId || !outPlayerId || !inPlayerId) {
      return reply
        .code(400)
        .send({ error: "teamId, outPlayerId and inPlayerId are required" });
    }
    const minute = Math.floor(tMatchMs / 60000);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [outRows] = await conn.query(
        `
          SELECT id FROM match_lineups
          WHERE match_id = ? AND team_id = ? AND player_id = ? AND minute_in IS NOT NULL AND minute_out IS NULL
          FOR UPDATE
        `,
        [matchId, teamId, outPlayerId]
      );
      const outRow = (outRows as any[])[0];
      if (!outRow) {
        await conn.rollback();
        return reply
          .code(400)
          .send({ error: "outPlayer is not currently on the field" });
      }

      const [inRows] = await conn.query(
        `
          SELECT id FROM match_lineups
          WHERE match_id = ? AND team_id = ? AND player_id = ? AND minute_in IS NULL
          FOR UPDATE
        `,
        [matchId, teamId, inPlayerId]
      );
      const inRow = (inRows as any[])[0];
      if (!inRow) {
        await conn.rollback();
        return reply
          .code(400)
          .send({ error: "inPlayer is not available on the bench" });
      }

      await conn.query(
        "UPDATE match_lineups SET minute_out = ? WHERE id = ?",
        [minute, outRow.id]
      );
      await conn.query(
        "UPDATE match_lineups SET minute_in = ? WHERE id = ?",
        [minute, inRow.id]
      );

      await conn.commit();
      return { ok: true };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  });

  app.post<{
    Body: { username: string; password: string };
  }>("/api/login", async (request, reply) => {
    const { username, password } = request.body;
    if (!username || !password) {
      return reply.code(400).send({ error: "username and password are required" });
    }

    const [rows] = await pool.query(
      "SELECT id, password, team_name FROM users WHERE username = ?",
      [username]
    );
    const row = (rows as any[])[0];
    if (!row || row.password !== password) {
      return reply.code(401).send({ error: "invalid credentials" });
    }

    return {
      userId: row.id,
      username,
      teamName: row.team_name ?? null,
    };
  });

  app.post<{
    Body: { userId: number; teamName: string };
  }>("/api/user/team", async (request, reply) => {
    const { userId, teamName } = request.body;
    if (!userId || !teamName) {
      return reply
        .code(400)
        .send({ error: "userId and teamName are required" });
    }

    await pool.query("UPDATE users SET team_name = ? WHERE id = ?", [
      teamName,
      userId,
    ]);
    return { ok: true };
  });

  // --- Plantillas de alineación ---
  app.get<{
    Querystring: { teamId?: string };
  }>("/api/lineup-templates", async (request, reply) => {
    const { teamId } = request.query;
    if (!teamId) {
      return reply.code(400).send({ error: "teamId is required" });
    }
    const [rows] = await pool.query(
      "SELECT id, team_id as teamId, name, is_default as isDefault FROM lineup_templates WHERE team_id = ? ORDER BY is_default DESC, created_at DESC",
      [teamId]
    );
    return rows;
  });

  app.get<{
    Params: { id: string };
  }>("/api/lineup-templates/:id", async (request, reply) => {
    const templateId = request.params.id;
    const [tplRows] = await pool.query(
      "SELECT id, team_id as teamId, name, is_default as isDefault FROM lineup_templates WHERE id = ?",
      [templateId]
    );
    const tpl = (tplRows as any[])[0];
    if (!tpl) {
      return reply.code(404).send({ error: "Template not found" });
    }
    const [players] = await pool.query(
      `SELECT ltp.id, ltp.player_id as playerId, ltp.is_starter as isStarter,
              p.number, p.name
       FROM lineup_template_players ltp
       JOIN players p ON p.id = ltp.player_id
       WHERE ltp.template_id = ?
       ORDER BY ltp.is_starter DESC, p.number ASC, p.name ASC`,
      [templateId]
    );
    return { ...tpl, players };
  });

  app.post<{
    Body: {
      teamId: number;
      name: string;
      isDefault?: boolean;
      players: { playerId: number; isStarter: boolean }[];
    };
  }>("/api/lineup-templates", async (request, reply) => {
    const { teamId, name, isDefault, players } = request.body;
    if (!teamId || !name || !Array.isArray(players)) {
      return reply.code(400).send({ error: "teamId, name and players are required" });
    }

    const now = new Date();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [tplResult] = await conn.query(
        "INSERT INTO lineup_templates (team_id, name, is_default, created_at) VALUES (?, ?, ?, ?)",
        [teamId, name, isDefault ? 1 : 0, now]
      );
      const templateId = (tplResult as any).insertId as number;

      const values: any[] = [];
      for (const p of players) {
        values.push(templateId, p.playerId, p.isStarter ? 1 : 0, now);
      }
      if (values.length > 0) {
        await conn.query(
          `
            INSERT INTO lineup_template_players (template_id, player_id, is_starter, created_at)
            VALUES ${players.map(() => "(?, ?, ?, ?)").join(", ")}
          `,
          values
        );
      }

      if (isDefault) {
        await conn.query(
          "UPDATE lineup_templates SET is_default = 0 WHERE team_id = ? AND id <> ?",
          [teamId, templateId]
        );
      }

      await conn.commit();
      return { id: templateId };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  });

  app.post<{
    Params: { id: string };
    Body: { teamId: number };
  }>("/api/lineup-templates/:id/set-default", async (request, reply) => {
    const templateId = Number(request.params.id);
    const { teamId } = request.body;
    if (!teamId || !templateId) {
      return reply.code(400).send({ error: "teamId is required" });
    }
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        "UPDATE lineup_templates SET is_default = 0 WHERE team_id = ?",
        [teamId]
      );
      await conn.query(
        "UPDATE lineup_templates SET is_default = 1 WHERE id = ? AND team_id = ?",
        [templateId, teamId]
      );
      await conn.commit();
      return { ok: true };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  });

  // --- Match and events ---
  app.post<{
    Body: {
      home: string;
      away: string;
      playsAs?: "home" | "away";
      seasonId?: number | null;
      date?: string | null;
      venue?: string | null;
      round?: string | null;
      teamId?: number | null;
      opponentName?: string | null;
      lineup?: { playerId: number; isStarter: boolean }[];
    };
  }>("/api/matches", async (request, reply) => {
    const {
      home,
      away,
      playsAs,
      seasonId,
      date,
      venue,
      round,
      teamId,
      opponentName,
      lineup,
    } = request.body;
    if (!home || !away) {
      return reply.code(400).send({ error: "home and away are required" });
    }
    const matchId = newMatchId();
    const now = new Date();

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const isHome = playsAs === "home";
      const homeTeamName = isHome ? home : away;
      const awayTeamName = isHome ? away : home;

      let homeTeamId: number | null = null;
      let awayTeamId: number | null = null;

      if (teamId) {
        if (isHome) {
          homeTeamId = teamId;
        } else {
          awayTeamId = teamId;
        }
      }

      await conn.query(
        `
          INSERT INTO matches (
            match_id,
            created_at,
            home_team,
            away_team,
            season_id,
            date,
            venue,
            round,
            home_team_id,
            away_team_id,
            notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          matchId,
          now,
          homeTeamName,
          awayTeamName,
          seasonId ?? null,
          date ?? null,
          venue ?? null,
          round ?? null,
          homeTeamId,
          awayTeamId,
          opponentName ?? null,
        ]
      );

      if (Array.isArray(lineup) && teamId) {
        for (const p of lineup) {
          const minuteIn = p.isStarter ? 0 : null;
          await conn.query(
            `
              INSERT INTO match_lineups (
                match_id,
                team_id,
                player_id,
                minute_in,
                minute_out,
                created_at
              ) VALUES (?, ?, ?, ?, NULL, ?)
            `,
            [matchId, teamId, p.playerId, minuteIn, now]
          );
        }
      }

      await conn.commit();
      return { matchId };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
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
    const evento = Array.isArray(selections?.evento)
      ? selections.evento[0]
      : undefined;
    const equipo = Array.isArray(selections?.equipo)
      ? selections.equipo[0]
      : undefined;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        "INSERT INTO events (match_id, period, t_match_ms, t_wall, selections, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          matchId,
          period,
          tMatchMs,
          now,
          JSON.stringify(selections),
          notes ?? null,
          now,
        ]
      );

      // Actualización de marcador básica: evento "Gol" + equipo propio/rival
      if (evento === "Gol" && (equipo === "propio" || equipo === "rival")) {
        const field =
          equipo === "propio" ? "home_goals" : "away_goals";
        await conn.query(
          `UPDATE matches SET ${field} = ${field} + 1 WHERE match_id = ?`,
          [matchId]
        );
      }

      await conn.commit();
      return { ok: true };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
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

  // Listado y borrado de partidos
  app.get("/api/matches", async () => {
    const [rows] = await pool.query(
      "SELECT match_id as matchId, created_at as createdAt, home_team as homeTeam, away_team as awayTeam FROM matches ORDER BY created_at DESC"
    );
    return rows;
  });

  // --- Reporting basado en fact_events (Fase 1) ---
  app.get<{
    Params: { matchId: string };
  }>("/reports/match/:matchId/summary", async (request, reply) => {
    const { matchId } = request.params;
    const [rows] = await pool.query(
      `
        SELECT
          et.name as eventType,
          SUM(CASE WHEN fe.team_id = m.home_team_id THEN 1 ELSE 0 END) as homeCount,
          SUM(CASE WHEN fe.team_id = m.away_team_id THEN 1 ELSE 0 END) as awayCount,
          COUNT(*) as total
        FROM fact_events fe
        LEFT JOIN matches m ON m.match_id = fe.match_id
        LEFT JOIN event_types et ON et.id = fe.event_type_id
        WHERE fe.match_id = ?
        GROUP BY et.name
        ORDER BY total DESC, eventType ASC
      `,
      [matchId]
    );
    return rows;
  });

  app.get<{
    Params: { matchId: string };
  }>("/reports/match/:matchId/timeline", async (request, reply) => {
    const { matchId } = request.params;
    const [rows] = await pool.query(
      `
        SELECT
          fe.id,
          fe.period,
          fe.minute,
          fe.t_match_ms as tMatchMs,
          et.name as eventType,
          tm.name as teamName,
          pl.number as playerNumber,
          pl.name as playerName,
          zn.code as zoneCode
        FROM fact_events fe
        LEFT JOIN event_types et ON et.id = fe.event_type_id
        LEFT JOIN teams tm ON tm.id = fe.team_id
        LEFT JOIN players pl ON pl.id = fe.player_id
        LEFT JOIN zones zn ON zn.id = fe.zone_id
        WHERE fe.match_id = ?
        ORDER BY fe.t_match_ms ASC, fe.id ASC
      `,
      [matchId]
    );
    return rows;
  });

  app.get<{
    Params: { matchId: string };
  }>("/reports/match/:matchId/zones", async (request, reply) => {
    const { matchId } = request.params;
    const [rows] = await pool.query(
      `
        SELECT
          zn.code as zoneCode,
          zn.name as zoneName,
          COUNT(*) as total
        FROM fact_events fe
        LEFT JOIN zones zn ON zn.id = fe.zone_id
        WHERE fe.match_id = ?
        GROUP BY zn.code, zn.name
        ORDER BY zn.code
      `,
      [matchId]
    );
    return rows;
  });

  app.delete<{
    Params: { id: string };
  }>("/api/matches/:id", async (request, reply) => {
    const matchId = request.params.id;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("DELETE FROM events WHERE match_id = ?", [matchId]);
      const [result] = await conn.query("DELETE FROM matches WHERE match_id = ?", [
        matchId,
      ]);
      await conn.commit();
      const affected = (result as any).affectedRows || 0;
      if (affected === 0) {
        return reply.code(404).send({ error: "Match not found" });
      }
      return { ok: true };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  });
}
