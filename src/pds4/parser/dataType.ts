/** Supported PDS4 `data_type` values for `Array_2D_Image` elements. */
export type PDS4DataType =
  | 'UnsignedByte'
  | 'SignedByte'
  | 'UnsignedMSB2'
  | 'UnsignedLSB2'
  | 'SignedMSB2'
  | 'SignedLSB2'
  | 'IEEE754MSBSingle'
  | 'IEEE754LSBSingle';

/** All supported {@link PDS4DataType} values, used to validate raw XML text. */
export const PDS4DataType: PDS4DataType[] = [
  'UnsignedByte',
  'SignedByte',
  'UnsignedMSB2',
  'UnsignedLSB2',
  'SignedMSB2',
  'SignedLSB2',
  'IEEE754MSBSingle',
  'IEEE754LSBSingle',
];

/** Byte length of a single sample for each {@link PDS4DataType}. */
export const bytesPerSample: Record<PDS4DataType, number> = {
  UnsignedByte: 1,
  SignedByte: 1,
  UnsignedMSB2: 2,
  UnsignedLSB2: 2,
  SignedMSB2: 2,
  SignedLSB2: 2,
  IEEE754MSBSingle: 4,
  IEEE754LSBSingle: 4,
};

/**
 * Narrows a raw `data_type` string from a PDS4 XML label to a {@link PDS4DataType}.
 *
 * @param type - `data_type` text content read from the XML label.
 * @returns The validated {@link PDS4DataType}.
 * @throws {RangeError} If `type` is not one of the supported values.
 */
export function toPDS4DataType(type: string): PDS4DataType {
  if ((PDS4DataType as string[]).includes(type)) {
    return type as PDS4DataType;
  }

  throw new RangeError(`Unsupported PDS4 data_type: ${type}`);
}

/**
 * Reads a single numeric sample from `view` using the PDS4 `data_type`.
 *
 * @param view - DataView wrapping the image data buffer.
 * @param offset - Byte offset of the sample within `view`.
 * @param type - PDS4 {@link PDS4DataType} from the XML label.
 * @returns Raw (unscaled) sample value.
 */
export function readValue(
  view: DataView,
  offset: number,
  type: PDS4DataType,
): number {
  switch (type) {
    case 'UnsignedByte':
      return view.getUint8(offset);

    case 'SignedByte':
      return view.getInt8(offset);

    case 'UnsignedMSB2':
      return view.getUint16(offset, false);

    case 'UnsignedLSB2':
      return view.getUint16(offset, true);

    case 'SignedMSB2':
      return view.getInt16(offset, false);

    case 'SignedLSB2':
      return view.getInt16(offset, true);

    case 'IEEE754MSBSingle':
      return view.getFloat32(offset, false);

    case 'IEEE754LSBSingle':
      return view.getFloat32(offset, true);
  }
}
