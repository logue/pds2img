import { describe, test, expect, beforeAll } from '@rstest/core';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseLBL } from '../src/pds3/parser/lblParser';
import { PDS3Image } from '../src/pds3/core/pds3Image';
import { toPNG, toTIFF } from '../src/index';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data');
const TEST_IMAGE_BASE = 'C3592903_RAW'; // Voyager 1, Jupiter flyby, narrow-angle camera
/**
 * Reads a file in the test data directory into a plain ArrayBuffer.
 */
function loadBuffer(filename: string): ArrayBuffer {
  const buf = readFileSync(join(DATA_DIR, filename));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe('PDS3Image (Voyager 1 / C3592903_RAW)', () => {
  let image!: PDS3Image;

  beforeAll(() => {
    const lblBuffer = loadBuffer(`${TEST_IMAGE_BASE}.LBL`);
    const imgBuffer = loadBuffer(`${TEST_IMAGE_BASE}.IMG`);
    const label = parseLBL(lblBuffer);
    image = new PDS3Image(label, imgBuffer);
  });

  test('parses positive image dimensions', () => {
    expect(image.width).toBeGreaterThan(0);
    expect(image.height).toBeGreaterThan(0);
  });

  test('toFloat32Array length equals width × height', () => {
    const pixels = image.toFloat32Array();
    expect(pixels.length).toBe(image.width * image.height);
  });

  test('toFloat32Array contains finite values', () => {
    const pixels = image.toFloat32Array();
    expect(pixels.every(Number.isFinite)).toBe(true);
  });

  test('uses ^IMAGE record pointer and LINE_PREFIX_BYTES for pixel offsets', () => {
    const lblBuffer = loadBuffer(`${TEST_IMAGE_BASE}.LBL`);
    const imgBuffer = loadBuffer(`${TEST_IMAGE_BASE}.IMG`);
    const label = parseLBL(lblBuffer);
    const imgBytes = new Uint8Array(imgBuffer);
    const imageObject = label.IMAGE as Record<string, number>;
    const imagePointer = label['^IMAGE'] as [string, number];
    const recordBytes = label.RECORD_BYTES as number;
    const linePrefixBytes = imageObject.LINE_PREFIX_BYTES;
    const imageOffset = (imagePointer[1] - 1) * recordBytes;

    expect(image.getPixel(0, 0)).toBe(imgBytes[imageOffset + linePrefixBytes]);

    const secondLineOffset =
      imageOffset + (image.width + linePrefixBytes) + linePrefixBytes;

    expect(image.getPixel(0, 1)).toBe(imgBytes[secondLineOffset]);
  });

  test('supports nested OBJECT = IMAGE and MSB_INTEGER samples', () => {
    const buffer = new Uint8Array([0x00, 0x00, 0xff, 0xfe, 0x00, 0x02]).buffer;
    const image = new PDS3Image(
      {
        RECORD_BYTES: 2,
        '^IMAGE': ['synthetic.img', 2],
        PRODUCT: {
          IMAGE: {
            LINES: 1,
            LINE_SAMPLES: 2,
            LINE_PREFIX_BYTES: 0,
            SAMPLE_TYPE: 'MSB_INTEGER',
            SAMPLE_BITS: 16,
          },
        },
      },
      buffer,
    );

    expect(image.getPixel(0, 0)).toBe(-2);
    expect(image.getPixel(1, 0)).toBe(2);
  });

  test('treats INVALID_CONSTANT raw samples as NaN before scaling', () => {
    const buffer = new Uint8Array([0x80, 0x00, 0x00, 0x02]).buffer;
    const image = new PDS3Image(
      {
        RECORD_BYTES: 2,
        '^IMAGE': ['synthetic.img', 1],
        IMAGE: {
          LINES: 1,
          LINE_SAMPLES: 2,
          LINE_PREFIX_BYTES: 0,
          SAMPLE_TYPE: 'MSB_INTEGER',
          SAMPLE_BITS: 16,
          INVALID_CONSTANT: -32768,
          SCALING_FACTOR: 10,
          OFFSET: 5,
        },
      },
      buffer,
    );

    expect(Number.isNaN(image.getPixel(0, 0))).toBe(true);
    expect(image.getPixel(1, 0)).toBe(25);
  });

  test('toPNG returns a buffer with a valid PNG signature', () => {
    const out = new Uint8Array(toPNG(image));
    // PNG magic: 0x89 'P' 'N' 'G' \r \n 0x1A \n
    expect(out.slice(0, 8)).toEqual(
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    );
  });

  test('toPNG output is larger than the header alone', () => {
    const buf = toPNG(image);
    // At minimum: 8 (sig) + 25 (IHDR) + 12 (IEND) = 45 bytes
    expect(buf.byteLength).toBeGreaterThan(45);
  });

  test('toTIFF returns a buffer with a valid TIFF signature', () => {
    const out = new Uint8Array(toTIFF(image));
    // Little-endian TIFF: 'II' (0x49 0x49) + magic 42
    expect(out[0]).toBe(0x49);
    expect(out[1]).toBe(0x49);
    const magic = new DataView(out.buffer).getUint16(2, true);
    expect(magic).toBe(42);
  });

  test('toTIFF output size matches pixel data', () => {
    const buf = toTIFF(image);
    // Image data alone: width * height * 2 bytes (16-bit)
    expect(buf.byteLength).toBeGreaterThanOrEqual(
      image.width * image.height * 2,
    );
  });
});
