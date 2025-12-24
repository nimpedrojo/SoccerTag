interface SheetsClientOptions {
  scriptUrl: string;
}

class SheetsClient {
  private scriptUrl: string;

  constructor(opts: SheetsClientOptions) {
    this.scriptUrl = opts.scriptUrl;
  }

  async appendEvents(meta: any, events: any[]) {
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

    console.log("Sending to script URL:", this.scriptUrl);
    console.log("Data:", JSON.stringify({ rows }));

    const response = await fetch(this.scriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rows }),
    });

    console.log("Response status:", response.status);
    console.log("Response text:", await response.text());

    if (!response.ok) {
      throw new Error(`Failed to append events: ${response.statusText}`);
    }

    return await response.json();
  }
}

// Factory; in real app, load from env/config
const scriptUrl = process.env.GSHEET_SCRIPT_URL || "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";
console.log("Script URL:", scriptUrl);
export const sheetsClient = new SheetsClient({
  scriptUrl,
});
