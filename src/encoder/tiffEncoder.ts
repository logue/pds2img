import { assertPixelDimensions, normalizeToUint16 } from './normalize';

/** TIFF field type codes. */
const SHORT = 3;
const LONG = 4;

/** TIFF tags written by this encoder, in ascending order as required by the spec. */
const TAG = {
  ImageWidth: 256,
  ImageLength: 257,
  BitsPerSample: 258,
  Compression: 259,
  PhotometricInterpretation: 262,
  StripOffsets: 273,
  SamplesPerPixel: 277,
  RowsPerStrip: 278,
  StripByteCounts: 279
} as const;

/** Size of the TIFF header in bytes. */
const HEADER_SIZE = 8;
/** Size of a single IFD entry in bytes. */
const IFD_ENTRY_SIZE = 12;

/**
 * Encodes pixel data as an uncompressed 16-bit grayscale TIFF file.
 *
 * Pixel values are linearly normalized from their finite min/max range to
 * `[0, 65535]`; non-finite values are written as `0`.
 * The output uses little-endian (Intel) byte order and a single strip.
 *
 * @param pixels - Row-major Float32Array of pixel values (length = width × height)
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @returns ArrayBuffer containing a valid TIFF file
 * @throws {RangeError} If the dimensions do not match `pixels`.
 */
export function encodeToTIFF(pixels: Float32Array, width: number, height: number): ArrayBuffer {
  assertPixelDimensions(pixels, width, height);
  const samples = normalizeToUint16(pixels);

  const imageDataSize = samples.length * 2;
  const entries: [tag: number, type: number, value: number][] = [
    [TAG.ImageWidth, LONG, width],
    [TAG.ImageLength, LONG, height],
    [TAG.BitsPerSample, SHORT, 16],
    [TAG.Compression, SHORT, 1], // none
    [TAG.PhotometricInterpretation, SHORT, 1], // BlackIsZero
    [TAG.StripOffsets, LONG, 0], // patched below
    [TAG.SamplesPerPixel, SHORT, 1],
    [TAG.RowsPerStrip, LONG, height],
    [TAG.StripByteCounts, LONG, imageDataSize]
  ];

  // Layout: header → IFD (count + entries + next-IFD pointer) → image data
  const ifdSize = 2 + entries.length * IFD_ENTRY_SIZE + 4;
  const imageDataOffset = HEADER_SIZE + ifdSize;

  const buffer = new ArrayBuffer(imageDataOffset + imageDataSize);
  const view = new DataView(buffer);

  // Header: 'II' (little-endian), magic 42, offset of first IFD.
  view.setUint16(0, 0x49_49);
  view.setUint16(2, 42, true);
  view.setUint32(4, HEADER_SIZE, true);

  view.setUint16(HEADER_SIZE, entries.length, true);
  let pos = HEADER_SIZE + 2;

  for (const [tag, type, value] of entries) {
    view.setUint16(pos, tag, true);
    view.setUint16(pos + 2, type, true);
    view.setUint32(pos + 4, 1, true); // count
    // SHORT/LONG values with count=1 fit directly in the 4-byte value field.
    const resolved = tag === TAG.StripOffsets ? imageDataOffset : value;
    if (type === SHORT) {
      view.setUint16(pos + 8, resolved, true);
    } else {
      view.setUint32(pos + 8, resolved, true);
    }
    pos += IFD_ENTRY_SIZE;
  }

  // Next IFD offset = 0 (no further IFDs).
  view.setUint32(pos, 0, true);

  for (const [index, sample] of samples.entries()) {
    view.setUint16(imageDataOffset + index * 2, sample, true);
  }

  return buffer;
}
