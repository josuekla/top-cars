import { describe, expect, it } from "vitest";

describe("smoke", () => {
  it("executa a pipeline de teste", () => {
    expect(1 + 1).toBe(2);
  });
});