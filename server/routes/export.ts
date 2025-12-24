import { FastifyInstance } from "fastify";
import { sheetsClient } from "../sheets/client";

export async function registerExportRoute(app: FastifyInstance) {
  app.post<{
    Body: { meta: any; events: any[] };
  }>("/export", async (request, reply) => {
    console.log("Received export request:", request.body);
    try {
      const { meta, events } = request.body;
      await sheetsClient.appendEvents(meta, events);
      console.log("Export successful");
      return reply.code(200).send({ ok: true });
    } catch (error) {
      console.error("Failed to append events:", error);
      return reply.code(500).send({ error: "Failed to export data" });
    }
  });
}
