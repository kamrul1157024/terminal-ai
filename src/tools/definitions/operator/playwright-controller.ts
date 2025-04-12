import { readFileSync } from 'fs';
import { join } from 'path';

// Handle both playwright and playwright-core imports
type Page = {
  evaluate: (script: string | Function) => Promise<unknown>;
  waitForTimeout: (ms: number) => Promise<void>;
  setViewportSize: (size: { width: number, height: number }) => Promise<void>;
  addInitScript: (options: { path: string }) => Promise<void>;
  waitForLoadState: () => Promise<void>;
  on: (event: string, handler: Function) => void;
  goBack: () => Promise<void>;
  goto: (url: string) => Promise<void>;
  waitForEvent: (event: string, options?: { timeout: number }) => Promise<unknown>;
  mouse: {
    move: (x: number, y: number) => Promise<void>;
    click: (x: number, y: number, options?: { delay: number }) => Promise<void>;
  };
  locator: (selector: string) => {
    waitFor: (options?: { timeout: number }) => Promise<void>;
    scrollIntoViewIfNeeded: () => Promise<void>;
    boundingBox: () => Promise<{ x: number, y: number, width: number, height: number } | null>;
    focus: () => Promise<void>;
    pressSequentially: (text: string, options?: { delay: number }) => Promise<void>;
    fill: (value: string) => Promise<void>;
    press: (key: string) => Promise<void>;
  };
  url: string;
};

type Download = {
  suggestedFilename: () => string;
  saveAs: (path: string) => Promise<void>;
};

import {
  InteractiveRegion,
  VisualViewport,
  interactiveregion_from_dict,
  visualviewport_from_dict
} from './_types';

// Import the RawViewport interface
interface RawViewport {
  height?: number;
  width?: number;
  offsetLeft?: number;
  offsetTop?: number;
  pageLeft?: number;
  pageTop?: number;
  scale?: number;
  clientWidth?: number;
  clientHeight?: number;
  scrollWidth?: number;
  scrollHeight?: number;
}

// Type definition for a markdown converter interface
interface MarkdownConverter {
  convert_stream: (input: unknown, options: { file_extension: string, url: string }) => { text_content: string };
}

/**
 * A helper class to allow Playwright to interact with web pages to perform actions such as clicking, filling, and scrolling.
 */
export class PlaywrightController {
  private animate_actions: boolean;
  private downloads_folder: string | null;
  private viewport_width: number;
  private viewport_height: number;
  private _download_handler: ((download: Download) => void) | null;
  private to_resize_viewport: boolean;
  private _page_script: string;
  private last_cursor_position: [number, number];
  private _markdown_converter: MarkdownConverter | null;

  /**
   * Initialize the PlaywrightController.
   * 
   * @param downloads_folder - The folder to save downloads to. If null, downloads are not saved.
   * @param animate_actions - Whether to animate the actions (create fake cursor to click).
   * @param viewport_width - The width of the viewport.
   * @param viewport_height - The height of the viewport.
   * @param _download_handler - A function to handle downloads.
   * @param to_resize_viewport - Whether to resize the viewport
   */
  constructor(
    downloads_folder: string | null = null,
    animate_actions: boolean = false,
    viewport_width: number = 1440,
    viewport_height: number = 900,
    _download_handler: ((download: Download) => void) | null = null,
    to_resize_viewport: boolean = true
  ) {
    if (typeof animate_actions !== 'boolean') {
      throw new Error('animate_actions must be a boolean');
    }
    if (typeof viewport_width !== 'number') {
      throw new Error('viewport_width must be a number');
    }
    if (typeof viewport_height !== 'number') {
      throw new Error('viewport_height must be a number');
    }
    if (viewport_height <= 0) {
      throw new Error('viewport_height must be positive');
    }
    if (viewport_width <= 0) {
      throw new Error('viewport_width must be positive');
    }

    this.animate_actions = animate_actions;
    this.downloads_folder = downloads_folder;
    this.viewport_width = viewport_width;
    this.viewport_height = viewport_height;
    this._download_handler = _download_handler;
    this.to_resize_viewport = to_resize_viewport;
    this.last_cursor_position = [0, 0];
    this._markdown_converter = null;

    // Read page_script
    this._page_script = readFileSync(join(__dirname, 'page-script.js'), 'utf-8');
  }

