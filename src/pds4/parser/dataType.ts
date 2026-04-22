/**
 * Reads a single numeric sample from `view` using the PDS4 `data_type` string.
 *
 * Supported types: `UnsignedByte`, `SignedByte`, `UnsignedMSB2`, `UnsignedLSB2`,
 * `SignedMSB2`, `SignedLSB2`, `IEEE754MSBSingle`, `IEEE754LSBSingle`.
 *
 * @param view - DataView wrapping the image data buffer.
 * @param offset - Byte offset of the sample within `view`.
 * @param type - PDS4 `data_type` string from the XML label.
 * @returns Raw (unscaled) sample value.
 * @throws If `type` is not one of the supported values.
 */
export function readValue(
  view: DataView,
  offset: number,
  type: string,
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

    default:
      throw new Error(`Unsupported PDS4 data_type: ${type}`);
  }
}
