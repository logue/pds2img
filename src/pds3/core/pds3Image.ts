import { BinaryReader } from './binaryReader';

import type { PDSLabel, PDSQuantity, PDSValue } from '@/pds3/parser/types';

import { assertBufferSize, assertDimension, PDSImageBase } from '@/core/pdsImageBase';

/** Returns `true` if `value` is a `{ value, unit }` quantity. */
function isQuantity(value: PDSValue | undefined): value is PDSQuantity {
  return (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'unit' in value &&
    'value' in value &&
    Object.keys(value).length === 2
  );
}

/** Returns `true` if `value` is a nested `OBJECT` / `GROUP` dictionary. */
function isBlock(value: PDSValue | undefined): value is PDSLabel {
  return typeof value === 'object' && !Array.isArray(value) && !isQuantity(value);
}

/**
 * Unwraps a `{ value, unit }` quantity and asserts the result is numeric.
 *
 * @param value - Raw {@link PDSValue} read from a parsed LBL label.
 * @param name - Keyword name used in the error message.
 * @param fallback - Value to return when `value` is missing; omit to require a number.
 * @throws {TypeError} If `value` is not numeric and no `fallback` is given.
 */
function asNumber(value: PDSValue | undefined, name: string, fallback?: number): number {
  const resolved = isQuantity(value) ? value.value : value;

  if (typeof resolved === 'number') {
    return resolved;
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new TypeError(`Expected a numeric ${name} but got: ${JSON.stringify(value)}`);
}

/** Like {@link asNumber} but returns `undefined` when the value is absent or not numeric. */
function asOptionalNumber(value: PDSValue | undefined): number | undefined {
  const resolved = isQuantity(value) ? value.value : value;
  return typeof resolved === 'number' ? resolved : undefined;
}

/** Depth-first search for the first `IMAGE` object in the label. */
function findImageObject(label: PDSLabel): PDSLabel | undefined {
  if (isBlock(label.IMAGE)) {
    return label.IMAGE;
  }

  for (const value of Object.values(label)) {
    if (isBlock(value)) {
      const found = findImageObject(value);
      if (found) return found;
    }
  }

  return undefined;
}

/**
 * Resolves the `^IMAGE` pointer to a zero-based byte offset.
 *
 * Supported forms:
 * - `^IMAGE = 12` / `^IMAGE = 12 <RECORDS>` (record number, 1-based)
 * - `^IMAGE = 4097 <BYTES>` (byte number, 1-based)
 * - `^IMAGE = "FILE.IMG"` (data starts at the beginning of the file)
 * - `^IMAGE = ("FILE.IMG", 12)` / `("FILE.IMG", 4097 <BYTES>)`
 */
function resolveImageByteOffset(label: PDSLabel): number {
  const pointer = label['^IMAGE'] as PDSValue | undefined;

  if (pointer === undefined) {
    throw new Error('^IMAGE pointer not found in label');
  }

  // In the `("FILE.IMG", 12)` form the location is the last non-string element.
  const location = Array.isArray(pointer)
    ? (pointer.findLast(value => typeof value !== 'string') ?? 0)
    : pointer;

  if (typeof location === 'string') {
    return 0;
  }

  if (isQuantity(location) && location.unit.toUpperCase() === 'BYTES') {
    return asNumber(location.value, '^IMAGE') - 1;
  }

  const record = asNumber(location, '^IMAGE');
  return record === 0 ? 0 : (record - 1) * asNumber(label.RECORD_BYTES, 'RECORD_BYTES');
}

/**
 * Parses and provides pixel-level access to a PDS3 image.
 *
 * A PDS3 product consists of a text label (parsed by {@link parseLBL}) and
 * binary image data, either in a separate file (detached label) or in the
 * same file (attached label). The constructor reads geometry and scaling
 * parameters from the first `IMAGE` object in the label.
 */
export class PDS3Image extends PDSImageBase {
  readonly width: number;
  readonly height: number;
  /** Sample bit depth (`SAMPLE_BITS`). */
  readonly bits: number;

  private readonly reader: BinaryReader;
  private readonly imageOffset: number;
  private readonly prefixBytes: number;
  private readonly lineBytes: number;
  private readonly scaling: number;
  private readonly offset: number;
  private readonly invalidValues: ReadonlySet<number>;

  /**
   * @param label - Parsed PDS3 label.
   * @param buffer - Image data. For attached labels pass the whole file.
   * @throws {Error} If the label has no `IMAGE` object or the data is truncated.
   */
  constructor(label: PDSLabel, buffer: ArrayBuffer) {
    super();

    const image = findImageObject(label);
    if (!image) {
      throw new Error('IMAGE object not found in label');
    }

    this.width = assertDimension(
      'width (LINE_SAMPLES)',
      asNumber(image.LINE_SAMPLES, 'LINE_SAMPLES')
    );
    this.height = assertDimension('height (LINES)', asNumber(image.LINES, 'LINES'));
    this.bits = asNumber(image.SAMPLE_BITS, 'SAMPLE_BITS');

    const sampleType = typeof image.SAMPLE_TYPE === 'string' ? image.SAMPLE_TYPE : 'MSB_INTEGER';
    this.reader = new BinaryReader(buffer, sampleType, this.bits);

    this.prefixBytes = asNumber(image.LINE_PREFIX_BYTES, 'LINE_PREFIX_BYTES', 0);
    const suffixBytes = asNumber(image.LINE_SUFFIX_BYTES, 'LINE_SUFFIX_BYTES', 0);
    this.lineBytes = this.prefixBytes + this.width * this.reader.bytesPerSample + suffixBytes;

    this.scaling = asNumber(image.SCALING_FACTOR, 'SCALING_FACTOR', 1);
    this.offset = asNumber(image.OFFSET, 'OFFSET', 0);

    this.invalidValues = new Set(
      [image.INVALID_CONSTANT, image.MISSING_CONSTANT]
        .map(value => asOptionalNumber(value))
        .filter((value): value is number => value !== undefined)
    );

    this.imageOffset = resolveImageByteOffset(label);
    assertBufferSize(buffer, this.imageOffset + this.height * this.lineBytes - suffixBytes);
  }

  /**
   * Returns the calibrated pixel value at column `x`, row `y`:
   * `raw × SCALING_FACTOR + OFFSET`. Samples equal to `INVALID_CONSTANT`
   * or `MISSING_CONSTANT` are returned as `NaN`.
   *
   * @param x - Zero-based column index.
   * @param y - Zero-based row index.
   */
  getPixel(x: number, y: number): number {
    const position =
      this.imageOffset + y * this.lineBytes + this.prefixBytes + x * this.reader.bytesPerSample;
    const raw = this.reader.read(position);

    if (this.invalidValues.has(raw)) {
      return NaN;
    }

    return raw * this.scaling + this.offset;
  }
}
