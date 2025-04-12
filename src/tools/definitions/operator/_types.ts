export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// Alias for Rect type
export type DOMRectangle = Rect;

export interface InteractiveRegion {
  tag_name: string;
  role: string;
  "aria-name": string;
  "v-scrollable": boolean;
  rects: Rect[];
}

export interface VisualViewport {
  height: number;
  width: number;
  offsetLeft: number;
  offsetTop: number;
  pageLeft: number;
  pageTop: number;
  scale: number;
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
}

interface RawInteractiveRegion {
  tag_name?: string;
  role?: string;
  "aria-name"?: string;
  "v-scrollable"?: boolean;
  rects?: Array<Rect | Record<string, number>>;
}

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

export function interactiveregion_from_dict(obj: RawInteractiveRegion): InteractiveRegion {
  return {
    tag_name: obj.tag_name || "",
    role: obj.role || "",
    "aria-name": obj["aria-name"] || "",
    "v-scrollable": obj["v-scrollable"] || false,
    rects: Array.isArray(obj.rects) ? obj.rects.map((rect) => rect as Rect) : []
  };
}

export function visualviewport_from_dict(obj: RawViewport): VisualViewport {
  return {
    height: obj.height || 0,
    width: obj.width || 0,
    offsetLeft: obj.offsetLeft || 0,
    offsetTop: obj.offsetTop || 0,
    pageLeft: obj.pageLeft || 0,
    pageTop: obj.pageTop || 0,
    scale: obj.scale || 0,
    clientWidth: obj.clientWidth || 0,
    clientHeight: obj.clientHeight || 0,
    scrollWidth: obj.scrollWidth || 0,
    scrollHeight: obj.scrollHeight || 0
  };
} 