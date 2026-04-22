/**
 * A scalar or composite value that can appear in a PDS3 LBL file.
 * Quantities with physical units are represented as `{ value, unit }` objects.
 */
export type PDSValue =
  | number
  | string
  | PDSValue[]
  | { value: PDSValue; unit: string }
  | Record<string, any>;

/**
 * Dictionary of key/value pairs parsed from a PDS3 LBL label,
 * including any nested OBJECT blocks.
 */
export interface PDSLabel {
  [key: string]: PDSValue;
}
