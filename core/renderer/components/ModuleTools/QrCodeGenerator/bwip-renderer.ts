import bwipjs from 'bwip-js';

export type BwipRenderOptions = Parameters<typeof bwipjs.toCanvas>[1] & {
  padding?: number;
  eclevel?: string;
};

export function renderBarcode(canvas: HTMLCanvasElement, options: BwipRenderOptions): void {
  bwipjs.toCanvas(canvas, options);
}
