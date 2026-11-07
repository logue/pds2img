import type { PDSLabel, PDSValue } from './types';

/** Matches a `KEY = value` statement. */
const ASSIGNMENT = /^([^=]+?)\s*=\s*(.*)$/s;
/** Matches a `value <unit>` quantity, e.g. `1234.5 <KM>`. */
const UNIT_SUFFIX = /^(.+?)\s*<([^<>]+)>$/s;
/** Matches a based integer, e.g. `2#11111111#` or `16#FF#`. */
const BASED_INTEGER = /^([+-]?)(\d+)#([\dA-Fa-f]+)#$/;

/** Keywords that open a nested block. */
const BLOCK_START = new Set(['OBJECT', 'GROUP']);
/** Keywords that close a nested block. */
const BLOCK_END = new Set(['END_OBJECT', 'END_GROUP']);

/**
 * Removes `/* ... *\/` comments that are not inside a quoted string.
 * An unterminated comment runs to the end of the line.
 */
function stripComments(line: string): string {
  let result = '';
  let inQuote = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];

    if (char === '"') {
      inQuote = !inQuote;
    } else if (!inQuote && char === '/' && line[index + 1] === '*') {
      const end = line.indexOf('*/', index + 2);
      if (end === -1) break;
      index = end + 1;
      continue;
    }

    result += char;
  }

  return result;
}

/**
 * Returns `true` when every quote and bracket in `value` is closed,
 * i.e. the statement does not continue on the next line.
 */
function isComplete(value: string): boolean {
  let inQuote = false;
  let depth = 0;

  for (const char of value) {
    if (char === '"') {
      inQuote = !inQuote;
    } else if (!inQuote) {
      if (char === '(' || char === '{') depth++;
      else if (char === ')' || char === '}') depth--;
    }
  }

  return !inQuote && depth <= 0;
}

/** Splits a comma separated list at the top level, ignoring nested brackets and quotes. */
function splitTopLevel(list: string): string[] {
  const items: string[] = [];
  let inQuote = false;
  let depth = 0;
  let current = '';

  for (const char of list) {
    if (char === '"') {
      inQuote = !inQuote;
    } else if (!inQuote) {
      if (char === '(' || char === '{') depth++;
      else if (char === ')' || char === '}') depth--;
      else if (char === ',' && depth === 0) {
        items.push(current);
        current = '';
        continue;
      }
    }
    current += char;
  }

  if (current.trim() !== '' || items.length > 0) {
    items.push(current);
  }

  return items;
}

/**
 * Converts the right-hand side of a statement into a {@link PDSValue}.
 *
 * Supports quoted strings, `'symbols'`, `( sequences )`, `{ sets }`,
 * `value <unit>` quantities, based integers (`2#1010#`) and decimal numbers.
 * Anything else (identifiers, dates, ...) is returned as a raw string.
 */
export function parseValue(raw: string): PDSValue {
  const value = raw.trim();

  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }

  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  if (
    (value.startsWith('(') && value.endsWith(')')) ||
    (value.startsWith('{') && value.endsWith('}'))
  ) {
    return splitTopLevel(value.slice(1, -1)).map(item => parseValue(item));
  }

  const unitMatch = UNIT_SUFFIX.exec(value);
  if (unitMatch) {
    return { value: parseValue(unitMatch[1]), unit: unitMatch[2].trim() };
  }

  const basedMatch = BASED_INTEGER.exec(value);
  if (basedMatch) {
    const [, sign, radix, digits] = basedMatch;
    const parsed = Number.parseInt(digits, Number(radix));
    return sign === '-' ? -parsed : parsed;
  }

  if (value !== '') {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }
  }

  return value;
}

/**
 * Lazily yields logical statements from LBL text, joining values that span
 * several physical lines and stopping at the `END` statement.
 */
function* statements(text: string): Generator<string> {
  let cursor = 0;
  let pending: string | undefined;

  while (cursor < text.length) {
    let next = text.indexOf('\n', cursor);
    if (next === -1) next = text.length;

    const physical = text.slice(cursor, next).replace(/\r$/, '');
    cursor = next + 1;

    if (pending !== undefined) {
      pending += `\n${physical}`;
      if (isComplete(pending)) {
        yield stripComments(pending).trim();
        pending = undefined;
      }
      continue;
    }

    const line = stripComments(physical).trim();
    if (line === '') continue;
    if (line === 'END') return;

    if (isComplete(line)) {
      yield line;
    } else {
      pending = physical;
    }
  }

  if (pending !== undefined) {
    yield stripComments(pending).trim();
  }
}

/**
 * Parses a PDS3 label into a structured {@link PDSLabel} dictionary.
 *
 * Handles:
 * - Scalar `KEY = value` assignments, including values that span multiple lines
 * - Nested `OBJECT` / `GROUP` blocks
 * - Numbers, based integers, quoted strings, sequences, sets and unit suffixes
 * - `/* ... *\/` comments
 *
 * Parsing stops at the `END` statement, so attached labels (label and image
 * data in the same file) can be passed as a whole.
 *
 * @param buffer - Raw bytes of a `.LBL` file, or of an `.IMG` file with an attached label.
 * @returns Parsed label dictionary.
 */
export function parseLBL(buffer: ArrayBuffer | ArrayBufferView): PDSLabel {
  // PDS3 labels are 7-bit ASCII; latin1 maps every byte to one code unit.
  const text = new TextDecoder('latin1').decode(buffer);

  const root: PDSLabel = {};
  const stack: PDSLabel[] = [root];

  for (const statement of statements(text)) {
    const match = ASSIGNMENT.exec(statement);
    const key = (match ? match[1] : statement).trim();
    const current = stack[stack.length - 1];

    if (BLOCK_END.has(key)) {
      if (stack.length > 1) stack.pop();
      continue;
    }

    if (!match) continue;

    const rawValue = match[2];

    if (BLOCK_START.has(key)) {
      const block: PDSLabel = {};
      current[rawValue.trim()] = block;
      stack.push(block);
      continue;
    }

    current[key] = parseValue(rawValue);
  }

  return root;
}
