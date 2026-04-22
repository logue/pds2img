import { PDS3Image } from './pds3/core/pds3Image';
import { PDS4Image } from './pds4/core/pds4Image';
import { parseLBL } from './pds3/parser/lblParser';
import { parseXML } from './pds4/parser/xmlParser';
import { encodeToPNG } from './encoder/pngEncoder';
import { encodeToTIFF } from './encoder/tiffEncoder';

export { PDS3Image, PDS4Image, parseLBL, parseXML };

/** Common interface satisfied by both {@link PDS3Image} and {@link PDS4Image}. */
interface PDSImage {
  width: number;
  height: number;
  toFloat32Array(): Float32Array;
}

function getFileStem(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName;
}

function hasExtension(fileName: string, extension: string): boolean {
  return fileName.toLowerCase().endsWith(extension.toLowerCase());
}

/**
 * Recursively searches a directory for a file matching the given predicate.
 *
 * @param directoryHandle - A handle to the directory to search.
 * @param predicate - A function that takes a file name and returns a boolean indicating whether the file matches the desired criteria.
 * @returns A promise that resolves to a FileSystemFileHandle or null if not found.
 */
async function findFileHandle(
  directoryHandle: FileSystemDirectoryHandle,
  predicate: (name: string) => boolean,
): Promise<FileSystemFileHandle | null> {
  for await (const entry of directoryHandle.values()) {
    if (entry.kind === 'file' && predicate(entry.name)) {
      return entry;
    }
  }

  return null;
}

/**
 * Writes a PNG chunk to the output buffer `out` starting at byte offset `offset`.
 * The chunk consists of a 4-byte big-endian length, a 4-byte ASCII type, the chunk data, and a 4-byte CRC-32.
 *
 * @param directoryHandle - A handle to the directory containing the file.
 * @param fileName - The name of the file to find.
 * @returns A promise that resolves to a FileSystemFileHandle or null if not found.
 */
async function getFileHandleByName(
  directoryHandle: FileSystemDirectoryHandle,
  fileName: string,
): Promise<FileSystemFileHandle | null> {
  const normalizedName = fileName.toLowerCase();

  return findFileHandle(
    directoryHandle,
    (entryName) => entryName.toLowerCase() === normalizedName,
  );
}

/**
 * loadPDS3ArrayBufferFromDirectory attempts to find and parse a PDS3 image within the given directory.
 * It looks for a `.IMG` file and its corresponding `.LBL` file, then loads the image data.
 *
 * @param directoryHandle - A handle to the directory containing the PDS3 files.
 * @returns A promise that resolves to an ArrayBuffer containing the image data, or null if not found.
 */
async function loadPDS3ArrayBufferFromDirectory(
  directoryHandle: FileSystemDirectoryHandle,
): Promise<ArrayBuffer | null> {
  const imgHandle = await findFileHandle(directoryHandle, (fileName) =>
    hasExtension(fileName, '.img'),
  );

  if (!imgHandle) {
    return null;
  }

  const lblHandle = await getFileHandleByName(
    directoryHandle,
    `${getFileStem(imgHandle.name)}.LBL`,
  );

  if (!lblHandle) {
    return null;
  }

  const [lblBuffer, imgBuffer] = await Promise.all([
    lblHandle.getFile().then((file) => file.arrayBuffer()),
    imgHandle.getFile().then((file) => file.arrayBuffer()),
  ]);

  const image = new PDS3Image(parseLBL(lblBuffer), imgBuffer);
  return image.toFloat32Array().buffer;
}

/**
 * loadPDS4ArrayBufferFromDirectory attempts to find and parse a PDS4 image within the given directory.
 * It looks for an XML label file, extracts the referenced image file name, and loads the image data.
 *
 * @param directoryHandle - A handle to the directory containing the PDS4 files.
 * @returns A promise that resolves to an ArrayBuffer containing the image data, or null if not found.
 */
async function loadPDS4ArrayBufferFromDirectory(
  directoryHandle: FileSystemDirectoryHandle,
): Promise<ArrayBuffer | null> {
  const xmlHandle = await findFileHandle(directoryHandle, (fileName) =>
    hasExtension(fileName, '.xml'),
  );

  if (!xmlHandle) {
    return null;
  }

  const xmlText = await xmlHandle.getFile().then((file) => file.text());
  const xml = await parseXML(xmlText);

  const imageFileName =
    xml
      .querySelector('File_Area_Observational file_name')
      ?.textContent?.trim() ||
    xml.querySelector('File file_name')?.textContent?.trim();

  if (!imageFileName) {
    throw new Error('PDS4 XML does not contain a file_name entry');
  }

  const imageHandle = await getFileHandleByName(directoryHandle, imageFileName);

  if (!imageHandle) {
    throw new Error(`PDS4 image file not found: ${imageFileName}`);
  }

  const imgBuffer = await imageHandle
    .getFile()
    .then((file) => file.arrayBuffer());
  const image = new PDS4Image(xml, imgBuffer);

  return image.toFloat32Array().buffer;
}

