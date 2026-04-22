import { readValue } from '../parser/dataType';

/**
 * Parses and provides pixel-level access to a PDS4 `Array_2D_Image` product.
 *
 * A PDS4 dataset consists of an XML label (parsed by {@link parseXML})
 * and a binary image file. The constructor reads all required parameters
 * from the XML and validates that an `Array_2D_Image` element exists.
 */
export class PDS4Image {
  width: number;
  height: number;

  private readonly buffer: ArrayBuffer;
  private readonly view: DataView;

  private readonly dataType: string;
  private readonly offsetBytes: number;
  private readonly scaling: number;
  private readonly valueOffset: number;

  /**
   * Compiles a PDS4 image from the given XML header and binary data.
   * @param xml PDS Header XML data.
   * @param buffer PDS Image Data.
   */
  constructor(xml: Document, buffer: ArrayBuffer) {
    this.buffer = buffer;
    this.view = new DataView(buffer);

    const array = xml.getElementsByTagName('Array_2D_Image').item(0);
    if (!array) throw new Error('Array_2D_Image not found');

    // Resolve width (Sample axis) and height (Line axis) from Axis_Array elements.
    // getElementsByTagName is used throughout for compatibility with XML documents
    // in environments where CSS selector parsing may reject underscore-containing
    // element names (e.g. happy-dom).
    const axes = array.getElementsByTagName('Axis_Array');
    let widthEl: Element | null = null;
    let heightEl: Element | null = null;
    for (let i = 0; i < axes.length; i++) {
      const axis = axes.item(i)!;
      const axisName = axis
        .getElementsByTagName('axis_name')
        .item(0)?.textContent;
      if (axisName === 'Sample') {
        widthEl = axis.getElementsByTagName('elements').item(0);
      } else if (axisName === 'Line') {
        heightEl = axis.getElementsByTagName('elements').item(0);
      }
    }
    this.width = Number(widthEl?.textContent);
    this.height = Number(heightEl?.textContent);

    const elementArray = array.getElementsByTagName('Element_Array').item(0);
    this.dataType =
      elementArray?.getElementsByTagName('data_type').item(0)?.textContent ||
      '';

    this.offsetBytes = Number(
      xml
        .getElementsByTagName('File_Area_Observational')
        .item(0)
        ?.getElementsByTagName('Array_2D_Image')
        .item(0)
        ?.getElementsByTagName('offset')
        .item(0)?.textContent || 0,
    );

    this.scaling = Number(
      elementArray?.getElementsByTagName('scaling_factor').item(0)
        ?.textContent || 1,
    );

    this.valueOffset = Number(
      elementArray?.getElementsByTagName('value_offset').item(0)?.textContent ||
        0,
    );
  }

  /**
   * Returns the calibrated pixel value at column `x`, row `y`.
   * The raw sample is multiplied by `scaling_factor` and added to `value_offset`.
   *
   * @param x - Zero-based column index.
   * @param y - Zero-based row index.
   */
  getPixel(x: number, y: number): number {
    const bytesPerSample = this.getBytesPerSample();

    const index = y * this.width + x;
    const offset = this.offsetBytes + index * bytesPerSample;

    const raw = readValue(this.view, offset, this.dataType);

    return raw * this.scaling + this.valueOffset;
  }

  private getBytesPerSample(): number {
    switch (this.dataType) {
      case 'UnsignedByte':
      case 'SignedByte':
        return 1;

      case 'UnsignedMSB2':
      case 'UnsignedLSB2':
      case 'SignedMSB2':
      case 'SignedLSB2':
        return 2;

      case 'IEEE754MSBSingle':
      case 'IEEE754LSBSingle':
        return 4;

      default:
        throw new Error('Unknown type');
    }
  }

  /**
   * Decodes all pixels into a row-major {@link Float32Array}.
   * The length equals `width × height`.
   */
  toFloat32Array(): Float32Array {
    const out = new Float32Array(this.width * this.height);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        out[y * this.width + x] = this.getPixel(x, y);
      }
    }

    return out;
  }
}
