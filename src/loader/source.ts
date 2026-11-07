import type { BinarySource } from '@/types/BinarySource';

/**
 * Reads any {@link BinarySource} into a standalone `ArrayBuffer`.
 * Typed-array views (including Node.js `Buffer`) are copied so the result
 * does not alias a larger pooled buffer.
 */
export async function readArrayBuffer(source: BinarySource): Promise<ArrayBuffer> {
  if (source instanceof ArrayBuffer) {
    return source;
  }

  if (ArrayBuffer.isView(source)) {
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength).slice().buffer;
  }

  return await source.arrayBuffer();
}

/** Reads a string or {@link BinarySource} as UTF-8 text. */
export async function readText(source: string | BinarySource): Promise<string> {
  if (typeof source === 'string') {
    return source;
  }

  if (source instanceof Blob) {
    return await source.text();
  }

  return new TextDecoder('utf-8').decode(source);
}

/**
 * Fetches `url` and returns the response body as an `ArrayBuffer`.
 *
 * @throws {Error} If the response status is not 2xx.
 */
export async function fetchArrayBuffer(url: string | URL): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url.toString()}: ${String(response.status)} ${response.statusText}`
    );
  }
  return await response.arrayBuffer();
}
