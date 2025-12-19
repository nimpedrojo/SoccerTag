import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerExportRoute } from "./routes/export";

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

async function main() {
  const app = Fastify({
    logger: true,
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
