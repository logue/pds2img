---
title: In Node.js
description: Use pds2img in Node.js with Buffers, attached PDS3 labels and batch conversion.
---

# In Node.js

The loaders accept Node.js `Buffer`s directly, so you don't need to slice `ArrayBuffer`s yourself.

## PDS3

```ts
import { readFile, writeFile } from 'node:fs/promises';
import { loadPDS3Image, toPNG } from 'pds2img';

// Detached label: label first, then image data.
const image = await loadPDS3Image(
  await readFile('C3592903_RAW.LBL'),
  await readFile('C3592903_RAW.IMG')
);

await writeFile('C3592903_RAW.png', Buffer.from(toPNG(image)));
```

For an **attached label** (label and pixels in the same file), pass only the file:

```ts
const image = await loadPDS3Image(await readFile('ATTACHED.IMG'));
```

Parsing stops at the label's `END` statement, and `^IMAGE` points into the same file.

## PDS4

```ts
import { readFile, writeFile } from 'node:fs/promises';
import { loadPDS4Image, toTIFF } from 'pds2img';

const image = await loadPDS4Image(
  await readFile('FLG_1739_…_0A01I4J01.xml', 'utf8'), // a string or a Buffer
  await readFile('FLG_1739_…_0A01I4J01.IMG')
);

await writeFile('hazcam.tiff', Buffer.from(toTIFF(image)));
```

Node.js has no built-in `DOMParser`, so `parseXML` loads [`@xmldom/xmldom`](https://www.npmjs.com/package/@xmldom/xmldom) on demand.

## Batch conversion

```ts
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadPDS3Image, toPNG } from 'pds2img';

const directory = './data';

for (const name of await readdir(directory)) {
  if (path.extname(name).toLowerCase() !== '.lbl') continue;

  const stem = path.parse(name).name;
  const image = await loadPDS3Image(
    await readFile(path.join(directory, name)),
    await readFile(path.join(directory, `${stem}.IMG`))
  );
  await writeFile(path.join(directory, `${stem}.png`), Buffer.from(toPNG(image)));
}
```

For quick jobs, the [CLI](/guide/usage/cli) already does this with `pds2img -d ./data`.

## Inspecting labels

Use `parseLBL` to read PDS3 metadata without decoding the pixels:

```ts
import { readFile } from 'node:fs/promises';
import { parseLBL } from 'pds2img';

const label = parseLBL(await readFile('C3592903_RAW.LBL'));

label.TARGET_NAME; // 'SATURN'
label.EXPOSURE_DURATION; // { value: 1.44, unit: 'SECOND' }
label['^IMAGE']; // ['C3592903_RAW.IMG', 4]
```
