import { describe, test, expect, beforeAll } from '@rstest/core';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseXML } from '../src/pds4/parser/xmlParser';
import { PDS4Image } from '../src/pds4/core/pds4Image';
import { toPNG, toTIFF } from '../src/index';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data');
const PDS4_STEM = 'FLG_1739_0821318674_675RAS_N0830000FHAZ00505_0A01I4J01';

/**
 * Reads a file in the test data directory into a plain ArrayBuffer.
 */
function loadBuffer(filename: string): ArrayBuffer {
  const buf = readFileSync(join(DATA_DIR, filename));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe('PDS4Image (Mars 2020 Perseverance / FLG_1739)', () => {
  let image!: PDS4Image;

  beforeAll(async () => {
    const xmlText = readFileSync(join(DATA_DIR, `${PDS4_STEM}.xml`), 'utf-8');
    const imgBuffer = loadBuffer(`${PDS4_STEM}.IMG`);
    const xml = await parseXML(xmlText);
    image = new PDS4Image(xml, imgBuffer);
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
