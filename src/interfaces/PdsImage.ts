import type { PDS3Image } from '../pds3/core/pds3Image';
import type { PDS4Image } from '../pds4/core/pds4Image';

/** Common interface satisfied by both {@link PDS3Image} and {@link PDS4Image}. */
export interface PDSImage {
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Converts the image to a Float32Array */
  toFloat32Array(): Float32Array;
}
