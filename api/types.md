> For AI agents: the complete documentation index is available at /pds2img/llms.txt, the full documentation bundle is available at /pds2img/llms-full.txt.

# Types

All types are exported from the package root:

```ts
import type {
  BinarySource,
  PDS4DataType,
  PDSImage,
  PDSLabel,
  PDSQuantity,
  PDSValue
} from 'pds2img';
```

## BinarySource

```ts
type BinarySource = ArrayBuffer | ArrayBufferView | Blob;
```

Binary input accepted by the loaders: `ArrayBuffer`, typed arrays, Node.js `Buffer`, `Blob` and `File`. Views are copied, so a pooled `Buffer` is never read past its own bytes.

## PDSLabel

```ts
type PDSLabel = { [key: string]: PDSValue };
```

A parsed PDS3 label or a nested `OBJECT` / `GROUP` block.

## PDSValue

```ts
type PDSValue = number | string | PDSValue[] | PDSQuantity | PDSLabel;
```

A value in a PDS3 label.

## PDSQuantity

```ts
type PDSQuantity = { value: PDSValue; unit: string };
```

A value with a unit, such as `1.440 <SECOND>`.

## PDS4DataType

```ts
type PDS4DataType =
  | 'UnsignedByte'
  | 'SignedByte'
  | 'UnsignedMSB2'
  | 'UnsignedLSB2'
  | 'SignedMSB2'
  | 'SignedLSB2'
  | 'UnsignedMSB4'
  | 'UnsignedLSB4'
  | 'SignedMSB4'
  | 'SignedLSB4'
  | 'IEEE754MSBSingle'
  | 'IEEE754LSBSingle'
  | 'IEEE754MSBDouble'
  | 'IEEE754LSBDouble';
```

The PDS4 `data_type` values that [`PDS4Image`](/pds2img/api/images.md#pds4image) can decode.

## PDSImage

See [Images](/pds2img/api/images.md#pdsimage).
