> For AI agents: the complete documentation index is available at /pds2img/llms.txt, the full documentation bundle is available at /pds2img/llms-full.txt.

# Getting started

## Installation

```bash
# pnpm
pnpm add pds2img
# npm
npm install pds2img
# yarn
yarn add pds2img
```

Node.js 22 or later is required. In browsers, the ESM build works with any modern bundler. A UMD build is also available as `pds2img/umd` and exposes the global `Pds2Img`:

```html
<script src="https://cdn.jsdelivr.net/npm/pds2img/dist/index.umd.js"></script>
<script>
  const { loadPDS3ImageByUrl, toPNG } = window.Pds2Img;
</script>
```

## Get some data

Every PDS image product has a **label** that describes it and **image data**. You can download sample products from the [PDS Imaging Node Atlas](https://pds-imaging.jpl.nasa.gov/tools/atlas/). The examples on this site use:

- **PDS3**: Voyager 1, Saturn encounter, `C3592903_RAW.LBL` + `C3592903_RAW.IMG` ([source](https://pds-imaging.jpl.nasa.gov/tools/atlas/record?uri=atlas:pds3:vgr:voyager:/VGISS_6xxx/VGISS_6121/DATA/C35929XX/C3592903_RAW.IMG))
- **PDS4**: Mars 2020 Perseverance Front Hazcam, `FLG_1739_…_0A01I4J01.xml` + `.IMG` ([source](https://pds-imaging.jpl.nasa.gov/tools/atlas/record?uri=atlas:pds4:mars_2020:perseverance:/mars2020_hazcam_ops_calibrated/data/sol/01739/ids/rdr/fcam/FLG_1739_0821318674_675RAS_N0830000FHAZ00505_0A01I4J01.IMG))

## Convert your first image

### PDS3

```ts
import { loadPDS3ImageByUrl, toPNG } from 'pds2img';

// The .LBL URL is derived from the .IMG URL.
const image = await loadPDS3ImageByUrl('/data/C3592903_RAW.IMG');

console.log(image.width, image.height); // 800 800
const png: ArrayBuffer = toPNG(image);
```

### PDS4

```ts
import { loadPDS4ImageByUrl, toTIFF } from 'pds2img';

// The data file is resolved from <file_name> in the label.
const image = await loadPDS4ImageByUrl(
  '/data/FLG_1739_0821318674_675RAS_N0830000FHAZ00505_0A01I4J01.xml'
);

const tiff: ArrayBuffer = toTIFF(image);
```

### Node.js

```ts
import { readFile, writeFile } from 'node:fs/promises';
import { loadPDS3Image, toPNG } from 'pds2img';

const image = await loadPDS3Image(
  await readFile('C3592903_RAW.LBL'),
  await readFile('C3592903_RAW.IMG')
);

await writeFile('C3592903_RAW.png', Buffer.from(toPNG(image)));
```

You can also skip the code and use the [command line tool](/pds2img/guide/usage/cli.md):

```bash
npx pds2img -i C3592903_RAW -t png
```

## Next steps

- [In the browser](/pds2img/guide/usage/browser.md): file inputs, directory pickers and downloads.
- [In Node.js](/pds2img/guide/usage/node.md): buffers and batch conversion.
- [API reference](/pds2img/api/index.md): every exported function and class.
