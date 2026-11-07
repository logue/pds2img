import type { PDSImage } from '@/types/PDSImage';

/**
 * Shared implementation for PDS image products.
 * Subclasses only need to describe geometry and how a single pixel is decoded.
 */
export abstract class PDSImageBase implements PDSImage {
  abstract readonly width: number;
  abstract readonly height: number;

  abstract getPixel(x: number, y: number): number;

  toFloat32Array(): Float32Array {
    const { width, height } = this;
    const out = new Float32Array(width * height);

    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        out[row + x] = this.getPixel(x, y);
      }
    }

    return out;
  }
}

/**
 * Asserts that an image dimension read from a label is a positive integer.
 *
 * @param name - Human readable name used in the error message.
 * @param value - Value read from the label.
 * @returns The validated value.
 * @throws {RangeError} If `value` is not a positive integer.
 */
export function assertDimension(name: string, value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`Invalid image ${name}: ${String(value)}`);
  }
  return value;
}

/**
 * Asserts that the buffer is large enough to hold the described image.
 *
 * @param buffer - Image data buffer.
 * @param requiredBytes - Byte offset of the last byte the image needs, plus one.
 * @throws {RangeError} If the buffer is too small.
 */
export function assertBufferSize(buffer: ArrayBuffer, requiredBytes: number): void {
  if (buffer.byteLength < requiredBytes) {
    throw new RangeError(
      `Image data is truncated: expected at least ${String(requiredBytes)} bytes but got ${String(buffer.byteLength)}`
    );
  }
}