  /**
   * Pause the execution for a specified duration.
   * 
   * @param page - The Playwright page object.
   * @param duration - The duration to sleep in seconds.
   */
  async sleep(page: Page, duration: number): Promise<void> {
    if (!page) {
      throw new Error('Page must not be null');
    }
    await page.waitForTimeout(duration * 1000);
  }

  /**
   * Retrieve interactive regions from the web page.
   * 
   * @param page - The Playwright page object.
   * @returns A dictionary of interactive regions.
   */
  async getInteractiveRects(page: Page): Promise<Record<string, InteractiveRegion>> {
    if (!page) {
      throw new Error('Page must not be null');
    }
    // Read the regions from the DOM
    try {
      await page.evaluate(this._page_script);
    } catch {
      // Ignore errors
    }
    const result = await page.evaluate("MultimodalWebSurfer.getInteractiveRects();") as Record<string, Record<string, unknown>>;

    // Convert the results into appropriate types
    const typedResults: Record<string, InteractiveRegion> = {};
    for (const key in result) {
      typedResults[key] = interactiveregion_from_dict(result[key]);
    }

    return typedResults;
  }

  /**
   * Retrieve the visual viewport of the web page.
   * 
   * @param page - The Playwright page object.
   * @returns The visual viewport of the page.
   */
  async getVisualViewport(page: Page): Promise<VisualViewport> {
    if (!page) {
      throw new Error('Page must not be null');
    }
    try {
      await page.evaluate(this._page_script);
    } catch {
      // Ignore errors
    }
    const viewportData = await page.evaluate("MultimodalWebSurfer.getVisualViewport();");
    return visualviewport_from_dict(viewportData as RawViewport);
  }

  /**
   * Retrieve the ID of the currently focused element.
   * 
   * @param page - The Playwright page object.
   * @returns The ID of the focused element or null if no control has focus.
   */
  async getFocusedRectId(page: Page): Promise<string | null> {
    if (!page) {
      throw new Error('Page must not be null');
    }
    try {
      await page.evaluate(this._page_script);
    } catch {
      // Ignore errors
    }
    const result = await page.evaluate("MultimodalWebSurfer.getFocusedElementId();");
    return result === null ? null : String(result);
  }

  /**
   * Retrieve metadata from the web page.
   * 
   * @param page - The Playwright page object.
   * @returns A dictionary of page metadata.
   */
  async getPageMetadata(page: Page): Promise<Record<string, unknown>> {
    if (!page) {
      throw new Error('Page must not be null');
    }
    try {
      await page.evaluate(this._page_script);
    } catch {
      // Ignore errors
    }
    const result = await page.evaluate("MultimodalWebSurfer.getPageMetadata();") as Record<string, unknown>;
    return result;
  }

  /**
   * Handle actions to perform on a new page.
   * 
   * @param page - The Playwright page object.
   */
  async onNewPage(page: Page): Promise<void> {
    if (!page) {
      throw new Error('Page must not be null');
    }
    
    if (this._download_handler) {
      page.on('download', this._download_handler);
    }
    
    if (this.to_resize_viewport && this.viewport_width && this.viewport_height) {
      await page.setViewportSize({ width: this.viewport_width, height: this.viewport_height });
    }
    
    await this.sleep(page, 0.2);
    await page.addInitScript({ path: join(__dirname, 'page-script.js') });
    await page.waitForLoadState();
  }

  /**
   * Navigate back to the previous page.
   * 
   * @param page - The Playwright page object.
   */
  async back(page: Page): Promise<void> {
    if (!page) {
      throw new Error('Page must not be null');
    }
    await page.goBack();
  }

