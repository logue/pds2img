import { describe, expect, test } from 'rstack/test';

import { normalizeToUint16 } from '../normalize';
import { encodeToPNG } from '../pngEncoder';
import { encodeToTIFF } from '../tiffEncoder';

describe('normalizeToUint16', () => {
  test('maps the finite min/max range to [0, 65535]', () => {
    expect([...normalizeToUint16(new Float32Array([-1, 0, 1]))]).toEqual([0, 32_768, 65_535]);
  });

  test('ignores non-finite values when computing the range and writes them as 0', () => {
    const samples = normalizeToUint16(new Float32Array([NaN, 10, 20, Infinity]));
    expect([...samples]).toEqual([0, 0, 65_535, 0]);
  });

  test('returns zeros for constant or fully invalid images', () => {
    expect([...normalizeToUint16(new Float32Array([5, 5]))]).toEqual([0, 0]);
    expect([...normalizeToUint16(new Float32Array([NaN, NaN]))]).toEqual([0, 0]);
  });
});

describe('encodeToPNG', () => {
  const pixels = new Float32Array([0, 1, 2, 3, 4, 5]);

  test('writes signature, IHDR dimensions and 16-bit grayscale header', () => {
    const view = new DataView(encodeToPNG(pixels, 3, 2));

    expect(view.getUint32(0)).toBe(0x89_50_4e_47);
    expect(view.getUint32(16)).toBe(3); // IHDR width
    expect(view.getUint32(20)).toBe(2); // IHDR height
    expect(view.getUint8(24)).toBe(16); // bit depth
    expect(view.getUint8(25)).toBe(0); // grayscale
  });

  test('ends with an IEND chunk', () => {
    const bytes = new Uint8Array(encodeToPNG(pixels, 3, 2));
    const iend = new TextDecoder().decode(bytes.slice(-8, -4));
    expect(iend).toBe('IEND');
  });

  test('handles images larger than one DEFLATE stored block', () => {
    const large = new Float32Array(300 * 300).map((_, index) => index);
    expect(encodeToPNG(large, 300, 300).byteLength).toBeGreaterThan(300 * 300 * 2);
  });

  test('rejects mismatched dimensions', () => {
    expect(() => encodeToPNG(pixels, 4, 2)).toThrow(RangeError);
  });
});

describe('encodeToTIFF', () => {
  test('writes pixel data after the IFD in little-endian order', () => {
    const buffer = encodeToTIFF(new Float32Array([0, 1]), 2, 1);
    const view = new DataView(buffer);

    expect(view.getUint16(0)).toBe(0x49_49); // 'II'
    expect(view.getUint16(2, true)).toBe(42);
    expect(buffer.byteLength).toBe(8 + 2 + 9 * 12 + 4 + 4);
    expect(view.getUint16(buffer.byteLength - 4, true)).toBe(0);
    expect(view.getUint16(buffer.byteLength - 2, true)).toBe(65_535);
  });

  test('rejects mismatched dimensions', () => {
    expect(() => encodeToTIFF(new Float32Array(3), 2, 2)).toThrow(RangeError);
  });
});
