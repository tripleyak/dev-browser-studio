import type { Page, ElementHandle } from "playwright";
import type {
  PerceptionLoopConfig,
  CycleEntry,
  LoopResult,
  AgentAction,
  SafetyConfig,
} from "./types.js";
import { ActionExecutor } from "./tools.js";
import { VLMClient, compressHistory } from "./vlm-client.js";
import { FrameSampler } from "./frame-sampler.js";
import { BudgetController } from "./budget.js";
import { AuditLogger } from "./audit-logger.js";
import type { DevBrowserClient } from "./client.js";

const DEFAULTS = {
  model: "claude-sonnet-4-5-20250929",
  maxWidth: 1024,
  maxHeight: 768,
  quality: 70,
  maxCycles: 50,
  maxConsecutiveErrors: 5,
  settleTimeMs: 300,
  apiTimeoutMs: 30000,
  frameDiffThreshold: 0.05,
  maxSnapshotChars: 40_000,
  auditDir: "./recordings",
} as const;

/**
 * Autonomous perception-action loop for browser interaction.
 *
 * Captures screenshots + ARIA snapshots, sends them to Claude Vision,
 * receives actions via tool_use, executes them, and repeats.
 */
export class PerceptionLoop {
  private vlm: VLMClient;
  private sampler: FrameSampler;
  private budget: BudgetController;
  private config: Required<
    Pick<
      PerceptionLoopConfig,
      | "maxWidth"
      | "maxHeight"
      | "quality"
      | "maxCycles"
      | "maxConsecutiveErrors"
      | "settleTimeMs"
      | "apiTimeoutMs"
      | "maxSnapshotChars"
      | "auditDir"
    >
  > & { safety?: SafetyConfig };

  constructor(config?: PerceptionLoopConfig) {
    this.vlm = new VLMClient({
      model: config?.model ?? DEFAULTS.model,
      timeoutMs: config?.apiTimeoutMs ?? DEFAULTS.apiTimeoutMs,
    });

    this.sampler = new FrameSampler({
      diffThreshold: config?.frameDiffThreshold ?? DEFAULTS.frameDiffThreshold,
    });

    this.budget = new BudgetController(config?.budget);

    this.config = {
      maxWidth: config?.maxWidth ?? DEFAULTS.maxWidth,
      maxHeight: config?.maxHeight ?? DEFAULTS.maxHeight,
      quality: config?.quality ?? DEFAULTS.quality,
      maxCycles: config?.maxCycles ?? DEFAULTS.maxCycles,
      maxConsecutiveErrors:
        config?.maxConsecutiveErrors ?? DEFAULTS.maxConsecutiveErrors,
      settleTimeMs: config?.settleTimeMs ?? DEFAULTS.settleTimeMs,
      apiTimeoutMs: config?.apiTimeoutMs ?? DEFAULTS.apiTimeoutMs,
      maxSnapshotChars:
        config?.maxSnapshotChars ?? DEFAULTS.maxSnapshotChars,
      auditDir: config?.auditDir ?? DEFAULTS.auditDir,
      safety: config?.safety,
    };
  }

