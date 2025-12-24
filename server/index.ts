import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerExportRoute } from "./routes/export";

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

async function main() {
  const app = Fastify({
    logger: true,
  });

  // Parse JSON bodies
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  await app.register(cors, { origin: true });
  await app.register(registerExportRoute);

  await app.listen({ port, host });
  console.log(`Export server listening on http://${host}:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
