/** Supported PDS4 `data_type` values for `Array_2D_Image` elements. */
export type PDS4DataType =
  | 'UnsignedByte'
  | 'SignedByte'
  | 'UnsignedMSB2'
  | 'UnsignedLSB2'
  | 'SignedMSB2'
  | 'SignedLSB2'
  | 'UnsignedMSB4'
  | 'UnsignedLSB4'
  | 'SignedMSB4'
  | 'SignedLSB4'
  | 'IEEE754MSBSingle'
  | 'IEEE754LSBSingle'
  | 'IEEE754MSBDouble'
  | 'IEEE754LSBDouble';

/** Decoding information for a single {@link PDS4DataType}. */
type DataTypeSpec = {
  /** Byte length of one sample. */
  bytes: number;
  /** Reads one raw sample. */
  read: (view: DataView, offset: number) => number;
};

/** Decoding table keyed by {@link PDS4DataType}. */
const DATA_TYPES: Record<PDS4DataType, DataTypeSpec> = {
  UnsignedByte: { bytes: 1, read: (view, offset) => view.getUint8(offset) },
  SignedByte: { bytes: 1, read: (view, offset) => view.getInt8(offset) },
  UnsignedMSB2: { bytes: 2, read: (view, offset) => view.getUint16(offset, false) },
  UnsignedLSB2: { bytes: 2, read: (view, offset) => view.getUint16(offset, true) },
  SignedMSB2: { bytes: 2, read: (view, offset) => view.getInt16(offset, false) },
  SignedLSB2: { bytes: 2, read: (view, offset) => view.getInt16(offset, true) },
  UnsignedMSB4: { bytes: 4, read: (view, offset) => view.getUint32(offset, false) },
  UnsignedLSB4: { bytes: 4, read: (view, offset) => view.getUint32(offset, true) },
  SignedMSB4: { bytes: 4, read: (view, offset) => view.getInt32(offset, false) },
  SignedLSB4: { bytes: 4, read: (view, offset) => view.getInt32(offset, true) },
  IEEE754MSBSingle: { bytes: 4, read: (view, offset) => view.getFloat32(offset, false) },
  IEEE754LSBSingle: { bytes: 4, read: (view, offset) => view.getFloat32(offset, true) },
  IEEE754MSBDouble: { bytes: 8, read: (view, offset) => view.getFloat64(offset, false) },
  IEEE754LSBDouble: { bytes: 8, read: (view, offset) => view.getFloat64(offset, true) }
};

/** All supported {@link PDS4DataType} values. */
export const PDS4DataType = Object.keys(DATA_TYPES) as PDS4DataType[];

/** Byte length of a single sample for each {@link PDS4DataType}. */
export const bytesPerSample = Object.fromEntries(
  Object.entries(DATA_TYPES).map(([type, spec]) => [type, spec.bytes])
) as Record<PDS4DataType, number>;

/**
 * Narrows a raw `data_type` string from a PDS4 XML label to a {@link PDS4DataType}.
 *
 * @param type - `data_type` text content read from the XML label.
 * @throws {RangeError} If `type` is not one of the supported values.
 */
export function toPDS4DataType(type: string): PDS4DataType {
  const trimmed = type.trim();
  if (Object.hasOwn(DATA_TYPES, trimmed)) {
    return trimmed as PDS4DataType;
  }

  throw new RangeError(`Unsupported PDS4 data_type: ${trimmed}`);
}

/**
 * Reads a single numeric sample from `view` using the PDS4 `data_type`.
 *
 * @param view - DataView wrapping the image data buffer.
 * @param offset - Byte offset of the sample within `view`.
 * @param type - PDS4 {@link PDS4DataType} from the XML label.
 * @returns Raw (unscaled) sample value.
 */
export function readValue(view: DataView, offset: number, type: PDS4DataType): number {
  return DATA_TYPES[type].read(view, offset);
}
