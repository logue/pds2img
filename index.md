> For AI agents: the complete documentation index is available at /pds2img/llms.txt, the full documentation bundle is available at /pds2img/llms-full.txt.

# pds2img

NASA PDS images to PNG / TIFF

> Read PDS3 and PDS4 image products and export lossless 16-bit grayscale images, in the browser or in Node.js.

[Get started](/guide/start/introduction) | [Try the playground](/playground)

## Features

- [🛰️ **PDS3 and PDS4**](/guide/usage/formats): Parses detached and attached PDS3 labels (.LBL) and PDS4 XML labels with Array_2D_Image products.
- [🖼️ **Lossless 16-bit output**](/api/encoders): Pixels are calibrated with the label's scaling and offset, then normalized to 16-bit grayscale PNG or TIFF.
- [🌐 **Browser and Node.js**](/guide/usage/browser): Load from URLs, File objects, ArrayBuffers, Node.js Buffers or a directory picked with the File System Access API.
- [⌨️ **Command line**](/guide/usage/cli): Convert a single product or a whole directory with the bundled pds2img CLI.
- [📦 **No native dependencies**](/guide/start/introduction): The PNG and TIFF encoders are written in TypeScript. xmldom is only loaded in environments without DOMParser.
- [🧩 **Typed API**](/api/): Ships TypeScript declarations for every public function, class and label type.
