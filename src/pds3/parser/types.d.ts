/** A physical quantity such as `1.440 <SECOND>`. */
export type PDSQuantity = {
  value: PDSValue;
  unit: string;
};

/**
 * A scalar or composite value that can appear in a PDS3 LBL file.
 * Quantities with physical units are represented as {@link PDSQuantity} objects,
 * nested `OBJECT` / `GROUP` blocks as {@link PDSLabel} dictionaries.
 */
export type PDSValue = number | string | PDSValue[] | PDSQuantity | PDSLabel;

/**
 * Dictionary of key/value pairs parsed from a PDS3 LBL label,
 * including any nested `OBJECT` / `GROUP` blocks.
 */
export type PDSLabel = {
  [key: string]: PDSValue;
};
