import { MatchEvent, StoredMatchEvent } from "../types/models";
import { saveMatchEvent, deleteLastEvent as dbDeleteLast } from "../db";
import { uuid } from "../lib/uuid";

export interface CreateMatchEventParams {
  matchId: string;
  period: "1T" | "2T";
  tMatchMs: number;
  selections: MatchEvent["selections"];
  notes?: string;
}

/**
 * Construye un MatchEvent listo para persistir.
 */
export const createMatchEvent = (params: CreateMatchEventParams): MatchEvent => {
  const { matchId, period, tMatchMs, selections, notes } = params;
  return {
    eventId: uuid(),
    matchId,
    period,
    tMatchMs,
    tWall: new Date().toISOString(),
    selections,
    notes,
  };
};

/**
 * Guarda inmediatamente en IndexedDB (append-only).
 */
export const persistMatchEvent = async (event: MatchEvent): Promise<void> => {
  const stored: StoredMatchEvent = {
    ...event,
    createdAt: Date.now(),
  };
  await saveMatchEvent(stored);
};

export const undoLastEvent = (matchId: string) => dbDeleteLast(matchId);
