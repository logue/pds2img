import { beforeAll, describe, expect, test } from 'rstack/test';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { toPNG, toTIFF } from '../index';
import { PDS4Image } from '../pds4/core/pds4Image';
import { parseXML } from '../pds4/parser/xmlParser';

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const PDS4_STEM = 'FLG_1739_0821318674_675RAS_N0830000FHAZ00505_0A01I4J01';

/**
 * Reads a file in the test data directory into a plain ArrayBuffer.
 */
function loadBuffer(filename: string): ArrayBuffer {
  const buffer = readFileSync(path.join(DATA_DIR, filename));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

describe('PDS4Image (Mars 2020 Perseverance / FLG_1739)', () => {
  let image!: PDS4Image;

  beforeAll(async () => {
    const xmlText = readFileSync(path.join(DATA_DIR, `${PDS4_STEM}.xml`), 'utf-8');
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
    expect(pixels.every(value => Number.isFinite(value))).toBe(true);
  });

  test('toPNG returns a buffer with a valid PNG signature', () => {
    const out = new Uint8Array(toPNG(image));
    // PNG magic: 0x89 'P' 'N' 'G' \r \n 0x1A \n
    expect(out.slice(0, 8)).toEqual(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));
  });

  test('toPNG output is larger than the header alone', () => {
    const buffer = toPNG(image);
    // At minimum: 8 (sig) + 25 (IHDR) + 12 (IEND) = 45 bytes
    expect(buffer.byteLength).toBeGreaterThan(45);
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
    const buffer = toTIFF(image);
    // Image data alone: width * height * 2 bytes (16-bit)
    expect(buffer.byteLength).toBeGreaterThanOrEqual(image.width * image.height * 2);
  });
});
