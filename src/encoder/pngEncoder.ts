import { assertPixelDimensions, normalizeToUint16 } from './normalize';

/** CRC-32 lookup table computed with the PNG/PKZIP polynomial 0xEDB88320. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xed_b8_83_20 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

/** Computes CRC-32 over a byte array, as required by the PNG specification. */
function crc32(data: Uint8Array): number {
  let crc = 0xff_ff_ff_ff;
  for (const byte of data) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xff_ff_ff_ff) >>> 0;
}

/** Computes the Adler-32 checksum required by the zlib stream trailer. */
function adler32(data: Uint8Array): number {
  const MOD_ADLER = 65_521;
  let s1 = 1;
  let s2 = 0;
  for (const byte of data) {
    s1 = (s1 + byte) % MOD_ADLER;
    s2 = (s2 + s1) % MOD_ADLER;
  }
  return ((s2 << 16) | s1) >>> 0;
}

/** PNG file-format signature (8 bytes). */
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/** Byte size of the IHDR chunk payload. */
const IHDR_DATA_SIZE = 13;

/** Maximum payload of a single DEFLATE stored block. */
const MAX_STORED_BLOCK = 65_535;

/** Per-chunk overhead: 4-byte length + 4-byte type + 4-byte CRC. */
const CHUNK_OVERHEAD = 12;

/**
 * Writes a single PNG chunk (length + type + data + CRC-32) into `out`
 * starting at `offset`.
 *
 * @returns The byte offset immediately after the chunk.
 */
function writeChunk(out: Uint8Array, offset: number, type: string, data: Uint8Array): number {
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);

  view.setUint32(offset, data.length);
  const typeStart = offset + 4;

  for (let index = 0; index < 4; index++) {
    out[typeStart + index] = type.codePointAt(index) ?? 0;
  }

  out.set(data, typeStart + 4);
  const dataEnd = typeStart + 4 + data.length;

  // CRC-32 covers the type bytes and the data bytes.
  view.setUint32(dataEnd, crc32(out.subarray(typeStart, dataEnd)));

  return dataEnd + 4;
}

/**
 * Wraps `raw` in a zlib stream made of uncompressed DEFLATE stored blocks (BTYPE=00).
 * This keeps the encoder dependency-free while still producing a valid PNG.
 */
function zlibStore(raw: Uint8Array): Uint8Array {
  const blockCount = Math.max(1, Math.ceil(raw.length / MAX_STORED_BLOCK));
  // 2 (zlib header) + 5 per block header + data + 4 (Adler-32)
  const out = new Uint8Array(2 + blockCount * 5 + raw.length + 4);
  const view = new DataView(out.buffer);

  // CMF=0x78 (deflate, 32K window), FLG=0x9C; (0x78 * 256 + 0x9C) % 31 === 0
  out[0] = 0x78;
  out[1] = 0x9c;

  let pos = 2;
  for (let index = 0; index < blockCount; index++) {
    const start = index * MAX_STORED_BLOCK;
    const end = Math.min(start + MAX_STORED_BLOCK, raw.length);
    const length = end - start;

    out[pos] = index === blockCount - 1 ? 0x01 : 0x00; // BFINAL + BTYPE=00
    view.setUint16(pos + 1, length, true); // LEN
    view.setUint16(pos + 3, ~length & 0xff_ff, true); // NLEN
    out.set(raw.subarray(start, end), pos + 5);
    pos += 5 + length;
  }

  view.setUint32(pos, adler32(raw));
  return out;
}

/**
 * Encodes pixel data as a 16-bit grayscale PNG file.
 *
 * Pixel values are linearly normalized from their finite min/max range to
 * `[0, 65535]`; non-finite values are written as `0`.
 *
 * @param pixels - Row-major Float32Array of pixel values (length = width × height)
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @returns ArrayBuffer containing a valid PNG file
 * @throws {RangeError} If the dimensions do not match `pixels`.
 */
export function encodeToPNG(pixels: Float32Array, width: number, height: number): ArrayBuffer {
  assertPixelDimensions(pixels, width, height);
  const samples = normalizeToUint16(pixels);

  // Each scanline: 1 filter byte (0 = None) + 2 big-endian bytes per pixel.
  const bytesPerRow = 1 + width * 2;
  const raw = new Uint8Array(height * bytesPerRow);
  const rawView = new DataView(raw.buffer);

  for (let y = 0; y < height; y++) {
    const rowStart = y * bytesPerRow + 1;
    const sampleStart = y * width;
    for (let x = 0; x < width; x++) {
      rawView.setUint16(rowStart + x * 2, samples[sampleStart + x]);
    }
  }

  const idat = zlibStore(raw);

  const ihdr = new Uint8Array(IHDR_DATA_SIZE);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr[8] = 16; // bit depth
  ihdr[9] = 0; // color type: grayscale
  // bytes 10–12: compression, filter and interlace methods are all 0.

  const out = new Uint8Array(
    PNG_SIGNATURE.length +
      (CHUNK_OVERHEAD + IHDR_DATA_SIZE) +
      (CHUNK_OVERHEAD + idat.length) +
      CHUNK_OVERHEAD
  );
  out.set(PNG_SIGNATURE, 0);

  let offset = PNG_SIGNATURE.length;
  offset = writeChunk(out, offset, 'IHDR', ihdr);
  offset = writeChunk(out, offset, 'IDAT', idat);
  writeChunk(out, offset, 'IEND', new Uint8Array(0));

  return out.buffer;
}
