import type { Page, ElementHandle } from "playwright";
import type { AgentAction, ActionResult } from "./types.js";

/** Tool definition for Claude's tool_use API */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/** The action vocabulary Claude can use */
export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: "click",
    description:
      "Click an element. Use ARIA ref (e.g. 'e5') when available, or pixel coordinates for canvas/visual targets.",
    input_schema: {
      type: "object",
      properties: {
        ref: { type: "string", description: "ARIA snapshot ref like 'e5'" },
        x: { type: "number", description: "X coordinate (CSS pixels)" },
        y: { type: "number", description: "Y coordinate (CSS pixels)" },
        button: {
          type: "string",
          enum: ["left", "right", "middle"],
          description: "Mouse button (default: left)",
        },
      },
    },
  },
  {
    name: "type",
    description: "Type text into the focused element or a specific element.",
    input_schema: {
      type: "object",
      properties: {
        ref: { type: "string", description: "ARIA snapshot ref to focus first" },
        text: { type: "string", description: "Text to type" },
        clear_first: {
          type: "boolean",
          description: "Clear the field before typing (default: false)",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "scroll",
    description: "Scroll the page or a specific element.",
    input_schema: {
      type: "object",
      properties: {
        direction: {
          type: "string",
          enum: ["up", "down", "left", "right"],
          description: "Scroll direction",
        },
        amount: {
          type: "number",
          description: "Pixels to scroll (default: 300)",
        },
      },
      required: ["direction"],
    },
  },
  {
    name: "navigate",
    description: "Navigate to a URL.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to navigate to" },
      },
      required: ["url"],
    },
  },
  {
    name: "keyboard",
    description:
      "Press a keyboard shortcut (e.g., 'Enter', 'Tab', 'Control+a', 'Escape').",
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Key or shortcut to press" },
      },
      required: ["key"],
    },
  },
  {
    name: "wait",
    description: "Wait before continuing. Use when the page needs time to load or animate.",
    input_schema: {
      type: "object",
      properties: {
        ms: {
          type: "number",
          description: "Milliseconds to wait (default: 1000)",
        },
        reason: { type: "string", description: "Why you are waiting" },
      },
    },
  },
  {
    name: "hover",
    description: "Hover over an element to reveal tooltips or dropdown menus.",
    input_schema: {
      type: "object",
      properties: {
        ref: { type: "string", description: "ARIA snapshot ref" },
        x: { type: "number", description: "X coordinate" },
        y: { type: "number", description: "Y coordinate" },
      },
    },
  },
  {
    name: "select",
    description: "Select an option from a dropdown/select element.",
    input_schema: {
      type: "object",
      properties: {
        ref: { type: "string", description: "ARIA snapshot ref of the select element" },
        value: { type: "string", description: "Option value or label to select" },
      },
      required: ["ref", "value"],
    },
  },
  {
    name: "done",
    description: "Signal that the task is complete.",
    input_schema: {
      type: "object",
      properties: {
        success: { type: "boolean", description: "Whether the task succeeded" },
        summary: { type: "string", description: "Summary of what was accomplished" },
        extracted_data: {
          type: "object",
          description: "Any data extracted during the task",
        },
      },
      required: ["success", "summary"],
    },
  },
  {
    name: "fail",
    description: "Signal that the task cannot be completed.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Why the task failed" },
      },
      required: ["reason"],
    },
  },
];

/** Resolve an ARIA ref to a Playwright ElementHandle */
type RefResolver = (ref: string) => Promise<ElementHandle | null>;

/**
 * Executes agent actions on a Playwright page.
 */
export class ActionExecutor {
  constructor(
    private page: Page,
    private resolveRef: RefResolver,
  ) {}

