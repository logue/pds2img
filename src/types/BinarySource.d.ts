/**
 * Binary input accepted by the loader functions.
 *
 * - `ArrayBuffer` / typed arrays / Node.js `Buffer`
 * - `Blob` / `File` (e.g. from `<input type="file">` or the File System Access API)
 */
export type BinarySource = ArrayBuffer | ArrayBufferView | Blob;
