> For AI agents: the complete documentation index is available at /pds2img/llms.txt, the full documentation bundle is available at /pds2img/llms-full.txt.

# Command line

The package includes a `pds2img` command.

```bash
npx pds2img --help
```

## Options

| Option                     | Description                                                                      |
| -------------------------- | -------------------------------------------------------------------------------- |
| `-i, --input <pathOrStem>` | Input base path (`C3592903_RAW`), `.IMG` path, or `.xml` path                    |
| `-d, --dir <directory>`    | Convert all supported products in a directory                                    |
| `-t, --type <format>`      | Output format, `png` (default) or `tiff`. `-type` is accepted for compatibility. |
| `-o, --output <file>`      | Output file. In `--dir` mode, an output directory.                               |
| `-v, --version`            | Print the version and build date                                                 |

Use either `-i` or `-d`, not both.

## Examples

```bash
# PDS3 by base name → C3592903_RAW.png
pds2img -i C3592903_RAW

# Explicit input and output, as TIFF
pds2img -i ./data/C3592903_RAW.IMG -t tiff -o ./out/voyager.tiff

# PDS4 by label
pds2img -i ./data/FLG_1739_0821318674_675RAS_N0830000FHAZ00505_0A01I4J01.xml

# Convert every product in a directory into another directory
pds2img -d ./data -t png -o ./out
```

## How inputs are resolved

- A `.xml` path is read as PDS4. The data file comes from `<file_name>` in the label.
- A `.IMG` path is read as PDS3 with the `.LBL` file of the same name (`.LBL` or `.lbl`).
- A base path without an extension is tried as PDS3 (`.IMG` + `.LBL`) first, then as PDS4 (`.xml`).
- In directory mode, every `.IMG` with a matching `.LBL`, and every `.xml`, is converted. Output files are named after the source file.

:::tip Windows
In PowerShell, run `./bin/pds2img.cmd` from a repository checkout.
:::

## Running from a checkout

The CLI loads the built library from `dist/`, so build it first:

```bash
pnpm install
pnpm run build
bin/pds2img -i src/__tests__/data/C3592903_RAW
```
