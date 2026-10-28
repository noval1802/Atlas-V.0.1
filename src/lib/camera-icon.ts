/* CCTV map marker. The SVG glyph is black on transparent, so it is recoloured per palette and given a dark halo to read on any basemap. */

export const CAMERA_ICON_ID = 'cctv-icon';
export const CAMERA_ICON_SRC = '/icons/cctv.svg';
const SIZE = 48; // drawn at pixelRatio 2, so 24 CSS px at icon-size 1
const HALO: ReadonlyArray<readonly [number, number]> = [[-2, 0], [2, 0], [0, -2], [0, 2], [-1.5, -1.5], [1.5, 1.5], [-1.5, 1.5], [1.5, -1.5]];

export type IconData = { width: number; height: number; data: Uint8Array };

let glyph: HTMLImageElement | undefined;
let loading: Promise<HTMLImageElement> | undefined;

export function cameraGlyph(): HTMLImageElement | undefined {
  return glyph;
}

export function loadCameraGlyph(): Promise<HTMLImageElement> {
  loading ??= new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve((glyph = img));
    img.onerror = () => {
      loading = undefined; // let a later call retry
      reject(new Error(`CCTV icon failed to load: ${CAMERA_ICON_SRC}`));
    };
    img.src = CAMERA_ICON_SRC;
  });
  return loading;
}

/** The marker in `color`. Without the glyph (still loading, or failed) it falls back to the old ringed dot at the same size. */
export function cameraIconData(color: string, image?: CanvasImageSource): IconData {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  if (!image) {
    ctx.fillStyle = color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    const tint = document.createElement('canvas');
    tint.width = SIZE;
    tint.height = SIZE;
    const t = tint.getContext('2d')!;
    t.drawImage(image, 5, 5, SIZE - 10, SIZE - 10);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = '#000';
    t.fillRect(0, 0, SIZE, SIZE);
    for (const [dx, dy] of HALO) ctx.drawImage(tint, dx, dy);
    t.fillStyle = color;
    t.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(tint, 0, 0);
  }
  return { width: SIZE, height: SIZE, data: new Uint8Array(ctx.getImageData(0, 0, SIZE, SIZE).data) };
}
