> For AI agents: the complete documentation index is available at /pds2img/llms.txt, the full documentation bundle is available at /pds2img/llms-full.txt.

# Images

## PDSImage

```ts
interface PDSImage {
  readonly width: number;
  readonly height: number;
  getPixel(x: number, y: number): number;
  toFloat32Array(): Float32Array;
}
```

The interface implemented by both image classes. All encoders accept it.

| Member             | Description                                                                      |
| ------------------ | -------------------------------------------------------------------------------- |
| `width`, `height`  | Image size in pixels                                                             |
| `getPixel(x, y)`   | Calibrated value at column `x`, row `y` (zero-based). Invalid samples are `NaN`. |
| `toFloat32Array()` | All calibrated values, row-major, length `width × height`                        |

## PDS3Image

```ts
class PDS3Image implements PDSImage {
  constructor(label: PDSLabel, buffer: ArrayBuffer);
  readonly width: number;
  readonly height: number;
  readonly bits: number;
}
```

Decodes the first `IMAGE` object of a PDS3 label.

| Parameter | Description                                                      |
| --------- | ---------------------------------------------------------------- |
| `label`   | Parsed label from [`parseLBL`](/pds2img/api/parsers.md#parselbl) |
| `buffer`  | The image data file, or the whole file for attached labels       |

`bits` is the `SAMPLE_BITS` value. `getPixel` returns `raw × SCALING_FACTOR + OFFSET`, or `NaN` when the raw sample equals `INVALID_CONSTANT` or `MISSING_CONSTANT`.

**Throws** when the label has no `IMAGE` object or `^IMAGE` pointer, when the dimensions or sample type are invalid or unsupported, or when `buffer` is too small for the described image.

```ts
import { parseLBL, PDS3Image } from 'pds2img';

const image = new PDS3Image(parseLBL(lblBuffer), imgBuffer);
```

Most code should use [`loadPDS3Image`](/pds2img/api/loaders.md#loadpds3image) instead.

## PDS4Image

```ts
class PDS4Image implements PDSImage {
  constructor(xml: Document, buffer: ArrayBuffer);
  readonly width: number;
  readonly height: number;
  readonly dataType: PDS4DataType;
}
```

Decodes the first `Array_2D_Image` of a PDS4 label.

| Parameter | Description                                                      |
| --------- | ---------------------------------------------------------------- |
| `xml`     | Parsed label from [`parseXML`](/pds2img/api/parsers.md#parsexml) |
| `buffer`  | The data file referenced by the label                            |

`dataType` is the `Element_Array/data_type` value. `getPixel` returns `raw × scaling_factor + value_offset`.

**Throws** when the label has no `Array_2D_Image`, when the axes or `data_type` are missing or unsupported, or when `buffer` is too small.

```ts
import { parseXML, PDS4Image } from 'pds2img';

const image = new PDS4Image(await parseXML(xmlText), imgBuffer);
```

Most code should use [`loadPDS4Image`](/pds2img/api/loaders.md#loadpds4image) instead.
