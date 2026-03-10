import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerExportRoute } from "./routes/export.js";
import { registerAppRoutes } from "./routes/app.js";
import { runMigrations } from "./db.js";

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, { origin: true });
  await app.register(fastifyStatic, {
    // En runtime compilado, __dirname = <repo>/server/dist
    root: path.join(__dirname, "..", "..", "public"),
    prefix: "/",
  });

  await runMigrations();

  await app.register(registerExportRoute);
  await app.register(registerAppRoutes);

  await app.listen({ port, host });
  console.log(`Export server listening on http://${host}:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
