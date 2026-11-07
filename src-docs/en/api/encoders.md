---
title: Encoders
description: Reference for the pds2img PNG and TIFF encoders.
---

# Encoders

All encoders write **16-bit grayscale** files. The finite min/max of the pixels is mapped linearly to `0…65535`. `NaN` and `±Infinity` pixels are written as `0`, and a constant image is written as all zeros.

The encoders are synchronous and return an `ArrayBuffer` containing the whole file.

## toPNG

```ts
function toPNG(image: PDSImage): ArrayBuffer;
```

Encodes an image as a PNG with stored (uncompressed) DEFLATE blocks. The file is valid but about `width × height × 2` bytes in size. Re-compress it with an image tool if size matters.

## toTIFF

```ts
function toTIFF(image: PDSImage): ArrayBuffer;
```

Encodes an image as an uncompressed little-endian (`II`) baseline TIFF with a single strip.

## encodeToPNG

```ts
function encodeToPNG(pixels: Float32Array, width: number, height: number): ArrayBuffer;
```

Low-level form of `toPNG` for pixel data that does not come from a PDS image. For example, you can encode a processed copy:

```ts
const pixels = image.toFloat32Array().map(value => Math.log1p(Math.max(0, value)));
const png = encodeToPNG(pixels, image.width, image.height);
```

**Throws** `RangeError` if `width × height` does not equal `pixels.length`.

## encodeToTIFF

```ts
function encodeToTIFF(pixels: Float32Array, width: number, height: number): ArrayBuffer;
```

Low-level form of `toTIFF`. **Throws** `RangeError` if `width × height` does not equal `pixels.length`.
