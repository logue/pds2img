/**
 * Parses a PDS4 XML label string into a DOM {@link Document}.
 *
 * Uses the browser's `DOMParser` when available, or falls back to the
 * `xmldom` npm package for Node.js / server-side environments.
 *
 * @param xmlText - Full text content of a PDS4 `.xml` label file.
 * @returns Promise that resolves to a parsed XML document.
 */
export async function parseXML(xmlText: string): Promise<Document> {
  if (typeof DOMParser === 'undefined') {
    const { DOMParser } = await import('xmldom');
    return new DOMParser().parseFromString(xmlText, 'application/xml');
  } else {
    return new DOMParser().parseFromString(xmlText, 'application/xml');
  }
}
