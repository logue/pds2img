import { loadPDS3Image } from './pds3Loader';
import { loadPDS4Image } from './pds4Loader';

import type { PDSImage } from '@/types/PDSImage';

import { getPDS4DataFileName, parseXML } from '@/pds4/parser/xmlParser';

/** Returns the file name without its final extension. */
function getFileStem(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex === -1 ? fileName : fileName.slice(0, dotIndex);
}

/** Case-insensitive extension check (`extension` includes the dot). */
function hasExtension(fileName: string, extension: string): boolean {
  return fileName.toLowerCase().endsWith(extension.toLowerCase());
}

/**
 * Returns the first file directly inside `directory` that matches `predicate`.
 * Subdirectories are not searched.
 */
async function findFile(
  directory: FileSystemDirectoryHandle,
  predicate: (name: string) => boolean
): Promise<FileSystemFileHandle | undefined> {
  for await (const entry of directory.values()) {
    if (entry.kind === 'file' && predicate(entry.name)) {
      return entry;
    }
  }
  return undefined;
}

/** Case-insensitive lookup of a file by name directly inside `directory`. */
async function findFileByName(
  directory: FileSystemDirectoryHandle,
  fileName: string
): Promise<FileSystemFileHandle | undefined> {
  const normalized = fileName.toLowerCase();
  return await findFile(directory, name => name.toLowerCase() === normalized);
}

/** Tries to load an `.IMG` + same-stem `.LBL` pair as a PDS3 image. */
async function tryLoadPDS3(directory: FileSystemDirectoryHandle): Promise<PDSImage | undefined> {
  const imgHandle = await findFile(directory, name => hasExtension(name, '.img'));
  if (!imgHandle) return undefined;

  const lblHandle = await findFileByName(directory, `${getFileStem(imgHandle.name)}.LBL`);
  if (!lblHandle) return undefined;

  const [lblFile, imgFile] = await Promise.all([lblHandle.getFile(), imgHandle.getFile()]);
  return await loadPDS3Image(lblFile, imgFile);
}

/** Tries to load a PDS4 `.xml` label and the data file it references. */
async function tryLoadPDS4(directory: FileSystemDirectoryHandle): Promise<PDSImage | undefined> {
  const xmlHandle = await findFile(directory, name => hasExtension(name, '.xml'));
  if (!xmlHandle) return undefined;

  const xmlFile = await xmlHandle.getFile();
  const xmlText = await xmlFile.text();
  const fileName = getPDS4DataFileName(await parseXML(xmlText));
  if (fileName === undefined) {
    throw new Error('PDS4 label does not contain a file_name entry');
  }

  const dataHandle = await findFileByName(directory, fileName);
  if (!dataHandle) {
    throw new Error(`PDS4 data file not found: ${fileName}`);
  }

  return await loadPDS4Image(xmlText, await dataHandle.getFile());
}

/**
 * Loads a PDS image from a directory chosen via the
 * [File System Access API](https://developer.mozilla.org/docs/Web/API/File_System_API).
 *
 * Detection order:
 * 1. A `.IMG` file **and** a same-stem `.LBL` file → **PDS3**.
 * 2. A `.xml` label whose `file_name` exists in the directory → **PDS4**.
 *
 * @param directoryHandle - Handle to the directory to search (not recursive).
 * @returns The parsed image.
 * @throws {Error} If no supported PDS dataset is found in the directory.
 */
export async function loadPDSImageFromDirectory(
  directoryHandle: FileSystemDirectoryHandle
): Promise<PDSImage> {
  const image = (await tryLoadPDS3(directoryHandle)) ?? (await tryLoadPDS4(directoryHandle));

  if (!image) {
    throw new Error('No supported PDS dataset found. Expected an IMG/LBL pair or a PDS4 XML file.');
  }

  return image;
}

/**
 * Same as {@link loadPDSImageFromDirectory}, but returns the decoded pixels
 * as the `ArrayBuffer` of a row-major `Float32Array`.
 *
 * @param directoryHandle - Handle to the directory to search (not recursive).
 * @returns `ArrayBuffer` containing the Float32 pixel data.
 * @throws {Error} If no supported PDS dataset is found in the directory.
 */
export async function loadPDSImageArrayBufferFromDirectory(
  directoryHandle: FileSystemDirectoryHandle
): Promise<ArrayBuffer> {
  const image = await loadPDSImageFromDirectory(directoryHandle);
  return image.toFloat32Array().buffer as ArrayBuffer;
}
