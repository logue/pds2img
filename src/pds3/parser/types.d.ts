/**
 * A scalar or composite value that can appear in a PDS3 LBL file.
 * Quantities with physical units are represented as `{ value, unit }` objects.
 */
export type PDSValue =
  | number
  | string
  | PDSValue[]
  | {
      value: PDSValue;
      unit: string;
    }
  | PDSLabel;

/**
 * Dictionary of key/value pairs parsed from a PDS3 LBL label,
 * including any nested OBJECT blocks.
 */
export type PDSLabel = {
  [key: string]: PDSValue;
};
