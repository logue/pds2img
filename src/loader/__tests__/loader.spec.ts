import { afterEach, describe, expect, rs, test } from 'rstack/test';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPDS3Image, loadPDS3ImageByFile, loadPDS3ImageByUrl } from '../pds3Loader';
import { loadPDS4Image, loadPDS4ImageByFile, loadPDS4ImageByUrl } from '../pds4Loader';

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../__tests__/data');
const PDS3_STEM = 'C3592903_RAW';
const PDS4_STEM = 'FLG_1739_0821318674_675RAS_N0830000FHAZ00505_0A01I4J01';

const read = (fileName: string) => readFileSync(path.join(DATA_DIR, fileName));

/** Returns the URL string of a `fetch()` input. */
const urlOf = (input: RequestInfo | URL): string =>
  input instanceof Request ? input.url : input.toString();

afterEach(() => {
  rs.restoreAllMocks();
});

describe('PDS3 loaders', () => {
  test('loadPDS3Image accepts Node.js Buffers', async () => {
    const image = await loadPDS3Image(read(`${PDS3_STEM}.LBL`), read(`${PDS3_STEM}.IMG`));
    expect([image.width, image.height]).toEqual([800, 800]);
  });

  test('loadPDS3ImageByFile accepts File objects (IMG first, then LBL)', async () => {
    const img = new File([read(`${PDS3_STEM}.IMG`)], `${PDS3_STEM}.IMG`);
    const lbl = new File([read(`${PDS3_STEM}.LBL`)], `${PDS3_STEM}.LBL`);
    const image = await loadPDS3ImageByFile(img, lbl);
    expect([image.width, image.height]).toEqual([800, 800]);
  });

  test('loadPDS3ImageByFile reads attached labels from a single file', async () => {
    // The label fills records 1–2 (128 bytes each); image data starts at record 3.
    const recordBytes = 128;
    const label = new TextEncoder().encode(
      [
        `RECORD_BYTES = ${String(recordBytes)}`,
        '^IMAGE = 3',
        'OBJECT = IMAGE',
        'LINES = 1',
        'LINE_SAMPLES = 2',
        'SAMPLE_BITS = 8',
        'SAMPLE_TYPE = UNSIGNED_INTEGER',
        'END_OBJECT = IMAGE',
        'END',
        ''
      ].join('\n')
    );
    const file = new Uint8Array(recordBytes * 2 + 2).fill(0x20);
    file.set(label);
    file.set([7, 9], recordBytes * 2);

    const image = await loadPDS3ImageByFile(new Blob([file]));
    expect([image.getPixel(0, 0), image.getPixel(1, 0)]).toEqual([7, 9]);
  });

  test('loadPDS3ImageByUrl derives the .LBL URL and checks response status', async () => {
    const fetchMock = rs.spyOn(globalThis, 'fetch').mockImplementation(input => {
      const fileName = urlOf(input).endsWith('.LBL') ? `${PDS3_STEM}.LBL` : `${PDS3_STEM}.IMG`;
      return Promise.resolve(new Response(read(fileName)));
    });

    const image = await loadPDS3ImageByUrl(`https://example.com/${PDS3_STEM}.IMG`);
    expect(image.width).toBe(800);
    expect(fetchMock.mock.calls.map(([input]) => urlOf(input))).toContain(
      `https://example.com/${PDS3_STEM}.LBL`
    );

    fetchMock.mockResolvedValue(new Response('missing', { status: 404 }));
    await expect(loadPDS3ImageByUrl('https://example.com/x.IMG')).rejects.toThrow(/404/);
  });
});

describe('PDS4 loaders', () => {
  test('loadPDS4Image accepts XML text and a Buffer', async () => {
    const image = await loadPDS4Image(
      read(`${PDS4_STEM}.xml`).toString('utf8'),
      read(`${PDS4_STEM}.IMG`)
    );
    expect([image.width, image.height]).toEqual([2176, 584]);
    expect(image.dataType).toBe('SignedMSB2');
  });

  test('loadPDS4ImageByFile accepts File objects (XML first, then IMG)', async () => {
    const image = await loadPDS4ImageByFile(
      new File([read(`${PDS4_STEM}.xml`)], `${PDS4_STEM}.xml`),
      new File([read(`${PDS4_STEM}.IMG`)], `${PDS4_STEM}.IMG`)
    );
    expect(image.width).toBe(2176);
  });

  test('loadPDS4ImageByUrl resolves the data file from file_name', async () => {
    const fetchMock = rs.spyOn(globalThis, 'fetch').mockImplementation(input => {
      const fileName = urlOf(input).endsWith('.xml') ? `${PDS4_STEM}.xml` : `${PDS4_STEM}.IMG`;
      return Promise.resolve(new Response(read(fileName)));
    });

    const image = await loadPDS4ImageByUrl(`https://example.com/data/${PDS4_STEM}.xml`);
    expect(image.height).toBe(584);
    expect(urlOf(fetchMock.mock.calls[1][0])).toBe(`https://example.com/data/${PDS4_STEM}.IMG`);
  });
});
