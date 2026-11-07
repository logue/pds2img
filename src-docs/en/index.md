---
title: pds2img
description: pds2img converts NASA Planetary Data System (PDS3 / PDS4) image products to 16-bit PNG and TIFF in browsers and Node.js.
pageType: home

hero:
  name: pds2img
  text: NASA PDS images to PNG / TIFF
  tagline: Read PDS3 and PDS4 image products and export lossless 16-bit grayscale images, in the browser or in Node.js.
  actions:
    - theme: brand
      text: Get started
      link: /guide/start/introduction
    - theme: alt
      text: Try the playground
      link: /playground
  image:
    src: /saturn.png
    alt: Saturn photographed by Voyager 1, converted with pds2img
features:
  - title: PDS3 and PDS4
    details: Parses detached and attached PDS3 labels (.LBL) and PDS4 XML labels with Array_2D_Image products.
    icon: 🛰️
    link: /guide/usage/formats
  - title: Lossless 16-bit output
    details: Pixels are calibrated with the label's scaling and offset, then normalized to 16-bit grayscale PNG or TIFF.
    icon: 🖼️
    link: /api/encoders
  - title: Browser and Node.js
    details: Load from URLs, File objects, ArrayBuffers, Node.js Buffers or a directory picked with the File System Access API.
    icon: 🌐
    link: /guide/usage/browser
  - title: Command line
    details: Convert a single product or a whole directory with the bundled pds2img CLI.
    icon: ⌨️
    link: /guide/usage/cli
  - title: No native dependencies
    details: The PNG and TIFF encoders are written in TypeScript. xmldom is only loaded in environments without DOMParser.
    icon: 📦
    link: /guide/start/introduction
  - title: Typed API
    details: Ships TypeScript declarations for every public function, class and label type.
    icon: 🧩
    link: /api/
---
