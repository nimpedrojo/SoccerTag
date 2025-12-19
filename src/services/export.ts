import { ExportBundle, MatchEvent, MatchMeta } from "../types/models";
import { getEventsByMatch, getMatchMeta } from "../db";

export const buildExportBundle = async (matchId: string): Promise<ExportBundle> => {
  const [meta, events] = await Promise.all([getMatchMeta(matchId), getEventsByMatch(matchId)]);
  if (!meta) {
    throw new Error("MatchMeta not found for export");
  }
  return { meta, events };
};

export const downloadJson = (bundle: ExportBundle) => {
  const dataStr = JSON.stringify(bundle, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${bundle.meta.matchId}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

// --- Google Sheets integration placeholders ---

export interface SheetsPayload {
  meta: MatchMeta;
  events: MatchEvent[];
}

/**
 * Envío a backend propio (Node/Fastify) que usa Service Account.
 */
export const postToBackend = async (endpoint: string, payload: SheetsPayload) => {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Export failed: ${res.status} ${res.statusText}`);
  }
};

/**
 * Envío a Google Apps Script (web app) si se quiere evitar backend.
 */
export const postToAppsScript = async (webAppUrl: string, payload: SheetsPayload) => {
  const res = await fetch(webAppUrl, {
    method: "POST",
    mode: "cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Apps Script export failed: ${res.status} ${res.statusText}`);
  }
};
