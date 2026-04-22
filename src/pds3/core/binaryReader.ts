/**
 * Low-level binary reader for PDS3 image data.
 * Supports 8-bit and 16-bit sample reads with configurable byte order
 * determined by the `SAMPLE_TYPE` keyword in the LBL label.
 */
export class BinaryReader {
  private readonly view: DataView;
  private readonly littleEndian: boolean;

  /**
   * @param buffer - Raw image buffer.
   * @param sampleType - Value of the PDS3 `SAMPLE_TYPE` keyword
   *   (e.g. `'MSB_INTEGER'`, `'LSB_INTEGER'`).
   */
  constructor(buffer: ArrayBuffer, sampleType: string) {
    this.view = new DataView(buffer);
    this.littleEndian = sampleType.includes('LSB');
  }

  /**
   * Reads an unsigned integer sample at the given byte offset.
   *
   * @param offset - Byte offset within the buffer.
   * @param bits - Sample bit-depth (8 or 16).
   * @returns Raw (unscaled) sample value.
   * @throws If `bits` is not 8 or 16.
   */
  read(offset: number, bits: number): number {
    if (bits === 8) {
      return this.view.getUint8(offset);
    }

    if (bits === 16) {
      return this.view.getUint16(offset, this.littleEndian);
    }

    throw new Error(`Unsupported bits: ${bits}`);
  }
}
