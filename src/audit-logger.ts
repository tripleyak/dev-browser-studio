import { mkdirSync, appendFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { CycleEntry, LoopResult } from "./types.js";
import type { BudgetState } from "./budget.js";

/**
 * Logs each perception-action cycle as JSONL and saves frames as JPEGs.
 * Creates a directory per task with cycles.jsonl, frames/, and summary.json.
 */
export class AuditLogger {
  private dir: string;
  private framesDir: string;
  private cyclesPath: string;

  constructor(outputDir: string, taskId: string) {
    this.dir = join(outputDir, taskId);
    this.framesDir = join(this.dir, "frames");
    this.cyclesPath = join(this.dir, "cycles.jsonl");

    mkdirSync(this.framesDir, { recursive: true });
  }

  /** Log a completed perception-action cycle */
  logCycle(entry: CycleEntry, budgetState?: BudgetState): void {
    const logEntry = {
      cycle: entry.cycle,
      timestamp: entry.timestamp,
      page_url: entry.pageUrl,
      frame_path: `frames/cycle-${entry.cycle}.jpg`,
      action: { name: entry.action.name, input: entry.action.input },
      reasoning: entry.reasoning,
      result: entry.result,
      tokens: entry.tokens,
      duration_ms: entry.durationMs,
      budget_remaining: budgetState
        ? {
            cycles: budgetState.limits.maxCycles - budgetState.cycles,
            tokens: budgetState.limits.maxTokens - budgetState.estimatedInputTokens - budgetState.estimatedOutputTokens,
          }
        : undefined,
    };

    appendFileSync(this.cyclesPath, JSON.stringify(logEntry) + "\n");
  }

  /** Save a frame image for a cycle */
  saveFrame(cycle: number, jpeg: Buffer): void {
    const framePath = join(this.framesDir, `cycle-${cycle}.jpg`);
    writeFileSync(framePath, jpeg);
  }

  /** Write final summary when loop completes */
  saveSummary(result: LoopResult, budgetState: BudgetState): void {
    const summary = {
      result: {
        success: result.success,
        summary: result.summary,
        cycles: result.cycles,
        extracted_data: result.extractedData,
      },
      budget: {
        cycles_used: budgetState.cycles,
        input_tokens: budgetState.estimatedInputTokens,
        output_tokens: budgetState.estimatedOutputTokens,
        estimated_cost_usd: budgetState.estimatedCostUSD,
        duration_ms: budgetState.durationMs,
      },
      completed_at: new Date().toISOString(),
    };

    writeFileSync(join(this.dir, "summary.json"), JSON.stringify(summary, null, 2));
  }

  /** Get the audit directory path */
  getDir(): string {
    return this.dir;
  }
}
