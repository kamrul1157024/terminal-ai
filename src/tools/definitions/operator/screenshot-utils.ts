import * as fs from 'fs';
import * as path from 'path';

import { createCanvas, loadImage, CanvasRenderingContext2D } from 'canvas';

import { InteractiveRegion, Rect } from './_types';

// Constants
const TOP_NO_LABEL_ZONE = 20; // Don't print any labels close to the top of the page

/**
 * Utility class for adding interactive element markers to screenshots
 */
export class ScreenshotUtils {
  /**
   * Add markers to a screenshot highlighting interactive regions
   * 
   * @param screenshot - The screenshot as buffer or file path
   * @param regions - Dictionary of interactive regions to highlight
   * @returns Tuple containing the modified image, visible elements, elements above viewport, and elements below viewport
   */
  static async addMarkersToScreenshot(
    screenshot: Buffer | string,
    regions: Record<string, InteractiveRegion>
  ): Promise<{
    screenshot: Buffer,
    visibleRects: string[],
    rectsAbove: string[],
    rectsBelow: string[]
  }> {
    // Load the image
    const image = await loadImage(screenshot);
    
    // Create a canvas with the image dimensions
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    
    // Draw the original image
    ctx.drawImage(image, 0, 0);
    
    // Draw markers and collect region classifications
    const { visibleRects, rectsAbove, rectsBelow } = 
      this.drawRegionMarkers(ctx, regions, canvas.width, canvas.height);
    
    // Convert canvas to buffer
    const resultBuffer = canvas.toBuffer('image/png');
    return {
      screenshot: resultBuffer,
      visibleRects,
      rectsAbove,
      rectsBelow
    };
  }
  
  /**
   * Draw markers for each interactive region
   * 
   * @param ctx - Canvas rendering context
   * @param regions - Dictionary of interactive regions
   * @param canvasWidth - Width of the canvas
   * @param canvasHeight - Height of the canvas
   * @returns Object containing lists of visible, above, and below viewport elements
   */
  private static drawRegionMarkers(
    ctx: CanvasRenderingContext2D,
    regions: Record<string, InteractiveRegion>,
    canvasWidth: number,
    canvasHeight: number
  ): { visibleRects: string[], rectsAbove: string[], rectsBelow: string[] } {
    const visibleRects: string[] = [];
    const rectsAbove: string[] = [];
    const rectsBelow: string[] = [];
    
    // Set up font for labels
    ctx.font = '14px sans-serif';
    
    // Process each region
    for (const [id, region] of Object.entries(regions)) {
      for (const rect of region.rects) {
        // Skip empty rectangles
        if (!rect || rect.width * rect.height === 0) {
          continue;
        }
        
        const midX = (rect.right + rect.left) / 2.0;
        const midY = (rect.top + rect.bottom) / 2.0;
        
        // Classify the rect based on its position
        if (0 <= midX && midX < canvasWidth) {
          if (midY < 0) {
            rectsAbove.push(id);
          } else if (midY >= canvasHeight) {
            rectsBelow.push(id);
          } else {
            visibleRects.push(id);
            this.drawROI(ctx, parseInt(id, 10), rect);
          }
        }
      }
    }
    
    return { visibleRects, rectsAbove, rectsBelow };
  }
  
  /**
   * Draw a rectangle and label for an interactive region
   * 
   * @param ctx - Canvas rendering context
   * @param idx - Index/ID of the region
   * @param rect - Rectangle coordinates
   */
  private static drawROI(
    ctx: CanvasRenderingContext2D,
    idx: number,
    rect: Rect
  ): void {
    // Generate a deterministic color based on the index
    const color = this.getColor(idx);
    const rgbaColor = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;
    const rgbaColorTransparent = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.19)`;
    
    // Calculate luminance to determine text color (black or white)
    const luminance = color[0] * 0.3 + color[1] * 0.59 + color[2] * 0.11;
    const textColor = luminance > 90 ? 'rgba(0, 0, 0, 1)' : 'rgba(255, 255, 255, 1)';
    
    // Draw the rectangle
    ctx.lineWidth = 2;
    ctx.strokeStyle = rgbaColor;
    ctx.fillStyle = rgbaColorTransparent;
    ctx.beginPath();
    ctx.rect(rect.left, rect.top, rect.width, rect.height);
    ctx.fill();
    ctx.stroke();
    
    // Position label
    let labelX = rect.right;
    let labelY = rect.top;
    const labelText = String(idx);
    
    // Reposition label if it's too close to the top
    if (labelY <= TOP_NO_LABEL_ZONE) {
      labelY = rect.bottom;
    }
    
    // Measure text for the background rectangle
    const textMetrics = ctx.measureText(labelText);
    const textHeight = 18; // Approximate height
    
    // Draw label background
    ctx.fillStyle = rgbaColor;
    ctx.beginPath();
    ctx.rect(
      labelX - textMetrics.width - 6, 
      labelY - textHeight / 2, 
      textMetrics.width + 6, 
      textHeight
    );
    ctx.fill();
    
    // Draw label text
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, labelX, labelY);
  }
  
  /**
   * Generate a deterministic color based on an identifier
   * 
   * @param identifier - Numeric identifier to seed the color generation
   * @returns RGBA color values as a tuple
   */
  private static getColor(identifier: number): [number, number, number, number] {
    // Create a deterministic random number generator
    const seed = String(identifier);
    const hash = Buffer.from(seed).reduce((a, b) => a + b, 0);
    
    // Generate random RGB components with constraints
    const r = (hash * 123) % 256;
    const g = ((hash * 456) % 131) + 125; // 125-255 range
    const b = (hash * 789) % 51; // 0-50 range
    
    // Shuffle the colors (approximating Python's random.shuffle behavior)
    const components = [r, g, b];
    const shuffled = components.sort(() => (Math.cos(hash * components.indexOf(r)) > 0 ? 1 : -1));
    
    return [...shuffled, 255] as [number, number, number, number];
  }
  
  /**
   * Save a buffer as an image file
   * 
   * @param buffer - Image buffer
   * @param filePath - Path to save the image
   */
  static saveImage(buffer: Buffer, filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, buffer);
  }
} 