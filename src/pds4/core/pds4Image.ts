import { assertBufferSize, assertDimension, PDSImageBase } from '@/core/pdsImageBase';
import {
  bytesPerSample,
  type PDS4DataType,
  readValue,
  toPDS4DataType
} from '@/pds4/parser/dataType';
import { getChildText } from '@/pds4/parser/xmlParser';

/** Reads a numeric child element, falling back when it is absent. */
function readNumber(parent: Element | undefined, tagName: string, fallback: number): number {
  const text = getChildText(parent, tagName);
  if (text === undefined) return fallback;

  const value = Number(text);
  if (Number.isNaN(value)) {
    throw new TypeError(`Expected a numeric <${tagName}> but got: ${text}`);
  }
  return value;
}

/**
 * Parses and provides pixel-level access to a PDS4 `Array_2D_Image` product.
 *
 * A PDS4 product consists of an XML label (parsed by {@link parseXML}) and a
 * binary data file. The constructor reads geometry, data type and scaling
 * from the first `Array_2D_Image` element in the label.
 */
export class PDS4Image extends PDSImageBase {
  readonly width: number;
  readonly height: number;
  /** Sample data type (`Element_Array/data_type`). */
  readonly dataType: PDS4DataType;

  private readonly view: DataView;
  private readonly sampleBytes: number;
  private readonly offsetBytes: number;
  private readonly scaling: number;
  private readonly valueOffset: number;

  /**
   * @param xml - Parsed PDS4 label.
   * @param buffer - Contents of the data file referenced by the label.
   * @throws {Error} If the label has no `Array_2D_Image` or the data is truncated.
   */
  constructor(xml: Document, buffer: ArrayBuffer) {
    super();

    const array = xml.getElementsByTagName('Array_2D_Image').item(0);
    if (!array) {
      throw new Error('Array_2D_Image not found in label');
    }

    // Width is the Sample axis and height the Line axis.
    let width: number | undefined;
    let height: number | undefined;
    for (const axis of Array.from(array.getElementsByTagName('Axis_Array'))) {
      const name = getChildText(axis, 'axis_name');
      const elements = readNumber(axis, 'elements', NaN);
      if (name === 'Sample') width = elements;
      else if (name === 'Line') height = elements;
    }
    this.width = assertDimension('width (Sample axis)', width ?? NaN);
    this.height = assertDimension('height (Line axis)', height ?? NaN);

    const elementArray = array.getElementsByTagName('Element_Array').item(0) ?? undefined;
    this.dataType = toPDS4DataType(getChildText(elementArray, 'data_type') ?? '');
    this.sampleBytes = bytesPerSample[this.dataType];
    this.scaling = readNumber(elementArray, 'scaling_factor', 1);
    this.valueOffset = readNumber(elementArray, 'value_offset', 0);

    // `offset` is a direct child of Array_2D_Image and precedes its descendants.
    this.offsetBytes = readNumber(array, 'offset', 0);

    this.view = new DataView(buffer);
    assertBufferSize(buffer, this.offsetBytes + this.width * this.height * this.sampleBytes);
  }

  /**
   * Returns the calibrated pixel value at column `x`, row `y`:
   * `raw × scaling_factor + value_offset`.
   *
   * @param x - Zero-based column index.
   * @param y - Zero-based row index.
   */
  getPixel(x: number, y: number): number {
    const offset = this.offsetBytes + (y * this.width + x) * this.sampleBytes;
    return readValue(this.view, offset, this.dataType) * this.scaling + this.valueOffset;
  }
}
