---
title: In the browser
description: Use pds2img in the browser with URLs, file inputs, the File System Access API, image previews and downloads.
---

# In the browser

All conversion happens on the client, so files are never uploaded.

## From URLs

```ts
import { loadPDS3ImageByUrl, loadPDS4ImageByUrl } from 'pds2img';

// PDS3: the label URL defaults to the image URL with `.LBL`.
const voyager = await loadPDS3ImageByUrl('/data/C3592903_RAW.IMG');
// ...or pass it explicitly when the names differ.
const other = await loadPDS3ImageByUrl('/data/image.img', '/labels/image.lbl');

// PDS4: the data URL defaults to <file_name> in the label, relative to the label URL.
const hazcam = await loadPDS4ImageByUrl('/data/FLG_1739_…_0A01I4J01.xml');
```

A non-2xx response rejects the promise with an error that includes the status code.

:::warning CORS
The PDS archives do not always send CORS headers. If a direct fetch fails, download the files first, serve them from your own origin, or let users pick them with a file input.
:::

## From file inputs

Use two inputs, one for the label and one for the image data. This is what the [playground](/playground) does.

```html
<input id="label" type="file" accept=".lbl,.xml" /> <input id="data" type="file" accept=".img" />
```

```ts
import { loadPDS3ImageByFile, loadPDS4ImageByFile, toPNG } from 'pds2img';

const label = document.querySelector<HTMLInputElement>('#label')!.files![0];
const data = document.querySelector<HTMLInputElement>('#data')!.files![0];

const image = label.name.toLowerCase().endsWith('.xml')
  ? await loadPDS4ImageByFile(label, data) // PDS4: (xml, img)
  : await loadPDS3ImageByFile(data, label); // PDS3: (img, lbl)
```

:::tip Argument order
`loadPDS3ImageByFile(img, lbl?)` takes the **image first** because the label is optional: a PDS3 file with an **attached label** is loaded with `loadPDS3ImageByFile(img)`. `loadPDS4ImageByFile(xml, img)` takes the label first, like `loadPDS4ImageByUrl`.
:::

## From a directory (File System Access API)

In browsers that support [`showDirectoryPicker`](https://developer.mozilla.org/docs/Web/API/Window/showDirectoryPicker), you can let the user pick a folder and detect the product automatically:

```ts
import { loadPDSImageFromDirectory, toPNG } from 'pds2img';

const directory = await window.showDirectoryPicker();
const image = await loadPDSImageFromDirectory(directory);
```

The directory is searched (not recursively) for:

1. an `.IMG` file with a `.LBL` file of the same name → PDS3, otherwise
2. an `.xml` label whose `file_name` exists in the directory → PDS4.

`loadPDSImageArrayBufferFromDirectory` does the same and returns the decoded `Float32Array` pixel buffer instead of the image object.

## Show a preview

Browsers can display 16-bit grayscale PNGs directly:

```ts
const url = URL.createObjectURL(new Blob([toPNG(image)], { type: 'image/png' }));
document.querySelector('img')!.src = url;
// Call URL.revokeObjectURL(url) when the preview is no longer needed.
```

## Save the result

```ts
function download(buffer: ArrayBuffer, type: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([buffer], { type }));
  const anchor = Object.assign(document.createElement('a'), { href: url, download: fileName });
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

download(toPNG(image), 'image/png', 'output.png');
download(toTIFF(image), 'image/tiff', 'output.tiff');
```

With the File System Access API you can ask the user where to save:

```ts
const handle = await window.showSaveFilePicker({
  suggestedName: 'output.tiff',
  types: [{ description: 'TIFF image', accept: { 'image/tiff': ['.tiff', '.tif'] } }]
});
const writable = await handle.createWritable();
await writable.write(toTIFF(image));
await writable.close();
```

## Working with raw pixels

Every image implements the [`PDSImage`](/api/images#pdsimage) interface, so you can process calibrated values yourself. For example, you can draw them on a canvas with your own contrast stretch:

```ts
const pixels = image.toFloat32Array(); // row-major, length = width × height
const value = image.getPixel(10, 20); // column 10, row 20
```
