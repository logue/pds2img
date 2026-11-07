---
title: Parsers
description: Reference for the pds2img PDS3 LBL and PDS4 XML label parsers.
---

# Parsers

## parseLBL

```ts
function parseLBL(buffer: ArrayBuffer | ArrayBufferView): PDSLabel;
```

Parses a PDS3 label into a [`PDSLabel`](./types#pdslabel). It accepts the bytes of a `.LBL` file, or of an `.IMG` file with an attached label. Parsing stops at `END`.

```ts
const label = parseLBL(lblBuffer);

label.RECORD_BYTES; // 1024
label['^IMAGE']; // ['C3592903_RAW.IMG', 4]
label.IMAGE; // { LINES: 800, LINE_SAMPLES: 800, LINE_PREFIX_BYTES: 224, ... }
label.EXPOSURE_DURATION; // { value: 1.44, unit: 'SECOND' }
```

`OBJECT` and `GROUP` blocks become nested objects keyed by their name. If several blocks share a name (for example, several `COLUMN` objects), the last one wins.

See [Supported formats](/guide/usage/formats#label-syntax) for how each kind of value is parsed.

## parseXML

```ts
function parseXML(xmlText: string): Promise<Document>;
```

Parses a PDS4 label. It uses the global `DOMParser` when available (browsers, happy-dom, jsdom). Otherwise it loads `@xmldom/xmldom` on demand.

```ts
const xml = await parseXML(xmlText);
xml.getElementsByTagName('target_name').item(0)?.textContent; // e.g. 'Mars'
```

:::tip
Use `getElementsByTagName` instead of `querySelector` with PDS4 documents. Some DOM implementations do not reliably match element names that contain underscores, such as `Array_2D_Image`.
:::