  async execute(action: AgentAction): Promise<ActionResult> {
    try {
      switch (action.name) {
        case "click":
          return await this.executeClick(action.input);
        case "type":
          return await this.executeType(action.input);
        case "scroll":
          return await this.executeScroll(action.input);
        case "navigate":
          return await this.executeNavigate(action.input);
        case "keyboard":
          return await this.executeKeyboard(action.input);
        case "wait":
          return await this.executeWait(action.input);
        case "hover":
          return await this.executeHover(action.input);
        case "select":
          return await this.executeSelect(action.input);
        case "done":
        case "fail":
          // Terminal actions — handled by the loop, not the executor
          return { success: true };
        default:
          return { success: false, error: `Unknown action: ${action.name}` };
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async executeClick(
    input: Record<string, unknown>,
  ): Promise<ActionResult> {
    const ref = input.ref as string | undefined;
    const x = input.x as number | undefined;
    const y = input.y as number | undefined;
    const button = (input.button as "left" | "right" | "middle") ?? "left";

    if (ref) {
      const element = await this.resolveRef(ref);
      if (!element) {
        return { success: false, error: `Ref "${ref}" not found` };
      }
      await element.click({ button });
      return { success: true };
    }

    if (x !== undefined && y !== undefined) {
      await this.page.mouse.click(x, y, { button });
      return { success: true };
    }

    return { success: false, error: "click requires ref or x,y coordinates" };
  }

  private async executeType(
    input: Record<string, unknown>,
  ): Promise<ActionResult> {
    const ref = input.ref as string | undefined;
    const text = input.text as string;
    const clearFirst = input.clear_first as boolean | undefined;

    if (ref) {
      const element = await this.resolveRef(ref);
      if (!element) {
        return { success: false, error: `Ref "${ref}" not found` };
      }
      if (clearFirst) {
        await element.fill(text);
      } else {
        await element.click();
        await this.page.keyboard.type(text);
      }
    } else {
      if (clearFirst) {
        await this.page.keyboard.press("Control+a");
      }
      await this.page.keyboard.type(text);
    }

    return { success: true };
  }

  private async executeScroll(
    input: Record<string, unknown>,
  ): Promise<ActionResult> {
    const direction = input.direction as string;
    const amount = (input.amount as number) ?? 300;

    const deltaX =
      direction === "left" ? -amount : direction === "right" ? amount : 0;
    const deltaY =
      direction === "up" ? -amount : direction === "down" ? amount : 0;

    await this.page.mouse.wheel(deltaX, deltaY);
    return { success: true };
  }

  private async executeNavigate(
    input: Record<string, unknown>,
  ): Promise<ActionResult> {
    const url = input.url as string;
    await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    return { success: true };
  }

  private async executeKeyboard(
    input: Record<string, unknown>,
  ): Promise<ActionResult> {
    const key = input.key as string;
    await this.page.keyboard.press(key);
    return { success: true };
  }

  private async executeWait(
    input: Record<string, unknown>,
  ): Promise<ActionResult> {
    const ms = (input.ms as number) ?? 1000;
    await new Promise((resolve) => setTimeout(resolve, ms));
    return { success: true };
  }

  private async executeHover(
    input: Record<string, unknown>,
  ): Promise<ActionResult> {
    const ref = input.ref as string | undefined;
    const x = input.x as number | undefined;
    const y = input.y as number | undefined;

    if (ref) {
      const element = await this.resolveRef(ref);
      if (!element) {
        return { success: false, error: `Ref "${ref}" not found` };
      }
      await element.hover();
      return { success: true };
    }

    if (x !== undefined && y !== undefined) {
      await this.page.mouse.move(x, y);
      return { success: true };
    }

    return { success: false, error: "hover requires ref or x,y coordinates" };
  }

  private async executeSelect(
    input: Record<string, unknown>,
  ): Promise<ActionResult> {
    const ref = input.ref as string;
    const value = input.value as string;

    const element = await this.resolveRef(ref);
    if (!element) {
      return { success: false, error: `Ref "${ref}" not found` };
    }

    // Try selecting by value first, then by label
    await element.selectOption({ value }).catch(async () => {
      await element.selectOption({ label: value });
    });

    return { success: true };
  }
}