  /**
   * Visit a specified URL.
   * 
   * @param page - The Playwright page object.
   * @param url - The URL to visit.
   * @returns A tuple indicating whether to reset prior metadata hash and last download.
   */
  async visitPage(page: Page, url: string): Promise<[boolean, boolean]> {
    if (!page) {
      throw new Error('Page must not be null');
    }
    
    let resetPriorMetadataHash = false;
    let resetLastDownload = false;
    
    try {
      // Regular webpage
      await page.goto(url);
      await page.waitForLoadState();
      resetPriorMetadataHash = true;
    } catch (outerError) {
      // Downloaded file
      if (this.downloads_folder && outerError instanceof Error && outerError.message.includes('net::ERR_ABORTED')) {
        const downloadPromise = page.waitForEvent('download');
        try {
          await page.goto(url);
        } catch (innerError) {
          if (innerError instanceof Error && innerError.message.includes('net::ERR_ABORTED')) {
            // Expected behavior for downloads
          } else {
            throw innerError;
          }
        }
        
        const download = await downloadPromise as unknown as Download; // Type assertion to avoid unknown type errors
        const fname = join(this.downloads_folder, download.suggestedFilename());
        await download.saveAs(fname);
        
        const message = `<body style="margin: 20px;"><h1>Successfully downloaded '${download.suggestedFilename()}' to local path:<br><br>${fname}</h1></body>`;
        await page.goto('data:text/html;base64,' + Buffer.from(message).toString('base64'));
        
        resetLastDownload = true;
      } else {
        throw outerError;
      }
    }
    
    return [resetPriorMetadataHash, resetLastDownload];
  }

  /**
   * Scroll the page down by one viewport height minus 50 pixels.
   * 
   * @param page - The Playwright page object.
   */
  async pageDown(page: Page): Promise<void> {
    if (!page) {
      throw new Error('Page must not be null');
    }
    await page.evaluate(`window.scrollBy(0, ${this.viewport_height - 50});`);
  }

  /**
   * Scroll the page up by one viewport height minus 50 pixels.
   * 
   * @param page - The Playwright page object.
   */
  async pageUp(page: Page): Promise<void> {
    if (!page) {
      throw new Error('Page must not be null');
    }
    await page.evaluate(`window.scrollBy(0, -${this.viewport_height - 50});`);
  }

