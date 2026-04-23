import { defineConfig } from '@rsbuild/core';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

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
    plugins: [
      {
        name: 'fix-self-reference',
        setup(api) {
          api.onAfterBuild(async () => {
            // Only process ESM build (not UMD)
            if (isUmd) return;

            try {
              const distDir = 'dist';
              // Use absolute path to ensure we're targeting the right file
              const esMFile = path.resolve(
                process.cwd(),
                distDir,
                'index.es.js',
              );

              // Read the ESM bundle
              let content = await readFile(esMFile, 'utf-8');

              // Replace 'self' with 'globalThis' to fix Node.js CLI compatibility
              // This fixes "self is not defined" errors when running CLI on macOS/Unix
              const newContent = content.replace(/\bself\b/g, 'globalThis');

              if (content !== newContent) {
                await writeFile(esMFile, newContent, 'utf-8');
                console.log(
                  'Successfully replaced self with globalThis in index.es.js',
                );
              } else {
                console.warn('Warning: "self" not found in index.es.js');
              }
            } catch (error) {
              console.warn('Warning: Failed to fix self reference:', error);
            }
          });
        },
      },
    ],
  };
});
