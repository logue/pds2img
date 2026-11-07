---
title: Loaders
description: Reference for the pds2img loader functions for PDS3, PDS4 and directories.
---

# Loaders

Loaders turn a label and its image data into a [`PDS3Image`](./images#pds3image) or [`PDS4Image`](./images#pds4image). Every loader is `async`.

Binary arguments accept any [`BinarySource`](./types#binarysource): an `ArrayBuffer`, a typed array, a Node.js `Buffer`, a `Blob` or a `File`.

## PDS3

### loadPDS3Image

```ts
function loadPDS3Image(label: BinarySource, data?: BinarySource): Promise<PDS3Image>;
```

Loads a PDS3 image from in-memory data.

| Parameter | Description                                                                 |
| --------- | --------------------------------------------------------------------------- |
| `label`   | Contents of the `.LBL` file. For an attached label, the `.IMG` file itself. |
| `data`    | Contents of the `.IMG` file. Omit for attached labels.                      |

```ts
await loadPDS3Image(lblBuffer, imgBuffer); // detached label
await loadPDS3Image(imgBuffer); // attached label
```

### loadPDS3ImageByFile

```ts
function loadPDS3ImageByFile(imgFile: Blob, lblFile?: Blob): Promise<PDS3Image>;
```

Loads a PDS3 image from `File` / `Blob` objects. Note that the **image comes first**. Omit `lblFile` when the label is attached to `imgFile`.

:::warning Changed in this version
Earlier versions took a single file and split it in half into label and data. That never matched how PDS3 files are laid out. A single argument is now read as an attached label.
:::

### loadPDS3ImageByUrl

```ts
function loadPDS3ImageByUrl(imgUrl: string | URL, lblUrl?: string | URL): Promise<PDS3Image>;
```

Fetches the image and label in parallel. `lblUrl` defaults to `imgUrl` with the `.IMG` extension replaced by `.LBL`.

**Throws** if either response is not 2xx.

## PDS4

### loadPDS4Image

```ts
function loadPDS4Image(label: string | BinarySource, data: BinarySource): Promise<PDS4Image>;
```

Loads a PDS4 image from in-memory data. `label` may be XML text or binary (decoded as UTF-8).

### loadPDS4ImageByFile

```ts
function loadPDS4ImageByFile(xmlFile: Blob, imgFile: Blob): Promise<PDS4Image>;
```

Loads a PDS4 image from `File` / `Blob` objects: the XML label first, then the data file.

### loadPDS4ImageByUrl

```ts
function loadPDS4ImageByUrl(xmlUrl: string | URL, imgUrl?: string | URL): Promise<PDS4Image>;
```

Fetches the label, then the data file. If `imgUrl` is omitted, it is resolved from `File_Area_Observational/File/file_name`, relative to `xmlUrl`.

**Throws** if a response is not 2xx, or if `imgUrl` is omitted and the label has no `file_name`.

## Directories

These functions need the [File System Access API](https://developer.mozilla.org/docs/Web/API/File_System_API), which is browser only.

### loadPDSImageFromDirectory

```ts
function loadPDSImageFromDirectory(directoryHandle: FileSystemDirectoryHandle): Promise<PDSImage>;
```

Searches the directory (not recursively) and loads the first product found:

1. an `.IMG` file and a `.LBL` file with the same stem → PDS3
2. an `.xml` label whose `file_name` exists in the directory → PDS4

**Throws** if no product is found, or if a PDS4 label references a missing file.

### loadPDSImageArrayBufferFromDirectory

```ts
function loadPDSImageArrayBufferFromDirectory(
  directoryHandle: FileSystemDirectoryHandle
): Promise<ArrayBuffer>;
```

Same as `loadPDSImageFromDirectory`, but returns the `ArrayBuffer` behind `image.toFloat32Array()`.

```ts
const pixels = new Float32Array(await loadPDSImageArrayBufferFromDirectory(directory));
```
