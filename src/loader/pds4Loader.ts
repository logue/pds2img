import { fetchArrayBuffer, readArrayBuffer, readText } from './source';

import type { BinarySource } from '@/types/BinarySource';

import { PDS4Image } from '@/pds4/core/pds4Image';
import { getPDS4DataFileName, parseXML } from '@/pds4/parser/xmlParser';

/**
 * Loads a PDS4 image from in-memory data.
 *
 * @param label - The XML label, as text or binary.
 * @param data - Contents of the data file referenced by the label.
 * @returns Parsed {@link PDS4Image} instance.
 */
export async function loadPDS4Image(
  label: string | BinarySource,
  data: BinarySource
): Promise<PDS4Image> {
  const [xmlText, dataBuffer] = await Promise.all([readText(label), readArrayBuffer(data)]);
  return new PDS4Image(await parseXML(xmlText), dataBuffer);
}

/**
 * Loads a PDS4 image from `File` / `Blob` objects, e.g. from `<input type="file">`.
 *
 * @param xmlFile - The `.xml` label file.
 * @param imgFile - The data file referenced by the label.
 * @returns Parsed {@link PDS4Image} instance.
 */
export async function loadPDS4ImageByFile(xmlFile: Blob, imgFile: Blob): Promise<PDS4Image> {
  return await loadPDS4Image(xmlFile, imgFile);
}

/**
 * Fetches a PDS4 image from remote URLs.
 *
 * @param xmlUrl - URL of the PDS4 XML label file.
 * @param imgUrl - URL of the data file. Defaults to the label's `file_name`,
 *   resolved relative to `xmlUrl`.
 * @returns Parsed {@link PDS4Image} instance.
 * @throws {Error} If a request fails or the data file cannot be determined.
 */
export async function loadPDS4ImageByUrl(
  xmlUrl: string | URL,
  imgUrl?: string | URL
): Promise<PDS4Image> {
  const response = await fetch(xmlUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${xmlUrl.toString()}: ${String(response.status)} ${response.statusText}`
    );
  }
  const xml = await parseXML(await response.text());

  let dataUrl = imgUrl;
  if (dataUrl === undefined) {
    const fileName = getPDS4DataFileName(xml);
    if (fileName === undefined) {
      throw new Error('PDS4 label does not contain a file_name entry');
    }
    // Relative URLs need a base; fall back to the page location in browsers.
    const base = typeof location === 'undefined' ? undefined : location.href;
    dataUrl = new URL(fileName, new URL(xmlUrl, base));
  }

  return new PDS4Image(xml, await fetchArrayBuffer(dataUrl));
}
