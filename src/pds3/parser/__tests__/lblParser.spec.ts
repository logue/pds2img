import { describe, expect, test } from 'rstack/test';

import { parseLBL, parseValue } from '../lblParser';

/** Encodes LBL text as an ArrayBuffer. */
function encode(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

describe('parseValue', () => {
  test('parses numbers, strings and symbols', () => {
    expect(parseValue('42')).toBe(42);
    expect(parseValue('-1.5E-3')).toBe(-0.0015);
    expect(parseValue('"VOYAGER 1"')).toBe('VOYAGER 1');
    expect(parseValue("'N/A'")).toBe('N/A');
    expect(parseValue('MSB_INTEGER')).toBe('MSB_INTEGER');
  });

  test('keeps dates and empty values as strings', () => {
    expect(parseValue('1980-12-15T19:47:47.00')).toBe('1980-12-15T19:47:47.00');
    expect(parseValue('')).toBe('');
  });

  test('parses based integers', () => {
    expect(parseValue('2#11111111#')).toBe(255);
    expect(parseValue('16#FF#')).toBe(255);
    expect(parseValue('-8#17#')).toBe(-15);
  });

  test('parses unit quantities', () => {
    expect(parseValue('1.440 <SECOND>')).toEqual({ value: 1.44, unit: 'SECOND' });
  });

  test('parses sequences and sets, including nested quantities', () => {
    expect(parseValue('("C3592903_RAW.IMG", 4)')).toEqual(['C3592903_RAW.IMG', 4]);
    expect(parseValue('("A.IMG", 2049 <BYTES>)')).toEqual([
      'A.IMG',
      { value: 2049, unit: 'BYTES' }
    ]);
    expect(parseValue('{RED, "GREEN, BLUE"}')).toEqual(['RED', 'GREEN, BLUE']);
    expect(parseValue('((1, 2), (3, 4))')).toEqual([
      [1, 2],
      [3, 4]
    ]);
  });
});

describe('parseLBL', () => {
  test('parses scalar keywords and nested OBJECT / GROUP blocks', () => {
    const label = parseLBL(
      encode(
        [
          'PDS_VERSION_ID = PDS3',
          'RECORD_BYTES   = 1024',
          'OBJECT_NAME    = "not a block"',
          'GROUP = INFO',
          '  OBJECT = IMAGE',
          '    LINES = 800',
          '  END_OBJECT = IMAGE',
          'END_GROUP',
          'END'
        ].join('\r\n')
      )
    );

    expect(label.PDS_VERSION_ID).toBe('PDS3');
    expect(label.RECORD_BYTES).toBe(1024);
    expect(label.OBJECT_NAME).toBe('not a block');
    expect(label.INFO).toEqual({ IMAGE: { LINES: 800 } });
  });

  test('joins values that span multiple lines', () => {
    const label = parseLBL(
      encode(
        [
          'DESCRIPTION = "First line',
          'second line with = sign',
          'third line."',
          'BANDS = (1,',
          '         2, 3)',
          'NEXT = 1'
        ].join('\n')
      )
    );

    expect(label.DESCRIPTION).toBe('First line\nsecond line with = sign\nthird line.');
    expect(label.BANDS).toEqual([1, 2, 3]);
    expect(label.NEXT).toBe(1);
  });

  test('strips comments outside of strings only', () => {
    const label = parseLBL(
      encode(
        [
          '/* Header comment */',
          'LINE_PREFIX_BYTES = 224  /* undocumented */',
          'NOTE = "keep /* this */ text"'
        ].join('\n')
      )
    );

    expect(label.LINE_PREFIX_BYTES).toBe(224);
    expect(label.NOTE).toBe('keep /* this */ text');
  });

  test('stops at END so attached labels can be parsed from the whole file', () => {
    const header = new TextEncoder().encode('LINES = 1\nEND\n');
    const bytes = new Uint8Array(header.length + 4);
    bytes.set(header);
    bytes.set([0x00, 0x3d, 0xff, 0x0a], header.length); // binary data containing '='

    expect(parseLBL(bytes)).toEqual({ LINES: 1 });
  });

  test('ignores unbalanced END_OBJECT statements', () => {
    expect(parseLBL(encode('END_OBJECT = IMAGE\nA = 1'))).toEqual({ A: 1 });
  });
});
