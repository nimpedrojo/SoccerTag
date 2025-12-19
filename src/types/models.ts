export interface MatchEvent {
  eventId: string; // UUID
  matchId: string;
  period: "1T" | "2T";
  tMatchMs: number; // tiempo de partido en ms
  tWall: string; // ISO timestamp real
  selections: {
    [category: string]: string[];
  };
  notes?: string;
}

export interface StoredMatchEvent extends MatchEvent {
  createdAt: number; // performance timestamp or Date.now for ordering
}

export interface MatchMeta {
  matchId: string;
  createdAt: string;
  teams: { home: string; away: string };
  configVersion: number;
  side?: "home" | "away";
  starters?: string[]; // jersey numbers
  fieldName?: string;
  category?: string;
  notes?: string;
}

export type TeamRef = "home" | "away";

export interface ExportBundle {
  meta: MatchMeta;
  events: MatchEvent[];
}
