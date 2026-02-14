import { describe, it, expect, beforeEach } from "vitest";
import { BudgetController } from "./budget.js";

describe("BudgetController", () => {
  let budget: BudgetController;

  beforeEach(() => {
    budget = new BudgetController({
      maxCycles: 5,
      maxTokens: 10000,
      maxCostUSD: 1.0,
      maxDurationMs: 60000,
    });
  });

  it("allows proceeding when within limits", () => {
    expect(budget.canProceed()).toEqual({ allowed: true });
  });

  it("blocks after max cycles reached", () => {
    for (let i = 0; i < 5; i++) {
      budget.onCycleComplete({ input: 100, output: 50 });
    }
    const result = budget.canProceed();
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Max cycles");
  });

  it("blocks after max tokens reached", () => {
    budget.onCycleComplete({ input: 8000, output: 3000 });
    const result = budget.canProceed();
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Max tokens");
  });

  it("blocks after max cost reached", () => {
    // $1 at $3/M input + $15/M output
    // Need ~333K input tokens or ~66K output tokens
    // Use a mix: high output tokens to hit $1 quickly
    budget = new BudgetController({
      maxCycles: 1000,
      maxTokens: 10_000_000,
      maxCostUSD: 0.01,
      maxDurationMs: 600000,
    });
    // At $15/M output: 667 output tokens ≈ $0.01
    budget.onCycleComplete({ input: 1000, output: 1000 });
    const result = budget.canProceed();
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Max cost");
  });

  it("tracks state correctly", () => {
    budget.onCycleComplete({ input: 1000, output: 200 });
    budget.onCycleComplete({ input: 1500, output: 300 });

    const state = budget.getState();
    expect(state.cycles).toBe(2);
    expect(state.estimatedInputTokens).toBe(2500);
    expect(state.estimatedOutputTokens).toBe(500);
    expect(state.estimatedCostUSD).toBeGreaterThan(0);
    expect(state.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("uses default limits when no config provided", () => {
    const defaultBudget = new BudgetController();
    const state = defaultBudget.getState();
    expect(state.limits.maxCycles).toBe(100);
    expect(state.limits.maxTokens).toBe(500000);
    expect(state.limits.maxCostUSD).toBe(5.0);
    expect(state.limits.maxDurationMs).toBe(600000);
  });

  it("estimates frame tokens correctly", () => {
    expect(BudgetController.estimateFrameTokens(1024, 768)).toBe(
      Math.ceil((1024 * 768) / 750),
    );
    expect(BudgetController.estimateFrameTokens(100, 100)).toBe(
      Math.ceil(10000 / 750),
    );
  });
});
