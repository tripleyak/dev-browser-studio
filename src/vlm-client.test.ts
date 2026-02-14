import { describe, it, expect } from "vitest";
import { compressHistory } from "./vlm-client.js";
import type { CycleEntry } from "./types.js";

function makeEntry(
  cycle: number,
  name: string,
  success: boolean,
  error?: string,
): CycleEntry {
  return {
    cycle,
    timestamp: Date.now(),
    pageUrl: "https://example.com",
    action: { name, input: { ref: `e${cycle}` } },
    result: { success, error },
    durationMs: 1000,
  };
}

describe("compressHistory", () => {
  it("returns empty string for no entries", () => {
    expect(compressHistory([])).toBe("");
  });

  it("formats recent entries with action and status", () => {
    const entries: CycleEntry[] = [
      makeEntry(0, "click", true),
      {
        ...makeEntry(1, "type", true),
        action: { name: "type", input: { text: "hello world" } },
      },
    ];
    const result = compressHistory(entries);
    expect(result).toContain("1. click");
    expect(result).toContain("2. type");
    expect(result).toContain("OK");
  });

  it("shows failure messages", () => {
    const entries = [makeEntry(0, "click", false, "Element not found")];
    const result = compressHistory(entries);
    expect(result).toContain("FAILED");
    expect(result).toContain("Element not found");
  });

  it("summarizes older entries when exceeding maxDetailed", () => {
    const entries: CycleEntry[] = [];
    for (let i = 0; i < 15; i++) {
      entries.push(makeEntry(i, "click", i % 3 !== 0));
    }

    const result = compressHistory(entries, 10);
    expect(result).toContain("5 earlier actions");
    // Should have summary line + 10 detailed entries
    const lines = result.split("\n");
    expect(lines.length).toBe(11); // 1 summary + 10 detailed
  });

  it("respects maxDetailed parameter", () => {
    const entries: CycleEntry[] = [];
    for (let i = 0; i < 5; i++) {
      entries.push(makeEntry(i, "click", true));
    }

    const result = compressHistory(entries, 3);
    const lines = result.split("\n");
    expect(lines.length).toBe(4); // 1 summary + 3 detailed
  });
});