  /**
   * Run the perception-action loop on a page.
   *
   * @param client - DevBrowserClient connected to the server
   * @param pageName - Name of the page in the dev-browser-studio registry
   * @param task - Natural language description of what to accomplish
   */
  async run(
    client: DevBrowserClient,
    pageName: string,
    task: string,
  ): Promise<LoopResult> {
    let page = await client.page(pageName);
    const taskId = `perception-${Date.now()}`;
    const audit = new AuditLogger(this.config.auditDir, taskId);

    const resolveRef = async (ref: string): Promise<ElementHandle | null> => {
      return client.selectSnapshotRef(pageName, ref);
    };

    let executor = new ActionExecutor(page, resolveRef);
    const history: CycleEntry[] = [];
    let consecutiveErrors = 0;

    // Re-acquire the page handle after navigation invalidates it
    const reacquirePage = async (): Promise<boolean> => {
      try {
        page = await client.page(pageName);
        executor = new ActionExecutor(page, resolveRef);
        page.on("dialog", async (dialog) => {
          await dialog.accept().catch(() => {});
        });
        return true;
      } catch {
        return false;
      }
    };

    // Register dialog handler to prevent hanging
    page.on("dialog", async (dialog) => {
      await dialog.accept().catch(() => {});
    });

    for (let cycle = 0; cycle < this.config.maxCycles; cycle++) {
      const cycleStart = Date.now();

      // Check budget
      const budgetCheck = this.budget.canProceed();
      if (!budgetCheck.allowed) {
        const result = this.buildResult(
          false,
          `Budget exceeded: ${budgetCheck.reason}`,
          history,
        );
        audit.saveSummary(result, this.budget.getState());
        return result;
      }

      try {
        // 1. Capture screenshot (with page recovery on navigation)
        let screenshotBuffer: Buffer;
        try {
          screenshotBuffer = await page.screenshot({
            type: "jpeg",
            quality: this.config.quality,
          });
        } catch (screenshotErr) {
          // Page handle may be invalid after navigation — try to re-acquire
          const errMsg = screenshotErr instanceof Error ? screenshotErr.message : "";
          if (errMsg.includes("Target closed") || errMsg.includes("Target page")) {
            const recovered = await reacquirePage();
            if (recovered) {
              // Wait for the new page to settle
              await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});
              this.sampler.forceCapture();
              screenshotBuffer = await page.screenshot({
                type: "jpeg",
                quality: this.config.quality,
              });
            } else {
              throw screenshotErr;
            }
          } else {
            throw screenshotErr;
          }
        }

        // 2. Check if frame changed (skip if no visual change)
        const frameChanged = await this.sampler.hasChanged(screenshotBuffer);
        if (!frameChanged && cycle > 0) {
          // Frame hasn't changed — use ARIA-only or skip
          // But still proceed because the agent may need to try a different approach
        }

        // Save frame for audit
        audit.saveFrame(cycle, screenshotBuffer);

        // 3. Get ARIA snapshot (truncated to fit context window)
        let ariaSnapshot: string;
        try {
          const raw = await client.getAISnapshot(pageName);
          ariaSnapshot = truncateSnapshot(raw, this.config.maxSnapshotChars);
        } catch {
          ariaSnapshot = "(ARIA snapshot unavailable)";
        }

        // 4. Build history context
        const historyStr = compressHistory(history);

        // 5. Add stuck detection
        let taskWithContext = task;
        if (this.isStuck(history)) {
          taskWithContext +=
            "\n\n⚠️ You appear to be repeating the same action. Try a different approach.";
        }

        // 6. Call Claude Vision
        const frameBase64 = screenshotBuffer.toString("base64");
        const vlmResult = await this.vlm.analyzeFrame({
          frameBase64,
          ariaSnapshot,
          history: historyStr,
          task: taskWithContext,
        });

        const { action, reasoning, usage } = vlmResult;
        const tokens = { input: usage.input_tokens, output: usage.output_tokens };

        // 7. Validate action (safety check)
        const safetyCheck = this.validateAction(action, page.url());
        if (!safetyCheck.allowed) {
          const entry: CycleEntry = {
            cycle,
            timestamp: Date.now(),
            pageUrl: page.url(),
            action,
            reasoning,
            result: { success: false, error: `Blocked: ${safetyCheck.reason}` },
            tokens,
            durationMs: Date.now() - cycleStart,
          };
          history.push(entry);
          audit.logCycle(entry, this.budget.getState());
          this.budget.onCycleComplete(tokens);
          consecutiveErrors++;
          continue;
        }

        // 8. Check for terminal actions
        if (action.name === "done") {
          const entry: CycleEntry = {
            cycle,
            timestamp: Date.now(),
            pageUrl: page.url(),
            action,
            reasoning,
            result: { success: true },
            tokens,
            durationMs: Date.now() - cycleStart,
          };
          history.push(entry);
          audit.logCycle(entry, this.budget.getState());
          this.budget.onCycleComplete(tokens);

          const result = this.buildResult(
            action.input.success as boolean,
            action.input.summary as string,
            history,
            action.input.extracted_data as Record<string, unknown> | undefined,
          );
          audit.saveSummary(result, this.budget.getState());
          return result;
        }

        if (action.name === "fail") {
          const entry: CycleEntry = {
            cycle,
            timestamp: Date.now(),
            pageUrl: page.url(),
            action,
            reasoning,
            result: { success: true },
            tokens,
            durationMs: Date.now() - cycleStart,
          };
          history.push(entry);
          audit.logCycle(entry, this.budget.getState());
          this.budget.onCycleComplete(tokens);

          const result = this.buildResult(
            false,
            action.input.reason as string,
            history,
          );
          audit.saveSummary(result, this.budget.getState());
          return result;
        }

        // 9. Execute action
        const actionResult = await executor.execute(action);

        const entry: CycleEntry = {
          cycle,
          timestamp: Date.now(),
          pageUrl: page.url(),
          action,
          reasoning,
          result: actionResult,
          tokens,
          durationMs: Date.now() - cycleStart,
        };
        history.push(entry);
        audit.logCycle(entry, this.budget.getState());
        this.budget.onCycleComplete(tokens);

        if (actionResult.success) {
          consecutiveErrors = 0;
        } else {
          consecutiveErrors++;
          if (consecutiveErrors >= this.config.maxConsecutiveErrors) {
            const result = this.buildResult(
              false,
              `Stopped after ${consecutiveErrors} consecutive errors. Last error: ${actionResult.error}`,
              history,
            );
            audit.saveSummary(result, this.budget.getState());
            return result;
          }
        }

        // 10. Settle — wait for page to stabilize after action
        if (action.name === "navigate") {
          // Navigation needs more time
          await page
            .waitForLoadState("networkidle", { timeout: 10000 })
            .catch(() => {});
          this.sampler.forceCapture();
        } else if (action.name !== "wait") {
          await sleep(this.config.settleTimeMs);
        }
      } catch (err) {
        // Unexpected error in the loop itself
        consecutiveErrors++;
        const entry: CycleEntry = {
          cycle,
          timestamp: Date.now(),
          pageUrl: safeUrl(page),
          action: { name: "error", input: {} },
          result: {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          },
          durationMs: Date.now() - cycleStart,
        };
        history.push(entry);
        audit.logCycle(entry, this.budget.getState());

        if (consecutiveErrors >= this.config.maxConsecutiveErrors) {
          const result = this.buildResult(
            false,
            `Stopped after ${consecutiveErrors} consecutive errors`,
            history,
          );
          audit.saveSummary(result, this.budget.getState());
          return result;
        }
      }
    }

    // Max cycles reached
    const result = this.buildResult(
      false,
      `Max cycles reached (${this.config.maxCycles})`,
      history,
    );
    audit.saveSummary(result, this.budget.getState());
    return result;
  }

  private buildResult(
    success: boolean,
    summary: string,
    history: CycleEntry[],
    extractedData?: Record<string, unknown>,
  ): LoopResult {
    const budgetState = this.budget.getState();
    return {
      success,
      summary,
      cycles: history.length,
      extractedData,
      budgetUsed: {
        cycles: budgetState.cycles,
        estimatedTokens:
          budgetState.estimatedInputTokens + budgetState.estimatedOutputTokens,
        estimatedCostUSD: budgetState.estimatedCostUSD,
        durationMs: budgetState.durationMs,
      },
    };
  }

  private isStuck(history: CycleEntry[]): boolean {
    if (history.length < 3) return false;

    const last3 = history.slice(-3);
    const actions = last3.map(
      (e) => `${e.action.name}:${JSON.stringify(e.action.input)}`,
    );

    // All 3 are identical
    return actions[0] === actions[1] && actions[1] === actions[2];
  }

  private validateAction(
    action: AgentAction,
    currentUrl: string,
  ): { allowed: boolean; reason?: string } {
    const safety = this.config.safety;
    if (!safety) return { allowed: true };

    // Read-only mode blocks mutating actions
    if (safety.readOnlyMode) {
      const allowedInReadOnly = [
        "scroll",
        "navigate",
        "wait",
        "done",
        "fail",
        "hover",
      ];
      if (!allowedInReadOnly.includes(action.name)) {
        return {
          allowed: false,
          reason: `Action "${action.name}" blocked in read-only mode`,
        };
      }
    }

    // URL pattern blocking for navigate actions
    if (action.name === "navigate" && safety.blockedURLPatterns?.length) {
      const url = action.input.url as string;
      for (const pattern of safety.blockedURLPatterns) {
        if (new RegExp(pattern).test(url)) {
          return {
            allowed: false,
            reason: `URL "${url}" blocked by pattern: ${pattern}`,
          };
        }
      }
    }

    return { allowed: true };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeUrl(page: Page): string {
  try {
    return page.url();
  } catch {
    return "(unavailable)";
  }
}

/**
 * Truncate an ARIA snapshot to fit within a character limit.
 * Cuts at line boundaries and appends a truncation notice.
 */
function truncateSnapshot(snapshot: string, maxChars: number): string {
  if (snapshot.length <= maxChars) return snapshot;

  // Find last newline before the limit, leaving room for the notice
  const notice = "\n\n... (ARIA snapshot truncated — showing first portion of page)";
  const cutoff = maxChars - notice.length;
  const lastNewline = snapshot.lastIndexOf("\n", cutoff);
  const cutPoint = lastNewline > 0 ? lastNewline : cutoff;

  return snapshot.slice(0, cutPoint) + notice;
}
