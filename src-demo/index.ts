import '@carbon/web-components/es/components/button/index.js';
import '@carbon/web-components/es/components/file-uploader/index.js';
import '@carbon/web-components/es/components/inline-loading/index.js';
import '@carbon/web-components/es/components/link/index.js';
import '@carbon/web-components/es/components/notification/index.js';
import '@carbon/web-components/es/components/tabs/index.js';
import '@carbon/web-components/es/components/tile/index.js';

import {
  loadPDS3ImageByFile,
  loadPDS4ImageByFile,
  type PDSImage,
  toPNG,
  toTIFF,
  version
} from '@/index';

// The linter's resolver ignores stylesheets; Rsbuild resolves this import.
// rslint-disable-next-line import/no-unresolved
import './style.scss';

/** Product formats handled by the playground, one per tab. */
type Format = 'pds3' | 'pds4';
/** The two file slots of each tab. */
type Role = 'label' | 'data';

/** Loads an image from the label and data files of each format. */
const LOADERS: Record<Format, (label: File, data: File) => Promise<PDSImage>> = {
  // loadPDS3ImageByFile takes the IMG first, then the detached LBL.
  pds3: async (label, data) => await loadPDS3ImageByFile(data, label),
  pds4: async (label, data) => await loadPDS4ImageByFile(label, data)
};

/** Returns the first element matching `selector`, or throws if the markup is broken. */
function query<T extends Element>(
  root: ParentNode,
  selector: string,
  type: abstract new () => T
): T {
  const element = root.querySelector(selector);
  if (!(element instanceof type)) {
    throw new TypeError(`Element not found: ${selector}`);
  }
  return element;
}

/** Resolves after the browser has had a chance to paint (e.g. a loading indicator). */
async function nextPaint(): Promise<void> {
  await new Promise(resolve => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });
}

/** Saves `blob` to the user's device under `fileName`. */
function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

/** Returns the file name without its extension. */
function stem(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? fileName : fileName.slice(0, dot);
}

/**
 * One tab of the playground: two file pickers and a result area.
 * The conversion starts as soon as both files are chosen.
 */
class ConverterPanel {
  private readonly files: Map<Role, File> = new Map();
  private readonly result: HTMLElement;
  private previewUrl: string | undefined;
  /** Incremented per conversion so results of superseded runs are discarded. */
  private generation = 0;

  constructor(
    root: HTMLElement,
    private readonly format: Format
  ) {
    this.result = query(root, '.demo__result', HTMLElement);

    for (const uploader of root.querySelectorAll<HTMLElement>('cds-file-uploader[data-role]')) {
      const role = uploader.dataset.role as Role;

      uploader.addEventListener('cds-file-uploader-button-changed', event => {
        const file = (event as CustomEvent<{ addedFiles: File[] }>).detail.addedFiles.at(0);
        if (file !== undefined) this.setFile(uploader, role, file);
      });

      uploader.addEventListener('cds-file-uploader-item-deleted', () => {
        this.setFile(uploader, role, undefined);
      });
    }
  }

  /** Updates a file slot and its file list item, then re-runs the conversion. */
  private setFile(uploader: HTMLElement, role: Role, file: File | undefined): void {
    for (const item of uploader.querySelectorAll('cds-file-uploader-item')) {
      item.remove();
    }

    if (file === undefined) {
      this.files.delete(role);
    } else {
      this.files.set(role, file);
      const item = document.createElement('cds-file-uploader-item');
      item.setAttribute('state', 'edit');
      item.setAttribute('icon-description', `Remove ${file.name}`);
      item.textContent = file.name;
      uploader.append(item);
    }

    void this.convert();
  }

  /** Replaces the contents of the result area. */
  private render(...nodes: Node[]): void {
    if (this.previewUrl !== undefined) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = undefined;
    }
    this.result.replaceChildren(...nodes);
  }

  private async convert(): Promise<void> {
    const generation = ++this.generation;
    const label = this.files.get('label');
    const data = this.files.get('data');

    if (label === undefined || data === undefined) {
      this.render();
      return;
    }

    const loading = document.createElement('cds-inline-loading');
    loading.setAttribute('status', 'active');
    loading.textContent = 'Converting…';
    this.render(loading);
    await nextPaint();

    try {
      const image = await LOADERS[this.format](label, data);
      const png = toPNG(image);
      if (generation === this.generation) {
        this.showImage(image, png, stem(label.name));
      }
    } catch (error: unknown) {
      if (generation === this.generation) {
        this.showError(error);
      }
    }
  }

  private showImage(image: PDSImage, png: ArrayBuffer, baseName: string): void {
    const template = query(document, '#result-template', HTMLTemplateElement);
    const fragment = template.content.cloneNode(true) as DocumentFragment;
    const pngBlob = new Blob([png], { type: 'image/png' });

    const img = query(fragment, '.demo__image', HTMLImageElement);
    img.alt = `${baseName} converted from ${this.format.toUpperCase()}`;
    img.width = image.width;
    img.height = image.height;

    query(fragment, '[data-field="caption"]', HTMLElement).textContent =
      `${baseName} — ${String(image.width)} × ${String(image.height)} px, 16-bit grayscale`;

    query(fragment, '[data-field="png"]', HTMLElement).addEventListener('click', () => {
      download(pngBlob, `${baseName}.png`);
    });
    query(fragment, '[data-field="tiff"]', HTMLElement).addEventListener('click', () => {
      // TIFF is only encoded on demand.
      download(new Blob([toTIFF(image)], { type: 'image/tiff' }), `${baseName}.tiff`);
    });

    this.render(fragment);
    this.previewUrl = URL.createObjectURL(pngBlob);
    img.src = this.previewUrl;
  }

  private showError(error: unknown): void {
    const notification = document.createElement('cds-inline-notification');
    notification.setAttribute('kind', 'error');
    notification.setAttribute('title', 'Conversion failed');
    notification.setAttribute('subtitle', error instanceof Error ? error.message : String(error));
    notification.setAttribute('hide-close-button', '');
    notification.setAttribute('low-contrast', '');
    this.render(notification);
  }
}

/** Follows the OS color scheme with Carbon's White / Gray 100 themes. */
function syncTheme(): void {
  const media = matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    document.documentElement.classList.toggle('cds--g100', media.matches);
    document.documentElement.classList.toggle('cds--white', !media.matches);
  };
  apply();
  media.addEventListener('change', apply);
}

/** When embedded in the documentation site, report the content height to the parent frame. */
function reportHeightToParent(): void {
  if (window.parent === window) return;

  const observer = new ResizeObserver(() => {
    const height = Math.ceil(document.body.getBoundingClientRect().height);
    window.parent.postMessage({ type: 'resize-iframe', height: String(height) }, '*');
  });
  observer.observe(document.body);
}

syncTheme();
reportHeightToParent();

for (const panel of document.querySelectorAll<HTMLElement>('.demo__panel[data-format]')) {
  new ConverterPanel(panel, panel.dataset.format as Format);
}

const versionElement = document.createElement('p');
versionElement.className = 'demo__version cds--type-helper-text-01';
versionElement.textContent = `pds2img v${version}`;
query(document, '.demo__header', HTMLElement).append(versionElement);
