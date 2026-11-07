> For AI agents: the complete documentation index is available at /pds2img/llms.txt, the full documentation bundle is available at /pds2img/llms-full.txt.

# Supported formats

## PDS3

pds2img reads the **first `IMAGE` object** in the label, searching nested `OBJECT` / `GROUP` blocks.

### Label syntax

| Syntax                     | Example                         | Parsed as                         |
| -------------------------- | ------------------------------- | --------------------------------- |
| Integer / real             | `LINES = 800`, `1.5E-3`         | `number`                          |
| Based integer              | `SAMPLE_BIT_MASK = 2#11111111#` | `255`                             |
| Quoted string (multi-line) | `DESCRIPTION = "…"`             | `string`, line breaks preserved   |
| Symbol / identifier        | `'N/A'`, `MSB_INTEGER`          | `string`                          |
| Quantity                   | `1.440 <SECOND>`                | `{ value: 1.44, unit: 'SECOND' }` |
| Sequence / set             | `("FILE.IMG", 4)`, `{A, B}`     | array                             |
| Blocks                     | `OBJECT = IMAGE … END_OBJECT`   | nested object                     |
| Comments                   | `/* … */`                       | ignored, except inside strings    |

Values that span several lines (strings and lists) are joined. Parsing stops at `END`, so attached labels can be parsed from the whole file.

### `IMAGE` keywords

| Keyword                                  | Required | Default       | Notes                                   |
| ---------------------------------------- | -------- | ------------- | --------------------------------------- |
| `LINES`, `LINE_SAMPLES`                  | ✓        |               | Height and width                        |
| `SAMPLE_BITS`                            | ✓        |               | 8, 16, 32 (integers); 32, 64 (reals)    |
| `SAMPLE_TYPE`                            |          | `MSB_INTEGER` | See below                               |
| `LINE_PREFIX_BYTES`, `LINE_SUFFIX_BYTES` |          | `0`           | Skipped on every line                   |
| `SCALING_FACTOR`, `OFFSET`               |          | `1`, `0`      | `value = raw × SCALING_FACTOR + OFFSET` |
| `INVALID_CONSTANT`, `MISSING_CONSTANT`   |          |               | Matching raw samples become `NaN`       |

### `^IMAGE` pointer

| Form                                  | Meaning                             |
| ------------------------------------- | ----------------------------------- |
| `^IMAGE = 4` / `4 <RECORDS>`          | Record 4 (1-based) × `RECORD_BYTES` |
| `^IMAGE = 3073 <BYTES>`               | Byte 3073 (1-based)                 |
| `^IMAGE = ("FILE.IMG", 4)`            | Record 4 of a detached file         |
| `^IMAGE = ("FILE.IMG", 3073 <BYTES>)` | Byte 3073 of a detached file        |
| `^IMAGE = "FILE.IMG"`                 | Start of a detached file            |

### `SAMPLE_TYPE`

- **Signed integers**: `MSB_INTEGER`, `LSB_INTEGER`, `SUN_INTEGER`, `MAC_INTEGER`, `PC_INTEGER`, `VAX_INTEGER`
- **Unsigned integers**: `UNSIGNED_INTEGER`, `MSB_UNSIGNED_INTEGER`, `LSB_UNSIGNED_INTEGER`, `PC_UNSIGNED_INTEGER`, `VAX_UNSIGNED_INTEGER`, …
- **IEEE reals**: `IEEE_REAL`, `MSB_REAL`, `PC_REAL`, `LSB_REAL`

Types containing `LSB`, `PC_` or `VAX_` are read as little-endian. All others are big-endian.

:::warning Not supported
VAX floating point (`VAX_REAL`), multi-band images (`BANDS > 1`; only the first band is read), and compressed products such as `.IMQ` are not supported.
:::

## PDS4

pds2img reads the **first `Array_2D_Image`** in the label.

| Element                                        | Notes                                                         |
| ---------------------------------------------- | ------------------------------------------------------------- |
| `File_Area_Observational/File/file_name`       | Data file, used by `loadPDS4ImageByUrl` and directory loading |
| `Array_2D_Image/offset`                        | Byte offset of the array in the data file                     |
| `Axis_Array` (`axis_name` = `Line` / `Sample`) | Height / width                                                |
| `Element_Array/data_type`                      | See below                                                     |
| `Element_Array/scaling_factor`, `value_offset` | `value = raw × scaling_factor + value_offset`                 |

### `data_type`

| Size    | Types                                                                                              |
| ------- | -------------------------------------------------------------------------------------------------- |
| 1 byte  | `UnsignedByte`, `SignedByte`                                                                       |
| 2 bytes | `UnsignedMSB2`, `UnsignedLSB2`, `SignedMSB2`, `SignedLSB2`                                         |
| 4 bytes | `UnsignedMSB4`, `UnsignedLSB4`, `SignedMSB4`, `SignedLSB4`, `IEEE754MSBSingle`, `IEEE754LSBSingle` |
| 8 bytes | `IEEE754MSBDouble`, `IEEE754LSBDouble`                                                             |

The axis order is assumed to be _Last Index Fastest_ (samples within a line are contiguous), which is the PDS4 default. `Special_Constants` are not applied.

## Output

`toPNG` and `toTIFF` write **16-bit grayscale** images with no compression:

- the finite min/max of the calibrated pixels is mapped linearly to `0…65535`
- `NaN` and `±Infinity` pixels are written as `0`
- a constant image is written as all zeros
- PNG is big-endian with stored (uncompressed) DEFLATE blocks; TIFF is little-endian (`II`) with a single strip