  /**
   * Animate the cursor movement gradually from start to end coordinates.
   * 
   * @param page - The Playwright page object.
   * @param start_x - The starting x-coordinate.
   * @param start_y - The starting y-coordinate.
   * @param end_x - The ending x-coordinate.
   * @param end_y - The ending y-coordinate.
   */
  async gradualCursorAnimation(
    page: Page,
    start_x: number,
    start_y: number,
    end_x: number,
    end_y: number
  ): Promise<void> {
    const steps = 20;
    for (let step = 0; step < steps; step++) {
      const x = start_x + (end_x - start_x) * (step / steps);
      const y = start_y + (end_y - start_y) * (step / steps);
      
      await page.evaluate(`
        (function() {
          let cursor = document.getElementById('red-cursor');
          cursor.style.left = '${x}px';
          cursor.style.top = '${y}px';
        })();
      `);
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    this.last_cursor_position = [end_x, end_y];
  }

  /**
   * Add a red cursor box around the element with the given identifier.
   * 
   * @param page - The Playwright page object.
   * @param identifier - The element identifier.
   */
  async addCursorBox(page: Page, identifier: string): Promise<void> {
    await page.evaluate(`
      (function() {
        let elm = document.querySelector("[__elementId='${identifier}']");
        if (elm) {
          elm.style.transition = 'border 0.3s ease-in-out';
          elm.style.border = '2px solid red';
        }
      })();
    `);
    
    await new Promise(resolve => setTimeout(resolve, 300));

    // Create a red cursor
    await page.evaluate(`
      (function() {
        let cursor = document.createElement('div');
        cursor.id = 'red-cursor';
        cursor.style.width = '10px';
        cursor.style.height = '10px';
        cursor.style.backgroundColor = 'red';
        cursor.style.position = 'absolute';
        cursor.style.borderRadius = '50%';
        cursor.style.zIndex = '10000';
        document.body.appendChild(cursor);
      })();
    `);
  }

  /**
   * Remove the red cursor box around the element with the given identifier.
   * 
   * @param page - The Playwright page object.
   * @param identifier - The element identifier.
   */
  async removeCursorBox(page: Page, identifier: string): Promise<void> {
    await page.evaluate(`
      (function() {
        let elm = document.querySelector("[__elementId='${identifier}']");
        if (elm) {
          elm.style.border = '';
        }
        let cursor = document.getElementById('red-cursor');
        if (cursor) {
          cursor.remove();
        }
      })();
    `);
  }

  /**
   * Click the element with the given identifier.
   * 
   * @param page - The Playwright page object.
   * @param identifier - The element identifier.
   * @returns The new page if a new page is opened, otherwise null.
   */
  async clickId(page: Page, identifier: string): Promise<Page | null> {
    if (!page) {
      throw new Error('Page must not be null');
    }
    
    let newPage: Page | null = null;
    const target = page.locator(`[__elementId='${identifier}']`);

    // See if it exists
    try {
      await target.waitFor({ timeout: 5000 });
    } catch {
      throw new Error('No such element.');
    }

    // Click it
    await target.scrollIntoViewIfNeeded();
    await new Promise(resolve => setTimeout(resolve, 300));

    const box = await target.boundingBox() as { x: number, y: number, width: number, height: number };

    if (this.animate_actions) {
      await this.addCursorBox(page, identifier);
      // Move cursor to the box slowly
      const [start_x, start_y] = this.last_cursor_position;
      const end_x = box.x + box.width / 2;
      const end_y = box.y + box.height / 2;
      await this.gradualCursorAnimation(page, start_x, start_y, end_x, end_y);
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        // Give it a chance to open a new page
        const popupPromise = page.waitForEvent('popup', { timeout: 1000 });
        await page.mouse.click(end_x, end_y, { delay: 10 });
        newPage = await popupPromise as Page;
        if (newPage) {
          await this.onNewPage(newPage);
        }
      } catch {
        // Timeout error is expected if no popup
      }
      await this.removeCursorBox(page, identifier);
    } else {
      try {
        // Give it a chance to open a new page
        const popupPromise = page.waitForEvent('popup', { timeout: 1000 });
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { delay: 10 });
        newPage = await popupPromise as Page;
        if (newPage) {
          await this.onNewPage(newPage);
        }
      } catch {
        // Timeout error is expected if no popup
      }
    }
    
