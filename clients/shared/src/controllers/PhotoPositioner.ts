/** Fractions of the full photo: left/top of its width/height, size of its shorter side. */
export interface PhotoCrop { left: number; top: number; size: number }

/**
 * Choosing which part of the photo shows in the round avatar: drag to move,
 * zoom 1–4x. Pure geometry so web and mobile views share it.
 */
export class PhotoPositioner {
  static readonly MAX_ZOOM = 4;
  zoom = 1;
  /** Image top-left inside the viewport (px). */
  x = 0;
  y = 0;

  constructor(readonly view: number, readonly imgW: number, readonly imgH: number) {
    this.centre();
  }

  /** Scale that makes the photo exactly cover the viewport at zoom 1. */
  get baseScale() { return this.view / Math.min(this.imgW, this.imgH); }
  get scale() { return this.baseScale * this.zoom; }
  get shownW() { return this.imgW * this.scale; }
  get shownH() { return this.imgH * this.scale; }

  centre() {
    this.x = (this.view - this.shownW) / 2;
    this.y = (this.view - this.shownH) / 2;
  }

  /** Keep the photo covering the whole viewport. */
  private clamp() {
    this.x = Math.min(0, Math.max(this.view - this.shownW, this.x));
    this.y = Math.min(0, Math.max(this.view - this.shownH, this.y));
  }

  moveBy(dx: number, dy: number) {
    this.x += dx;
    this.y += dy;
    this.clamp();
  }

  /** Zoom around the viewport centre. */
  setZoom(z: number) {
    const next = Math.min(PhotoPositioner.MAX_ZOOM, Math.max(1, z));
    const c = this.view / 2;
    const fx = (c - this.x) / this.scale;
    const fy = (c - this.y) / this.scale;
    this.zoom = next;
    this.x = c - fx * this.scale;
    this.y = c - fy * this.scale;
    this.clamp();
  }

  crop(): PhotoCrop {
    return {
      left: Math.max(0, -this.x / this.scale / this.imgW),
      top: Math.max(0, -this.y / this.scale / this.imgH),
      size: 1 / this.zoom,
    };
  }
}
