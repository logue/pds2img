import type { PDSImage } from '@/types/PDSImage';

import { encodeToPNG } from '@/encoder/pngEncoder';
import { encodeToTIFF } from '@/encoder/tiffEncoder';
import { Meta } from '@/types/Meta';

/** Library version (from `package.json`). */
export const version: string = Meta.version;
/** Library build date (ISO 8601). */
export const date: string = Meta.date;

// Image classes and low-level parsers
export { PDS3Image } from '@/pds3/core/pds3Image';
export { parseLBL } from '@/pds3/parser/lblParser';
export { PDS4Image } from '@/pds4/core/pds4Image';
export { parseXML } from '@/pds4/parser/xmlParser';

// Loaders
export { loadPDS3Image, loadPDS3ImageByFile, loadPDS3ImageByUrl } from '@/loader/pds3Loader';
export { loadPDS4Image, loadPDS4ImageByFile, loadPDS4ImageByUrl } from '@/loader/pds4Loader';
export {
  loadPDSImageArrayBufferFromDirectory,
  loadPDSImageFromDirectory
} from '@/loader/directoryLoader';

// Encoders
export { encodeToPNG, encodeToTIFF };

// Types
export type { PDSImage } from '@/types/PDSImage';
export type { BinarySource } from '@/types/BinarySource';
export type { PDSLabel, PDSQuantity, PDSValue } from '@/pds3/parser/types';
export type { PDS4DataType } from '@/pds4/parser/dataType';

/**
 * Encodes a parsed PDS image as a **16-bit grayscale PNG** file.
 * Pixel values are linearly normalized from their finite min/max range to
 * `[0, 65535]`; invalid samples (`NaN`) become `0`.
 *
 * @param image - Any parsed PDS image ({@link PDS3Image} or {@link PDS4Image}).
 * @returns `ArrayBuffer` containing a valid PNG file.
 */
export function toPNG(image: PDSImage): ArrayBuffer {
  return encodeToPNG(image.toFloat32Array(), image.width, image.height);
}

/**
 * Encodes a parsed PDS image as an **uncompressed 16-bit grayscale TIFF** file.
 * Pixel values are linearly normalized from their finite min/max range to
 * `[0, 65535]`; invalid samples (`NaN`) become `0`.
 *
 * @param image - Any parsed PDS image ({@link PDS3Image} or {@link PDS4Image}).
 * @returns `ArrayBuffer` containing a valid TIFF file.
 */
export function toTIFF(image: PDSImage): ArrayBuffer {
  return encodeToTIFF(image.toFloat32Array(), image.width, image.height);
}
