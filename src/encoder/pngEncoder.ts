/** CRC-32 lookup table computed with the PNG/PKZIP polynomial 0xEDB88320. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

/**
 * Computes CRC-32 over a byte array, as required by the PNG specification.
 */
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (CRC_TABLE[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Computes Adler-32 checksum required by the zlib stream trailer.
 */
function adler32(data: Uint8Array): number {
  let s1 = 1;
  let s2 = 0;
  const MOD_ADLER = 65521;
  for (let i = 0; i < data.length; i++) {
    s1 = (s1 + data[i]!) % MOD_ADLER;
    s2 = (s2 + s1) % MOD_ADLER;
  }
  return ((s2 << 16) | s1) >>> 0;
}

/** PNG file-format signature (8 bytes). */
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * Writes a single PNG chunk (length + type + data + CRC-32) into `out`
 * starting at `offset`. Returns the byte offset immediately after the chunk.
 */
function writeChunk(
  out: Uint8Array,
  offset: number,
  type: string,
  data: Uint8Array,
): number {
  const view = new DataView(out.buffer);

  // 4-byte data length (big-endian)
  view.setUint32(offset, data.length);
  offset += 4;

  // 4-byte chunk type (ASCII)
  for (let i = 0; i < 4; i++) {
    out[offset + i] = type.charCodeAt(i);
  }
  offset += 4;

  // Chunk data
  out.set(data, offset);
  offset += data.length;

  // CRC-32 covers type bytes + data bytes (big-endian)
  const crcInput = new Uint8Array(4 + data.length);
  for (let i = 0; i < 4; i++) crcInput[i] = type.charCodeAt(i);
  crcInput.set(data, 4);
  view.setUint32(offset, crc32(crcInput));
  offset += 4;

  return offset;
}

/**
 * Encodes pixel data as a 16-bit grayscale PNG file.
 *
 * Pixel values are linearly normalized from their min/max range to [0, 65535].
 * Compression uses uncompressed DEFLATE stored-blocks (BTYPE=00) so no
 * compression library is required while still producing a fully valid PNG.
 *
 * @param pixels - Row-major Float32Array of pixel values (length = width × height)
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @returns ArrayBuffer containing a valid PNG file
 */
export function encodeToPNG(
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

  // Build raw scanline buffer: each row = [filter byte = 0] + [2 bytes/pixel, big-endian]
  const bytesPerRow = 1 + width * 2;
  const rawData = new Uint8Array(height * bytesPerRow);
  for (let y = 0; y < height; y++) {
    rawData[y * bytesPerRow] = 0; // filter method: None
    for (let x = 0; x < width; x++) {
      const v = Math.round(((pixels[y * width + x]! - min) / range) * 65535);
      const clamped = Math.max(0, Math.min(65535, v));
      const base = y * bytesPerRow + 1 + x * 2;
      rawData[base] = clamped >>> 8; // high byte (big-endian)
      rawData[base + 1] = clamped & 0xff; // low byte
    }
  }

  // Wrap raw data in a zlib stream using uncompressed DEFLATE stored blocks.
  // Each stored block is at most 65535 bytes.
  const MAX_BLOCK = 65535;
  const numBlocks = Math.max(1, Math.ceil(rawData.length / MAX_BLOCK));
  // Total deflate size: 2 (zlib header) + numBlocks * 5 (block headers) + data + 4 (adler32)
  const deflate = new Uint8Array(2 + numBlocks * 5 + rawData.length + 4);
  const dv = new DataView(deflate.buffer);

  // zlib header: CMF=0x78 (deflate, 32K window), FLG=0x9C (default compression)
  // Validity check: (0x78 * 256 + 0x9C) % 31 === 0 ✓
  deflate[0] = 0x78;
  deflate[1] = 0x9c;

  let pos = 2;
  for (let i = 0; i < numBlocks; i++) {
    const start = i * MAX_BLOCK;
    const end = Math.min(start + MAX_BLOCK, rawData.length);
    const len = end - start;
    // BFINAL=1 for last block, BTYPE=00 (stored) → byte value 0x01 or 0x00
    deflate[pos++] = i === numBlocks - 1 ? 0x01 : 0x00;
    dv.setUint16(pos, len, true);
    pos += 2; // LEN (little-endian)
    dv.setUint16(pos, ~len & 0xffff, true);
    pos += 2; // NLEN = one's complement of LEN
    deflate.set(rawData.subarray(start, end), pos);
    pos += len;
  }
  // Adler-32 checksum of the uncompressed data (big-endian)
  dv.setUint32(pos, adler32(rawData));

  // Assemble the PNG file: signature + IHDR + IDAT + IEND
  const IHDR_DATA_SIZE = 13;
  const totalSize =
    8 + // PNG signature
    (4 + 4 + IHDR_DATA_SIZE + 4) + // IHDR chunk
    (4 + 4 + deflate.length + 4) + // IDAT chunk
    (4 + 4 + 0 + 4); // IEND chunk

  const out = new Uint8Array(new ArrayBuffer(totalSize));
  out.set(PNG_SIGNATURE, 0);
  let off = 8;

  // IHDR: width, height, bit depth, color type, compression, filter, interlace
  const ihdr = new Uint8Array(IHDR_DATA_SIZE);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width); // big-endian
  ihdrView.setUint32(4, height); // big-endian
  ihdr[8] = 16; // bit depth: 16
  ihdr[9] = 0; // color type: grayscale
  // bytes 10–12: compression=0, filter=0, interlace=0 (already zero-initialized)
  off = writeChunk(out, off, 'IHDR', ihdr);

  // IDAT: zlib-compressed image data
  off = writeChunk(out, off, 'IDAT', deflate);

  // IEND: empty marker chunk
  writeChunk(out, off, 'IEND', new Uint8Array(0));

  return out.buffer;
}
