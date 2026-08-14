import type { PDSImage } from '@/interfaces/PdsImage';
import type { PDSLabel, PDSValue } from '@/pds3/parser/types';

import { BinaryReader } from './binaryReader';

/**
 * Unwraps a `{ value, unit }` quantity and asserts the result is numeric.
 *
 * @param value - Raw {@link PDSValue} read from a parsed LBL label.
 * @param fallback - Value to return when `value` is not numeric; omit to require a number.
 * @returns The resolved numeric value.
 * @throws {TypeError} If `value` is not numeric and no `fallback` is given.
 */
function asNumber(value: PDSValue | undefined, fallback?: number): number {
  const resolved =
    typeof value === 'object' && value !== null && 'value' in value
      ? value.value
      : value;

  if (typeof resolved === 'number') {
    return resolved;
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new TypeError(
    `Expected a numeric PDS value but got: ${JSON.stringify(value)}`,
  );
}

/**
 * Parses and provides pixel-level access to a PDS3 image.
 *
 * A PDS3 dataset consists of a text LBL label (parsed by {@link parseLBL})
 * and a binary image file. The constructor reads geometry and scaling
 * parameters from the label and validates that the IMAGE object exists.
 */
export class PDS3Image implements PDSImage {
  private readonly reader: BinaryReader;

  width: number;
  height: number;
  bits: number;

  private readonly prefix: number;
  private readonly scaling: number;
  private readonly offset: number;
  private readonly invalidConstant: number | undefined;
  private readonly imageOffset: number;

  /**
   * Compiles a PDS3 image from the given LBL metadata and binary data.
   * @param label PDS LBL data.
   * @param buffer PDS Image Data.
   */
  constructor(label: PDSLabel, buffer: ArrayBuffer) {
    const image = this.findImageObject(label);

    this.width = asNumber(image.LINE_SAMPLES);
    this.height = asNumber(image.LINES);
    this.bits = asNumber(image.SAMPLE_BITS);

    this.prefix = asNumber(image.LINE_PREFIX_BYTES, 0);
    this.scaling = asNumber(image.SCALING_FACTOR, 1);
    this.offset = asNumber(image.OFFSET, 0);
    this.invalidConstant =
      typeof image.INVALID_CONSTANT === 'number'
        ? image.INVALID_CONSTANT
        : undefined;

    const sampleType =
      typeof image.SAMPLE_TYPE === 'string' ? image.SAMPLE_TYPE : 'MSB_INTEGER';

    this.reader = new BinaryReader(buffer, sampleType);

    const recordBytes = asNumber(label.RECORD_BYTES);
    const ptr = this.resolveImagePointerRecord(label['^IMAGE']);

    this.imageOffset = (ptr - 1) * recordBytes;
  }

  private resolveImagePointerRecord(pointer: PDSValue): number {
    if (typeof pointer === 'number') {
      return pointer;
    }

    if (
      typeof pointer === 'object' &&
      pointer !== null &&
      'value' in pointer &&
      Object.keys(pointer).length === 2 &&
      'unit' in pointer
    ) {
      return this.resolveImagePointerRecord(
        (
          pointer as {
            value: PDSValue;
            unit: string;
          }
        ).value,
      );
    }

    if (Array.isArray(pointer)) {
      const record = [
        ...pointer,
      ]
        .reverse()
        .find((value) => typeof value === 'number');

      if (typeof record === 'number') {
        return record;
      }
    }

    throw new TypeError(
      `Unsupported ^IMAGE pointer format: ${JSON.stringify(pointer)}`,
    );
  }

  private findImageObject(obj: PDSLabel): PDSLabel {
    if (
      typeof obj.IMAGE === 'object' &&
      obj.IMAGE !== null &&
      !Array.isArray(obj.IMAGE)
    ) {
      return obj.IMAGE as PDSLabel;
    }

    for (const value of Object.values(obj)) {
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        const found = this.findImageObject(value as PDSLabel);
        if (found) {
          return found;
        }
      }
    }

    throw new Error('IMAGE object not found');
  }

  /**
   * Returns the calibrated pixel value at column `x`, row `y`.
   * The raw sample is multiplied by `SCALING_FACTOR` and offset by `OFFSET`.
   *
   * @param x - Zero-based column index.
   * @param y - Zero-based row index.
   */
  getPixel(x: number, y: number): number {
    const bytes = this.bits / 8;
    const lineBytes = this.width * bytes + this.prefix;

    const offset = this.imageOffset + y * lineBytes + this.prefix + x * bytes;

    const raw = this.reader.read(offset, this.bits);

    if (this.invalidConstant !== undefined && raw === this.invalidConstant) {
      return Number.NaN;
    }

    return raw * this.scaling + this.offset;
  }

  /**
   * Decodes all pixels into a row-major {@link Float32Array}.
   * The length equals `width × height`.
   */
  toFloat32Array(): Float32Array {
    const out = new Float32Array(this.width * this.height);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        out[y * this.width + x] = this.getPixel(x, y);
      }
    }

    return out;
  }
}
