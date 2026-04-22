import { defineConfig } from '@rsbuild/core';

// Docs: https://rsbuild.rs/config/
export default defineConfig(({ envMode }) => {
  const isUmd = envMode === 'umd';

  return {
    source: {
      // Library entry point
      entry: { index: './src/index.ts' },
    },
    output: {
      // ESM uses Rspack's library.type:'module' directly rather than Rsbuild's
      // output.module flag, which would conflict with the Rspack-level setting.
      filename: { js: isUmd ? 'index.umd.js' : 'index.es.js' },
      filenameHash: false,
      // Output JS files directly in dist/ (no static/js/ subdirectory)
      distPath: { root: 'dist', js: '' },
      // Only clean dist/ on the first (ESM) build so the UMD build
      // does not overwrite the already-emitted ESM bundle.
      cleanDistPath: !isUmd,
    },
    tools: {
      rspack: {
        resolve: {
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
        // Emit a single self-contained file — no runtime chunk or vendor splits
        optimization: {
          runtimeChunk: false,
          splitChunks: false,
        },
        // Enable outputModule for ESM so Rspack can use 'module' library type
        experiments: isUmd ? {} : { outputModule: true },
        output: {
          library: isUmd
            ? { name: 'PDSToImage', type: 'umd' }
            : { type: 'module' },
        },
      },
      // Disable HTML output — this project is a library, not an application
      htmlPlugin: false,
    },
  };
});
