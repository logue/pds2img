/** Common contract satisfied by both {@link PDS3Image} and {@link PDS4Image}. */
export interface PDSImage {
  /** Image width in pixels. */
  readonly width: number;
  /** Image height in pixels. */
  readonly height: number;
  /**
   * Returns the calibrated pixel value at column `x`, row `y`.
   * Invalid or missing samples are returned as `NaN`.
   */
  getPixel(x: number, y: number): number;
  /** Decodes all pixels into a row-major `Float32Array` of length `width × height`. */
  toFloat32Array(): Float32Array;
}
