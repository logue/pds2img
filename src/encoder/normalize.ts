/** Largest value representable by a 16-bit unsigned sample. */
const UINT16_MAX = 65_535;

/**
 * Validates that `pixels` matches the given dimensions.
 *
 * @throws {RangeError} If the dimensions are invalid or do not match the pixel count.
 */
export function assertPixelDimensions(pixels: Float32Array, width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError(`Invalid image size: ${String(width)}×${String(height)}`);
  }
  if (pixels.length !== width * height) {
    throw new RangeError(
      `Pixel count ${String(pixels.length)} does not match ${String(width)}×${String(height)}`
    );
  }
}

/**
 * Linearly maps pixel values from their finite min/max range to `[0, 65535]`.
 *
 * Non-finite values (`NaN`, `±Infinity`, e.g. from `INVALID_CONSTANT`) are
 * excluded from the range calculation and written as `0`.
 * A constant image maps to all zeros.
 *
 * @param pixels - Row-major pixel values.
 * @returns 16-bit samples in the same order.
 */
export function normalizeToUint16(pixels: Float32Array): Uint16Array {
  let min = Infinity;
  let max = -Infinity;

  for (const value of pixels) {
    if (Number.isFinite(value)) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }

  const out = new Uint16Array(pixels.length);

  // No finite samples, or a constant image: everything maps to zero.
  if (!(max > min)) {
    return out;
  }

  const scale = UINT16_MAX / (max - min);

  for (let index = 0; index < pixels.length; index++) {
    const value = pixels[index];
    if (Number.isFinite(value)) {
      out[index] = Math.min(UINT16_MAX, Math.max(0, Math.round((value - min) * scale)));
    }
  }

  return out;
}
