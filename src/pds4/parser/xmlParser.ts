/**
 * Parses a PDS4 XML label string into a DOM {@link Document}.
 *
 * Uses the browser's `DOMParser` when available, or falls back to the
 * `@xmldom/xmldom` package for Node.js / server-side environments.
 *
 * @param xmlText - Full text content of a PDS4 `.xml` label file.
 * @returns Promise that resolves to a parsed XML document.
 */
export async function parseXML(xmlText: string): Promise<Document> {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(xmlText, 'application/xml');
  }

  const { DOMParser: XmldomParser } = await import('@xmldom/xmldom');
  return new XmldomParser().parseFromString(xmlText, 'application/xml') as unknown as Document;
}

/**
 * Returns the trimmed text of the first descendant of `parent` named `tagName`.
 *
 * `getElementsByTagName` is used instead of CSS selectors because some DOM
 * implementations (e.g. happy-dom, xmldom) do not reliably support selectors
 * on XML element names containing underscores.
 */
export function getChildText(
  parent: Document | Element | undefined,
  tagName: string
): string | undefined {
  const text = parent?.getElementsByTagName(tagName).item(0)?.textContent.trim();
  return text === '' ? undefined : text;
}

/**
 * Returns the name of the data file described by a PDS4 label
 * (`File_Area_Observational/File/file_name`).
 *
 * @param xml - Parsed PDS4 label.
 * @returns The referenced file name, or `undefined` if the label has none.
 */
export function getPDS4DataFileName(xml: Document): string | undefined {
  const fileArea = xml.getElementsByTagName('File_Area_Observational').item(0) ?? undefined;
  const file = fileArea?.getElementsByTagName('File').item(0) ?? undefined;

  return getChildText(file, 'file_name') ?? getChildText(xml, 'file_name');
}
