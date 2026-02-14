import type { BudgetConfig } from "./types.js";

const DEFAULT_BUDGET: Required<BudgetConfig> = {
  maxCycles: 100,
  maxTokens: 500_000,
  maxCostUSD: 5.0,
  maxDurationMs: 10 * 60 * 1000, // 10 minutes
};

// Rough pricing per 1M tokens (Sonnet 4.5)
const INPUT_COST_PER_M = 3.0;
const OUTPUT_COST_PER_M = 15.0;

export interface BudgetState {
  cycles: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUSD: number;
  durationMs: number;
  limits: Required<BudgetConfig>;
}

/**
 * Tracks resource usage and enforces budget limits for a perception loop.
 */
export class BudgetController {
  private cycles = 0;
  private inputTokens = 0;
  private outputTokens = 0;
  private startTime: number;
  private limits: Required<BudgetConfig>;

  constructor(config?: BudgetConfig) {
    this.limits = {
      maxCycles: config?.maxCycles ?? DEFAULT_BUDGET.maxCycles,
      maxTokens: config?.maxTokens ?? DEFAULT_BUDGET.maxTokens,
      maxCostUSD: config?.maxCostUSD ?? DEFAULT_BUDGET.maxCostUSD,
      maxDurationMs: config?.maxDurationMs ?? DEFAULT_BUDGET.maxDurationMs,
    };
    this.startTime = Date.now();
  }

  /** Check if the loop can proceed with another cycle */
  canProceed(): { allowed: boolean; reason?: string } {
    if (this.cycles >= this.limits.maxCycles) {
      return { allowed: false, reason: `Max cycles reached (${this.limits.maxCycles})` };
    }

    const totalTokens = this.inputTokens + this.outputTokens;
    if (totalTokens >= this.limits.maxTokens) {
      return {
        allowed: false,
        reason: `Max tokens reached (${totalTokens}/${this.limits.maxTokens})`,
      };
    }

    const cost = this.estimateCost();
    if (cost >= this.limits.maxCostUSD) {
      return {
        allowed: false,
        reason: `Max cost reached ($${cost.toFixed(2)}/$${this.limits.maxCostUSD.toFixed(2)})`,
      };
    }

    const elapsed = Date.now() - this.startTime;
    if (elapsed >= this.limits.maxDurationMs) {
      return {
        allowed: false,
        reason: `Max duration reached (${Math.round(elapsed / 1000)}s/${Math.round(this.limits.maxDurationMs / 1000)}s)`,
      };
    }

    return { allowed: true };
  }

  /** Record token usage for a completed cycle */
  onCycleComplete(tokens: { input: number; output: number }): void {
    this.cycles++;
    this.inputTokens += tokens.input;
    this.outputTokens += tokens.output;
  }

  /** Get current budget state */
  getState(): BudgetState {
    return {
      cycles: this.cycles,
      estimatedInputTokens: this.inputTokens,
      estimatedOutputTokens: this.outputTokens,
      estimatedCostUSD: this.estimateCost(),
      durationMs: Date.now() - this.startTime,
      limits: { ...this.limits },
    };
  }

  /** Estimate the token cost for a frame at given dimensions */
  static estimateFrameTokens(width: number, height: number): number {
    return Math.ceil((width * height) / 750);
  }

  private estimateCost(): number {
    return (
      (this.inputTokens / 1_000_000) * INPUT_COST_PER_M +
      (this.outputTokens / 1_000_000) * OUTPUT_COST_PER_M
    );
  }
}
