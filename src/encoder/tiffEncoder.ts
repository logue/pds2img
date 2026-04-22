/**
 * Encodes pixel data as an uncompressed 16-bit grayscale TIFF file.
 * Pixel values are linearly normalized from their min/max range to [0, 65535].
 * The output uses little-endian (Intel) byte order.
 *
 * @param pixels - Row-major Float32Array of pixel values (length = width × height)
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @returns ArrayBuffer containing a valid TIFF file
 */
export function encodeToTIFF(
  pixels: Float32Array,
  width: number,
  height: number,
): ArrayBuffer {
  // Normalize pixel values to [0, 65535]
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < pixels.length; i++) {
    if (pixels[i]! < min) min = pixels[i]!;
    if (pixels[i]! > max) max = pixels[i]!;
  }
  const range = max === min ? 1 : max - min;

  // Layout: 8-byte header → IFD → image data
  const NUM_ENTRIES = 9;
  const ifdOffset = 8;
  // IFD: 2 (entry count) + NUM_ENTRIES * 12 (entries) + 4 (next IFD ptr = 0)
  const ifdSize = 2 + NUM_ENTRIES * 12 + 4;
  const imageDataOffset = ifdOffset + ifdSize;
  const imageDataSize = width * height * 2; // 16-bit per pixel
  const totalSize = imageDataOffset + imageDataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // TIFF header (little-endian)
  bytes[0] = 0x49;
  bytes[1] = 0x49; // 'II' = little-endian
  view.setUint16(2, 42, true); // magic number
  view.setUint32(4, ifdOffset, true); // offset to first IFD

  // IFD entry count
  view.setUint16(ifdOffset, NUM_ENTRIES, true);
  let pos = ifdOffset + 2;

  /**
   * Writes one 12-byte IFD entry at the current position.
   * For SHORT (type=3) and LONG (type=4) values with count=1 the value fits
   * directly in the 4-byte value field, so no extra data block is needed.
   */
  function writeEntry(
    tag: number,
    type: number,
    count: number,
    value: number,
  ): void {
    view.setUint16(pos, tag, true);
    view.setUint16(pos + 2, type, true);
    view.setUint32(pos + 4, count, true);
    view.setUint32(pos + 8, value, true);
    pos += 12;
  }

  // IFD entries must appear in ascending tag order (TIFF spec §2)
  writeEntry(256, 4, 1, width); // ImageWidth (LONG)
  writeEntry(257, 4, 1, height); // ImageLength (LONG)
  writeEntry(258, 3, 1, 16); // BitsPerSample = 16 (SHORT)
  writeEntry(259, 3, 1, 1); // Compression = None (SHORT)
  writeEntry(262, 3, 1, 1); // PhotometricInterpretation = BlackIsZero (SHORT)
  writeEntry(273, 4, 1, imageDataOffset); // StripOffsets (LONG)
  writeEntry(277, 3, 1, 1); // SamplesPerPixel = 1 (SHORT)
  writeEntry(278, 4, 1, height); // RowsPerStrip = height (LONG, one strip)
  writeEntry(279, 4, 1, imageDataSize); // StripByteCounts (LONG)

  // Next IFD offset = 0 (no further IFDs)
  view.setUint32(pos, 0, true);

  // Image data: 16-bit grayscale pixels, little-endian, row-major
  for (let i = 0; i < pixels.length; i++) {
    const normalized = Math.round(((pixels[i]! - min) / range) * 65535);
    const clamped = Math.max(0, Math.min(65535, normalized));
    view.setUint16(imageDataOffset + i * 2, clamped, true);
  }

  return buffer;
}
