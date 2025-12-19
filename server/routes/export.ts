import { FastifyInstance } from "fastify";
import { sheetsClient } from "../sheets/client";

export async function registerExportRoute(app: FastifyInstance) {
  app.post<{
    Body: { meta: any; events: any[] };
  }>("/export", async (request, reply) => {
    const { meta, events } = request.body;
    await sheetsClient.appendEvents(meta, events);
    return reply.code(200).send({ ok: true });
  });
}
