import { describe, it, expect, vi } from "vitest";
import { AGENT_TOOLS, ActionExecutor } from "./tools.js";
import type { AgentAction } from "./types.js";

// Mock page and element
function createMockPage() {
  return {
    mouse: {
      click: vi.fn(),
      wheel: vi.fn(),
      move: vi.fn(),
    },
    keyboard: {
      type: vi.fn(),
      press: vi.fn(),
    },
    goto: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function createMockElement() {
  return {
    click: vi.fn(),
    fill: vi.fn(),
    hover: vi.fn(),
    selectOption: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("AGENT_TOOLS", () => {
  it("contains all expected tool names", () => {
    const names = AGENT_TOOLS.map((t) => t.name);
    expect(names).toContain("click");
    expect(names).toContain("type");
    expect(names).toContain("scroll");
    expect(names).toContain("navigate");
    expect(names).toContain("keyboard");
    expect(names).toContain("wait");
    expect(names).toContain("hover");
    expect(names).toContain("select");
    expect(names).toContain("done");
    expect(names).toContain("fail");
  });

  it("each tool has valid schema", () => {
    for (const tool of AGENT_TOOLS) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.input_schema.type).toBe("object");
    }
  });
});

describe("ActionExecutor", () => {
  it("clicks by ref", async () => {
    const page = createMockPage();
    const element = createMockElement();
    const resolver = vi.fn().mockResolvedValue(element);
    const executor = new ActionExecutor(page, resolver);

    const result = await executor.execute({
      name: "click",
      input: { ref: "e5" },
    });

    expect(result.success).toBe(true);
    expect(resolver).toHaveBeenCalledWith("e5");
    expect(element.click).toHaveBeenCalledWith({ button: "left" });
  });

  it("clicks by coordinates", async () => {
    const page = createMockPage();
    const resolver = vi.fn();
    const executor = new ActionExecutor(page, resolver);

    const result = await executor.execute({
      name: "click",
      input: { x: 100, y: 200 },
    });

    expect(result.success).toBe(true);
    expect(page.mouse.click).toHaveBeenCalledWith(100, 200, { button: "left" });
  });

  it("fails click without ref or coords", async () => {
    const page = createMockPage();
    const resolver = vi.fn();
    const executor = new ActionExecutor(page, resolver);

    const result = await executor.execute({
      name: "click",
      input: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("requires ref or x,y");
  });

  it("types text with ref and clear_first", async () => {
    const page = createMockPage();
    const element = createMockElement();
    const resolver = vi.fn().mockResolvedValue(element);
    const executor = new ActionExecutor(page, resolver);

    const result = await executor.execute({
      name: "type",
      input: { ref: "e3", text: "hello", clear_first: true },
    });

    expect(result.success).toBe(true);
    expect(element.fill).toHaveBeenCalledWith("hello");
  });

  it("types text without ref", async () => {
    const page = createMockPage();
    const resolver = vi.fn();
    const executor = new ActionExecutor(page, resolver);

    const result = await executor.execute({
      name: "type",
      input: { text: "hello" },
    });

    expect(result.success).toBe(true);
    expect(page.keyboard.type).toHaveBeenCalledWith("hello");
  });

  it("scrolls down", async () => {
    const page = createMockPage();
    const resolver = vi.fn();
    const executor = new ActionExecutor(page, resolver);

    const result = await executor.execute({
      name: "scroll",
      input: { direction: "down", amount: 500 },
    });

    expect(result.success).toBe(true);
    expect(page.mouse.wheel).toHaveBeenCalledWith(0, 500);
  });

  it("navigates to URL", async () => {
    const page = createMockPage();
    const resolver = vi.fn();
    const executor = new ActionExecutor(page, resolver);

    const result = await executor.execute({
      name: "navigate",
      input: { url: "https://example.com" },
    });

    expect(result.success).toBe(true);
    expect(page.goto).toHaveBeenCalledWith("https://example.com", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
  });

  it("presses keyboard shortcut", async () => {
    const page = createMockPage();
    const resolver = vi.fn();
    const executor = new ActionExecutor(page, resolver);

    const result = await executor.execute({
      name: "keyboard",
      input: { key: "Enter" },
    });

    expect(result.success).toBe(true);
    expect(page.keyboard.press).toHaveBeenCalledWith("Enter");
  });

  it("waits specified duration", async () => {
    const page = createMockPage();
    const resolver = vi.fn();
    const executor = new ActionExecutor(page, resolver);

    const start = Date.now();
    const result = await executor.execute({
      name: "wait",
      input: { ms: 50 },
    });

    expect(result.success).toBe(true);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40); // allow some tolerance
  });

  it("hovers by ref", async () => {
    const page = createMockPage();
    const element = createMockElement();
    const resolver = vi.fn().mockResolvedValue(element);
    const executor = new ActionExecutor(page, resolver);

    const result = await executor.execute({
      name: "hover",
      input: { ref: "e2" },
    });

    expect(result.success).toBe(true);
    expect(element.hover).toHaveBeenCalled();
  });

  it("returns success for terminal actions", async () => {
    const page = createMockPage();
    const resolver = vi.fn();
    const executor = new ActionExecutor(page, resolver);

    expect(
      (await executor.execute({ name: "done", input: { success: true, summary: "ok" } })).success,
    ).toBe(true);
    expect(
      (await executor.execute({ name: "fail", input: { reason: "broken" } })).success,
    ).toBe(true);
  });

  it("returns error for unknown actions", async () => {
    const page = createMockPage();
    const resolver = vi.fn();
    const executor = new ActionExecutor(page, resolver);

    const result = await executor.execute({
      name: "unknown_action",
      input: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown action");
  });

  it("handles errors gracefully", async () => {
    const page = createMockPage();
    page.goto.mockRejectedValue(new Error("net::ERR_CONNECTION_REFUSED"));
    const resolver = vi.fn();
    const executor = new ActionExecutor(page, resolver);

    const result = await executor.execute({
      name: "navigate",
      input: { url: "https://broken.example" },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("ERR_CONNECTION_REFUSED");
  });

  it("fails click when ref not found", async () => {
    const page = createMockPage();
    const resolver = vi.fn().mockResolvedValue(null);
    const executor = new ActionExecutor(page, resolver);

    const result = await executor.execute({
      name: "click",
      input: { ref: "e99" },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });
});
