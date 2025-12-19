import { google } from "googleapis";

interface SheetsClientOptions {
  spreadsheetId: string;
  credentials: {
    client_email: string;
    private_key: string;
  };
}

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

class SheetsClient {
  private sheets;
  private spreadsheetId: string;

  constructor(opts: SheetsClientOptions) {
    const auth = new google.auth.JWT(
      opts.credentials.client_email,
      undefined,
      opts.credentials.private_key,
      SCOPES
    );
    this.sheets = google.sheets({ version: "v4", auth });
    this.spreadsheetId = opts.spreadsheetId;
  }

  async appendEvents(meta: any, events: any[]) {
    // Simple append, one row per event. Customize as needed.
    const rows = events.map((evt) => [
      meta.matchId,
      meta.teams?.home ?? "",
      meta.teams?.away ?? "",
      evt.period,
      evt.tMatchMs,
      evt.tWall,
      JSON.stringify(evt.selections),
      evt.notes ?? "",
    ]);

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: "Events!A1",
      valueInputOption: "RAW",
      requestBody: {
        values: rows,
      },
    });
  }
}

// Factory; in real app, load from env/config
export const sheetsClient = new SheetsClient({
  spreadsheetId: process.env.GSHEET_ID || "YOUR_SPREADSHEET_ID",
  credentials: {
    client_email: process.env.GSHEET_CLIENT_EMAIL || "service-account@project.iam.gserviceaccount.com",
    private_key: (process.env.GSHEET_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  },
});
