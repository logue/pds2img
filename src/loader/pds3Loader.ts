import { fetchArrayBuffer, readArrayBuffer } from './source';

import type { BinarySource } from '@/types/BinarySource';

import { PDS3Image } from '@/pds3/core/pds3Image';
import { parseLBL } from '@/pds3/parser/lblParser';

/** Matches the `.IMG` file extension, used to derive a sibling `.LBL` URL. */
const IMG_EXTENSION = /\.img$/i;

/**
 * Loads a PDS3 image from in-memory data.
 *
 * @param label - Contents of the `.LBL` file. For attached labels, pass the
 *   `.IMG` file itself and omit `data`.
 * @param data - Contents of the `.IMG` file (detached labels only).
 * @returns Parsed {@link PDS3Image} instance.
 *
 * @example
 * ```ts
 * // Detached label (.LBL + .IMG)
 * const image = await loadPDS3Image(lblBuffer, imgBuffer);
 * // Attached label (single .IMG)
 * const image = await loadPDS3Image(imgBuffer);
 * ```
 */
export async function loadPDS3Image(label: BinarySource, data?: BinarySource): Promise<PDS3Image> {
  const labelBuffer = await readArrayBuffer(label);
  const dataBuffer = data === undefined ? labelBuffer : await readArrayBuffer(data);

  return new PDS3Image(parseLBL(labelBuffer), dataBuffer);
}

/**
 * Loads a PDS3 image from `File` / `Blob` objects, e.g. from `<input type="file">`.
 *
 * @param imgFile - The `.IMG` file.
 * @param lblFile - The detached `.LBL` file. Omit when the label is attached to `imgFile`.
 * @returns Parsed {@link PDS3Image} instance.
 */
export async function loadPDS3ImageByFile(imgFile: Blob, lblFile?: Blob): Promise<PDS3Image> {
  return lblFile === undefined
    ? await loadPDS3Image(imgFile)
    : await loadPDS3Image(lblFile, imgFile);
}

/**
 * Fetches a PDS3 image from a remote `.IMG` URL.
 *
 * @param imgUrl - URL of the `.IMG` image file.
 * @param lblUrl - URL of the `.LBL` label. Defaults to `imgUrl` with the
 *   extension replaced by `.LBL`.
 * @returns Parsed {@link PDS3Image} instance.
 * @throws {Error} If either request fails.
 */
export async function loadPDS3ImageByUrl(
  imgUrl: string | URL,
  lblUrl: string | URL = imgUrl.toString().replace(IMG_EXTENSION, '.LBL')
): Promise<PDS3Image> {
  const [lblBuffer, imgBuffer] = await Promise.all([
    fetchArrayBuffer(lblUrl),
    fetchArrayBuffer(imgUrl)
  ]);

  return await loadPDS3Image(lblBuffer, imgBuffer);
}
