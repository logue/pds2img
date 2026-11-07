/** Reads one raw sample at the given byte offset. */
type SampleGetter = (view: DataView, offset: number, littleEndian: boolean) => number;

/**
 * Low-level sample reader for PDS3 image data.
 *
 * The decoding strategy is derived from the PDS3 `SAMPLE_TYPE` and
 * `SAMPLE_BITS` keywords once, so per-pixel reads stay cheap.
 *
 * Supported sample types:
 * - Integers: `MSB_INTEGER`, `LSB_INTEGER`, `UNSIGNED_INTEGER`, `MSB_UNSIGNED_INTEGER`,
 *   `LSB_UNSIGNED_INTEGER`, `PC_*`, `SUN_*`, `MAC_*`, `VAX_*` integer variants (8/16/32 bit)
 * - Reals: `IEEE_REAL`, `MSB_REAL`, `PC_REAL`, `LSB_REAL` (32/64 bit)
 */
export class BinaryReader {
  private readonly view: DataView;
  private readonly littleEndian: boolean;
  private readonly getter: SampleGetter;

  /** Number of bytes occupied by a single sample. */
  readonly bytesPerSample: number;

  /**
   * @param buffer - Raw image buffer.
   * @param sampleType - Value of the PDS3 `SAMPLE_TYPE` keyword.
   * @param bits - Value of the PDS3 `SAMPLE_BITS` keyword.
   * @throws {RangeError} If the combination is not supported.
   */
  constructor(buffer: ArrayBuffer, sampleType: string, bits: number) {
    const type = sampleType.toUpperCase();

    this.view = new DataView(buffer);
    this.littleEndian = /LSB|PC_|VAX_/.test(type);
    this.getter = BinaryReader.resolveGetter(type, bits);
    this.bytesPerSample = bits / 8;
  }

  private static resolveGetter(type: string, bits: number): SampleGetter {
    if (type.includes('VAX') && type.includes('REAL')) {
      throw new RangeError(`Unsupported SAMPLE_TYPE: ${type}`);
    }

    if (type.includes('REAL')) {
      if (bits === 32) return (view, offset, le) => view.getFloat32(offset, le);
      if (bits === 64) return (view, offset, le) => view.getFloat64(offset, le);
    } else {
      const signed = !type.includes('UNSIGNED');
      switch (bits) {
        case 8: {
          return signed
            ? (view, offset) => view.getInt8(offset)
            : (view, offset) => view.getUint8(offset);
        }
        case 16: {
          return signed
            ? (view, offset, le) => view.getInt16(offset, le)
            : (view, offset, le) => view.getUint16(offset, le);
        }
        case 32: {
          return signed
            ? (view, offset, le) => view.getInt32(offset, le)
            : (view, offset, le) => view.getUint32(offset, le);
        }
      }
    }

    throw new RangeError(`Unsupported SAMPLE_BITS ${String(bits)} for SAMPLE_TYPE ${type}`);
  }

  /**
   * Reads a raw (unscaled) sample at the given byte offset.
   *
   * @param offset - Byte offset within the buffer.
   */
  read(offset: number): number {
    return this.getter(this.view, offset, this.littleEndian);
  }
}