/**
 * Fetches a PDS3 image from a remote `.IMG` URL.
 * The corresponding `.LBL` file is derived by replacing the `.IMG` extension.
 *
 * @param url - Direct URL of the `.IMG` image file.
 * @returns Parsed {@link PDS3Image} instance.
 */
export async function loadPDS3ImageByUrl(url: string): Promise<PDS3Image> {
  const [lblBuffer, imgBuffer] = await Promise.all([
    fetch(url.replace(/\.IMG$/i, '.LBL')).then((res) => res.arrayBuffer()),
    fetch(url).then((res) => res.arrayBuffer()),
  ]);

  const label = parseLBL(lblBuffer);
  return new PDS3Image(label, imgBuffer);
}

/**
 * Fetches a PDS4 image from remote URLs.
 *
 * @param xmlUrl - URL of the PDS4 XML label file.
 * @param imgUrl - URL of the binary image data file referenced by the label.
 * @returns Parsed {@link PDS4Image} instance.
 */
export async function loadPDS4ImageByUrl(
  xmlUrl: string,
  imgUrl: string,
): Promise<PDS4Image> {
  const [xmlText, imgBuffer] = await Promise.all([
    fetch(xmlUrl).then((res) => res.text()),
    fetch(imgUrl).then((res) => res.arrayBuffer()),
  ]);

  const xml = await parseXML(xmlText);
  return new PDS4Image(xml, imgBuffer);
}

/**
 * Parses a PDS3 image from a single {@link File} object.
 * The first half of the file is treated as the LBL label and the second half
 * as the binary image data. For normal usage prefer {@link loadPDS3ImageByUrl}.
 *
 * @param file - A `File` selected via an `<input type="file">` element.
 * @returns Parsed {@link PDS3Image} instance.
 */
export async function loadPDS3ImageByFile(file: File): Promise<PDS3Image> {
  const [lblBuffer, imgBuffer] = await Promise.all([
    file
      .slice(0, file.size / 2)
      .arrayBuffer()
      .catch(() => new ArrayBuffer(0)),
    file
      .slice(file.size / 2)
      .arrayBuffer()
      .catch(() => new ArrayBuffer(0)),
  ]);

  const label = parseLBL(lblBuffer);
  return new PDS3Image(label, imgBuffer);
}

/**
 * Loads a PDS image from a directory chosen via the
 * [File System Access API](https://developer.mozilla.org/docs/Web/API/File_System_API).
 *
 * Detection order:
 * 1. If the directory contains a `.IMG` file **and** a same-stem `.LBL` file,
 *    the pair is parsed as a **PDS3** image.
 * 2. If the directory contains a `.xml` file with a `file_name` element, the
 *    referenced image is parsed as a **PDS4** image.
 * 3. Otherwise an error is thrown.
 *
 * @param directoryHandle - Handle to the directory to search.
 * @returns `ArrayBuffer` containing the normalized Float32 pixel data.
 * @throws If no supported PDS dataset is found in the directory.
 */
export async function loadPDSImageArrayBufferFromDirectory(
  directoryHandle: FileSystemDirectoryHandle,
): Promise<ArrayBuffer> {
  const pds3Buffer = await loadPDS3ArrayBufferFromDirectory(directoryHandle);

  if (pds3Buffer) {
    return pds3Buffer;
  }

  const pds4Buffer = await loadPDS4ArrayBufferFromDirectory(directoryHandle);

  if (pds4Buffer) {
    return pds4Buffer;
  }

  throw new Error(
    'No supported PDS dataset found. Expected an IMG/LBL pair or a PDS4 XML file.',
  );
}

/**
 * Encodes a parsed PDS image as a **16-bit grayscale PNG** file.
 * Pixel values are linearly normalized from their min/max range to [0, 65535].
 *
 * @param image - Any parsed PDS image ({@link PDS3Image} or {@link PDS4Image}).
 * @returns `ArrayBuffer` containing a valid PNG file.
 */
export function toPNG(image: PDSImage): ArrayBuffer {
  return encodeToPNG(image.toFloat32Array(), image.width, image.height);
}

/**
 * Encodes a parsed PDS image as an **uncompressed 16-bit grayscale TIFF** file.
 * Pixel values are linearly normalized from their min/max range to [0, 65535].
 *
 * @param image - Any parsed PDS image ({@link PDS3Image} or {@link PDS4Image}).
 * @returns `ArrayBuffer` containing a valid TIFF file.
 */
export function toTIFF(image: PDSImage): ArrayBuffer {
  return encodeToTIFF(image.toFloat32Array(), image.width, image.height);
}
