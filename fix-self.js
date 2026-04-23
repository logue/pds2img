import fs from 'node:fs';
const content = fs.readFileSync('dist/index.es.js', 'utf8');
const fixed = content.replaceAll(
  'self.rspackChunkpds2img',
  'globalThis.rspackChunkpds2img',
);
fs.writeFileSync('dist/index.es.js', fixed);
