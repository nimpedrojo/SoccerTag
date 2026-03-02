import { describe, it, expect } from "vitest";
import { newMatchId } from "../server/db";

describe("db helpers", () => {
  it("generates unique match ids", () => {
    const id1 = newMatchId();
    const id2 = newMatchId();
    expect(id1).not.toBe(id2);
  });
});

