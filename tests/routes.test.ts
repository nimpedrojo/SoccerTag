import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { registerAppRoutes } from "../server/routes/app";

describe("app routes", () => {
  it("registers routes without errors", async () => {
    const app = Fastify();

    await app.register(registerAppRoutes);
    await app.ready();

    const routes = app.printRoutes();
    expect(routes).toContain("register (POST)");
    expect(routes).toContain("ogin (POST)");
    expect(routes).toContain("user/team (POST)");
    expect(routes).toContain("matches (POST, GET, HEAD)");
    expect(routes).toContain("events (POST)");
    expect(routes).toContain("ineup-templates (GET, HEAD, POST)");
    expect(routes).toContain("ineup-templates (GET, HEAD, POST)");
    expect(routes).toContain(":id (GET, HEAD)");
    expect(routes).toContain("/set-default (POST)");
    expect(routes).toContain("substitution (POST)");
  });
});
