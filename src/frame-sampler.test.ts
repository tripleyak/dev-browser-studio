import { describe, it, expect, beforeEach } from "vitest";
import sharp from "sharp";
import { FrameSampler } from "./frame-sampler.js";

async function createTestFrame(
  r: number,
  g: number,
  b: number,
  width = 64,
  height = 64,
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r, g, b },
    },
  })
    .jpeg({ quality: 70 })
    .toBuffer();
}

describe("FrameSampler", () => {
  let sampler: FrameSampler;

  beforeEach(() => {
    sampler = new FrameSampler({ diffThreshold: 0.05 });
  });

  it("returns true for the first frame", async () => {
    const frame = await createTestFrame(128, 128, 128);
    expect(await sampler.hasChanged(frame)).toBe(true);
  });

  it("returns false for identical frames", async () => {
    const frame = await createTestFrame(128, 128, 128);
    await sampler.hasChanged(frame); // first
    expect(await sampler.hasChanged(frame)).toBe(false); // same
  });

  it("returns true for significantly different frames", async () => {
    const frame1 = await createTestFrame(0, 0, 0);
    const frame2 = await createTestFrame(255, 255, 255);
    await sampler.hasChanged(frame1);
    expect(await sampler.hasChanged(frame2)).toBe(true);
  });

  it("forces capture when forceCapture is called", async () => {
    const frame = await createTestFrame(128, 128, 128);
    await sampler.hasChanged(frame);
    await sampler.hasChanged(frame); // skip
    sampler.forceCapture();
    expect(await sampler.hasChanged(frame)).toBe(true);
  });

  it("forces capture after 5 consecutive skips", async () => {
    const frame = await createTestFrame(128, 128, 128);
    await sampler.hasChanged(frame); // first — true

    // 4 skips
    for (let i = 0; i < 4; i++) {
      expect(await sampler.hasChanged(frame)).toBe(false);
    }

    // 5th skip triggers forced capture
    expect(await sampler.hasChanged(frame)).toBe(true);
  });

  it("reset clears state", async () => {
    const frame = await createTestFrame(128, 128, 128);
    await sampler.hasChanged(frame);
    sampler.reset();
    // After reset, next frame is treated as first
    expect(await sampler.hasChanged(frame)).toBe(true);
  });

  it("tracks consecutive skips", async () => {
    const frame = await createTestFrame(128, 128, 128);
    await sampler.hasChanged(frame);
    expect(sampler.getConsecutiveSkips()).toBe(0);

    await sampler.hasChanged(frame); // skip
    expect(sampler.getConsecutiveSkips()).toBe(1);

    await sampler.hasChanged(frame); // skip
    expect(sampler.getConsecutiveSkips()).toBe(2);
  });
});
