import sharp from "sharp";

export interface FrameSamplerConfig {
  /** Pixel difference threshold 0-1 (default: 0.05 = 5%) */
  diffThreshold?: number;
  /** Thumbnail size for comparison (default: 16) */
  thumbnailSize?: number;
}

/**
 * Adaptive frame sampler that detects visual changes between frames.
 * Uses perceptual hashing on downscaled grayscale thumbnails for fast comparison.
 */
export class FrameSampler {
  private lastThumbnail: Buffer | null = null;
  private diffThreshold: number;
  private thumbnailSize: number;
  private consecutiveSkips = 0;
  private forceNextCapture = false;

  constructor(config?: FrameSamplerConfig) {
    this.diffThreshold = config?.diffThreshold ?? 0.05;
    this.thumbnailSize = config?.thumbnailSize ?? 16;
  }

  /**
   * Check if the current frame has changed enough from the last one to warrant processing.
   * @param frameBuffer - Raw JPEG/PNG image buffer
   * @returns true if the frame should be processed (is sufficiently different)
   */
  async hasChanged(frameBuffer: Buffer): Promise<boolean> {
    // Force capture if requested (e.g., after navigation)
    if (this.forceNextCapture) {
      this.forceNextCapture = false;
      this.lastThumbnail = await this.makeThumbnail(frameBuffer);
      this.consecutiveSkips = 0;
      return true;
    }

    const thumbnail = await this.makeThumbnail(frameBuffer);

    if (!this.lastThumbnail) {
      this.lastThumbnail = thumbnail;
      this.consecutiveSkips = 0;
      return true;
    }

    const diff = this.computeDiff(this.lastThumbnail, thumbnail);

    if (diff > this.diffThreshold) {
      this.lastThumbnail = thumbnail;
      this.consecutiveSkips = 0;
      return true;
    }

    this.consecutiveSkips++;

    // Even if frame looks the same, force a capture every 5 skips
    // to avoid missing subtle changes the thumbnail can't detect
    if (this.consecutiveSkips >= 5) {
      this.lastThumbnail = thumbnail;
      this.consecutiveSkips = 0;
      return true;
    }

    return false;
  }

  /** Force the next hasChanged() call to return true */
  forceCapture(): void {
    this.forceNextCapture = true;
  }

  /** Reset state (e.g., after page navigation) */
  reset(): void {
    this.lastThumbnail = null;
    this.consecutiveSkips = 0;
    this.forceNextCapture = false;
  }

  /** Get the number of consecutive frames that were skipped */
  getConsecutiveSkips(): number {
    return this.consecutiveSkips;
  }

  private async makeThumbnail(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .resize(this.thumbnailSize, this.thumbnailSize, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer();
  }

  private computeDiff(a: Buffer, b: Buffer): number {
    const pixelCount = Math.min(a.length, b.length);
    if (pixelCount === 0) return 1;

    let diffPixels = 0;
    for (let i = 0; i < pixelCount; i++) {
      // Threshold of 25 per pixel to ignore JPEG compression noise
      if (Math.abs(a[i]! - b[i]!) > 25) {
        diffPixels++;
      }
    }

    return diffPixels / pixelCount;
  }
}