    return newPage;
  }

  /**
   * Hover the mouse over the element with the given identifier.
   * 
   * @param page - The Playwright page object.
   * @param identifier - The element identifier.
   */
  async hoverId(page: Page, identifier: string): Promise<void> {
    if (!page) {
      throw new Error('Page must not be null');
    }
    
    const target = page.locator(`[__elementId='${identifier}']`);

    // See if it exists
    try {
      await target.waitFor({ timeout: 5000 });
    } catch {
      throw new Error('No such element.');
    }

    // Hover over it
    await target.scrollIntoViewIfNeeded();
    await new Promise(resolve => setTimeout(resolve, 300));

    const box = await target.boundingBox() as { x: number, y: number, width: number, height: number };

    if (this.animate_actions) {
      await this.addCursorBox(page, identifier);
      // Move cursor to the box slowly
      const [start_x, start_y] = this.last_cursor_position;
      const end_x = box.x + box.width / 2;
      const end_y = box.y + box.height / 2;
      await this.gradualCursorAnimation(page, start_x, start_y, end_x, end_y);
      await new Promise(resolve => setTimeout(resolve, 100));
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

      await this.removeCursorBox(page, identifier);
    } else {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    }
  }

  /**
   * Fill the element with the given identifier with the specified value.
   * 
   * @param page - The Playwright page object.
   * @param identifier - The element identifier.
   * @param value - The value to fill.
   * @param press_enter - Whether to press Enter after filling the field.
   */
  async fillId(page: Page, identifier: string, value: string, press_enter: boolean = true): Promise<void> {
    if (!page) {
      throw new Error('Page must not be null');
    }
    
    const target = page.locator(`[__elementId='${identifier}']`);

    // See if it exists
    try {
      await target.waitFor({ timeout: 5000 });
    } catch {
      throw new Error('No such element.');
    }

    // Fill it
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox() as { x: number, y: number, width: number, height: number };

    if (this.animate_actions) {
      await this.addCursorBox(page, identifier);
      // Move cursor to the box slowly
      const [start_x, start_y] = this.last_cursor_position;
      const end_x = box.x + box.width / 2;
      const end_y = box.y + box.height / 2;
      await this.gradualCursorAnimation(page, start_x, start_y, end_x, end_y);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Focus on the element
    await target.focus();
    if (this.animate_actions) {
      // fill char by char to mimic human speed for short text and type fast for long text
      const delayTypingSpeed = value.length < 100 ? 50 + 100 * Math.random() : 10;
      await target.pressSequentially(value, { delay: delayTypingSpeed });
    } else {
      try {
        await target.fill(value);
      } catch {
        await target.pressSequentially(value);
      }
    }
    
    if (press_enter) {
      await target.press('Enter');
    }

    if (this.animate_actions) {
      await this.removeCursorBox(page, identifier);
    }
  }

  /**
   * Scroll the element with the given identifier in the specified direction.
   * 
   * @param page - The Playwright page object.
   * @param identifier - The element identifier.
   * @param direction - The direction to scroll ("up" or "down").
   */
  async scrollId(page: Page, identifier: string, direction: string): Promise<void> {
    if (!page) {
      throw new Error('Page must not be null');
    }
    
    await page.evaluate(`
      (function() {
        let elm = document.querySelector("[__elementId='${identifier}']");
        if (elm) {
          if ("${direction}" == "up") {
            elm.scrollTop = Math.max(0, elm.scrollTop - elm.clientHeight);
          }
          else {
            elm.scrollTop = Math.min(elm.scrollHeight - elm.clientHeight, elm.scrollTop + elm.clientHeight);
          }
        }
      })();
    `);
  }

  /**
   * Retrieve the text content of the web page.
   * 
   * @param page - The Playwright page object.
   * @param n_lines - The number of lines to return from the page inner text.
   * @returns The text content of the page.
   */
  async getWebpageText(page: Page, n_lines: number = 50): Promise<string> {
    if (!page) {
      throw new Error('Page must not be null');
    }
    
    try {
      let textInViewport = await page.evaluate(`() => {
        return document.body.innerText;
      }`) as string;
      
      textInViewport = textInViewport.split('\n').slice(0, n_lines).join('\n') as string;
      // remove empty lines
      textInViewport = textInViewport.split('\n')
        .filter((line: string) => line.trim())
        .join('\n');
        
      return textInViewport;
    } catch {
      return '';
    }
  }

  /**
   * Retrieve the text content of the browser viewport (approximately).
   * 
   * @param page - The Playwright page object.
   * @returns The text content of the page.
   */
  async getVisibleText(page: Page): Promise<string> {
    if (!page) {
      throw new Error('Page must not be null');
    }
    
    try {
      await page.evaluate(this._page_script);
    } catch {
      // Ignore errors
    }
    
    const result = await page.evaluate("MultimodalWebSurfer.getVisibleText();") as string;
    return result;
  }

  /**
   * Retrieve the markdown content of the web page.
   * Currently returns plain text if MarkItDown is not available.
   * 
   * @param page - The Playwright page object.
   * @returns The markdown or text content of the page.
   */
  async getPageMarkdown(page: Page): Promise<string> {
    if (!page) {
      throw new Error('Page must not be null');
    }
    
    // This is currently a stub - actual implementation would depend on MarkItDown availability
    // In TypeScript, we'd need to have proper bindings for MarkItDown
    return await this.getWebpageText(page, 200);
  }
} 