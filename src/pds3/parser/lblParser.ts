import type { PDSLabel, PDSValue } from './types';

/**
 * Parses a PDS3 LBL label file into a structured {@link PDSLabel} dictionary.
 *
 * Handles:
 * - Scalar key=value assignments
 * - Nested `OBJECT` / `END_OBJECT` blocks
 * - Numeric values, quoted strings, parenthesised arrays, and unit suffixes
 * - Line comments starting with `/*`
 *
 * @param buffer - Raw bytes of a `.LBL` file (ASCII encoded).
 * @returns Parsed label dictionary.
 */
export function parseLBL(buffer: ArrayBuffer): PDSLabel {
  const text = new TextDecoder('ascii').decode(buffer);
  const lines = text.split(/\r?\n/);

  const root: PDSLabel = {};
  const stack: PDSLabel[] = [root];

  for (const raw of lines) {
    const line = raw.replace(/\/\*.*?\*\//g, '').trim();
    if (!line || line.startsWith('/*')) continue;

    if (line.startsWith('OBJECT')) {
      const name = line.split('=')[1].trim();
      const obj: PDSLabel = {};
      stack[stack.length - 1][name] = obj;
      stack.push(obj);
      continue;
    }

    if (line.startsWith('END_OBJECT')) {
      stack.pop();
      continue;
    }

    if (line.includes('=')) {
      const [k, v] = line.split('=');
      stack[stack.length - 1][k.trim()] = parseValue(v.trim());
    }
  }

  return root;
}

function parseValue(value: string): PDSValue {
  // 単位付き
  const unitMatch = /^(.+?)\s*<(.+?)>$/.exec(value);
  if (unitMatch) {
    return {
      value: parseValue(unitMatch[1]),
      unit: unitMatch[2],
    };
  }

  // 配列
  if (value.startsWith('(')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((v) => parseValue(v.trim()));
  }

  // 文字列
  if (value.startsWith('"')) {
    return value.slice(1, -1);
  }

  // 数値
  if (Number.isNaN(Number(value)) === false) {
    return Number(value);
  }

  return value;
}
