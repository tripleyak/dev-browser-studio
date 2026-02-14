import Anthropic from "@anthropic-ai/sdk";
import { AGENT_TOOLS } from "./tools.js";
import type { AgentAction, CycleEntry } from "./types.js";

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

const SYSTEM_PROMPT = `You are a browser automation agent. You can see the current page screenshot and its accessibility tree (ARIA snapshot). Your job is to complete the user's task by taking actions on the page.

## How to interact

- **ARIA refs**: When the ARIA snapshot shows elements like [ref=e5], use the ref (e.g. "e5") in your actions. This is preferred over coordinates.
- **Coordinates**: For canvas/WebGL content or elements without ARIA refs, use x,y pixel coordinates from the screenshot.
- **One action per turn**: Take exactly one action, then observe the result.

## ARIA snapshot format

The snapshot is a YAML-like tree showing the page's accessibility structure:
- [ref=eN] markers identify interactive elements you can target
- Text content, roles, and states are shown for each element

## Guidelines

- Look at both the screenshot AND the ARIA snapshot before acting
- After clicking or typing, wait for the page to update before your next action
- If an element is not visible, scroll to find it
- If you're stuck, try a different approach
- Call "done" when the task is complete
- Call "fail" if the task is impossible`;

export interface AnalyzeFrameInput {
  /** Base64-encoded JPEG screenshot */
  frameBase64: string;
  /** ARIA accessibility tree snapshot */
  ariaSnapshot: string;
  /** Compressed history of previous actions */
  history: string;
  /** The user's task description */
  task: string;
}

export interface AnalyzeFrameResult {
  action: AgentAction;
  reasoning?: string;
  usage: { input_tokens: number; output_tokens: number };
}

/**
 * Client for Claude's Vision API, specialized for browser perception.
 */
export class VLMClient {
  private client: Anthropic;
  private model: string;
  private timeoutMs: number;

  constructor(config?: { model?: string; apiKey?: string; timeoutMs?: number }) {
    this.client = new Anthropic({
      apiKey: config?.apiKey,
      timeout: config?.timeoutMs ?? 30000,
    });
    this.model = config?.model ?? DEFAULT_MODEL;
    this.timeoutMs = config?.timeoutMs ?? 30000;
  }

  async analyzeFrame(input: AnalyzeFrameInput): Promise<AnalyzeFrameResult> {
    const userContent: Anthropic.Messages.ContentBlockParam[] = [];

    // Add the screenshot
    userContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: input.frameBase64,
      },
    });

    // Build the text context
    let textContext = `## Task\n${input.task}\n`;

    if (input.history) {
      textContext += `\n## Previous Actions\n${input.history}\n`;
    }

    textContext += `\n## Current Page ARIA Snapshot\n\`\`\`\n${input.ariaSnapshot}\n\`\`\`\n`;
    textContext += `\nAnalyze the screenshot and ARIA snapshot above. Take the next action to complete the task.`;

    userContent.push({ type: "text", text: textContext });

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: AGENT_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Messages.Tool.InputSchema,
      })),
      tool_choice: { type: "any" },
      messages: [{ role: "user", content: userContent }],
    });

    // Extract tool_use block
    const toolUseBlock = response.content.find(
      (block): block is Anthropic.Messages.ToolUseBlock =>
        block.type === "tool_use",
    );

    if (!toolUseBlock) {
      // No tool call — treat as failure
      const textBlock = response.content.find(
        (block): block is Anthropic.Messages.TextBlock => block.type === "text",
      );
      return {
        action: {
          name: "fail",
          input: {
            reason:
              textBlock?.text ?? "Model did not return a tool_use response",
          },
        },
        reasoning: textBlock?.text,
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        },
      };
    }

    // Extract reasoning from any text blocks before the tool call
    const reasoning = response.content
      .filter(
        (block): block is Anthropic.Messages.TextBlock => block.type === "text",
      )
      .map((block) => block.text)
      .join("\n")
      .trim() || undefined;

    return {
      action: {
        name: toolUseBlock.name,
        input: toolUseBlock.input as Record<string, unknown>,
      },
      reasoning,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    };
  }
}

/**
 * Compress action history into a concise string for Claude's context.
 * Keeps the last N entries and summarizes earlier ones.
 */
export function compressHistory(
  entries: CycleEntry[],
  maxDetailed: number = 10,
): string {
  if (entries.length === 0) return "";

  const lines: string[] = [];

  // Summary of older entries
  if (entries.length > maxDetailed) {
    const older = entries.slice(0, entries.length - maxDetailed);
    const successes = older.filter((e) => e.result.success).length;
    lines.push(
      `[${older.length} earlier actions: ${successes} succeeded, ${older.length - successes} failed]`,
    );
  }

  // Detailed recent entries
  const recent = entries.slice(-maxDetailed);
  for (const entry of recent) {
    const status = entry.result.success ? "OK" : `FAILED: ${entry.result.error}`;
    const actionStr = formatAction(entry.action);
    lines.push(`${entry.cycle + 1}. ${actionStr} → ${status}`);
  }

  return lines.join("\n");
}

function formatAction(action: AgentAction): string {
  switch (action.name) {
    case "click": {
      const ref = action.input.ref as string | undefined;
      const x = action.input.x as number | undefined;
      const y = action.input.y as number | undefined;
      if (ref) return `click(ref=${ref})`;
      return `click(${x},${y})`;
    }
    case "type": {
      const text = action.input.text as string;
      const preview = text.length > 20 ? text.slice(0, 20) + "..." : text;
      return `type("${preview}")`;
    }
    case "scroll":
      return `scroll(${action.input.direction})`;
    case "navigate":
      return `navigate(${action.input.url})`;
    case "keyboard":
      return `keyboard(${action.input.key})`;
    case "wait":
      return `wait(${action.input.ms ?? 1000}ms)`;
    case "hover": {
      const ref = action.input.ref as string | undefined;
      if (ref) return `hover(ref=${ref})`;
      return `hover(${action.input.x},${action.input.y})`;
    }
    case "select":
      return `select(ref=${action.input.ref}, "${action.input.value}")`;
    case "done":
      return `done(${action.input.success ? "success" : "failure"})`;
    case "fail":
      return `fail("${action.input.reason}")`;
    default:
      return `${action.name}(${JSON.stringify(action.input)})`;
  }
}
