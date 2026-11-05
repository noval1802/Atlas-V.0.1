/* Volcano map marker, drawn rather than loaded: a cone in the PVMBG level colour, a
   white plume once the level is raised, and an ash plume with lava when erupting. */

import type { IconData } from '@/lib/camera-icon';
import type { ActiveLayers } from '@/lib/layer-feeds';

/** Normal, Waspada, Siaga, Awas — PVMBG's own colours. */
export const VOLCANO_LEVEL_COLORS = ['#43A047', '#FDD835', '#FB8C00', '#E53935'] as const;

const SIZE = 56; // drawn at pixelRatio 2, so 28 CSS px at icon-size 1

/** The map image id for a level (1–4) and eruption state. */
export function volcanoIconId(level: number, erupting: boolean): string {
  return `volcano-${level}${erupting ? '-erupt' : ''}`;
}

function puff(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

export function volcanoIconData(level: number, erupting: boolean): IconData {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const color = VOLCANO_LEVEL_COLORS[Math.min(Math.max(level, 1), 4) - 1];
  ctx.lineJoin = 'round';

  // Plume first, so the cone overlaps its base.
  if (erupting || level >= 2) {
    ctx.beginPath();
    puff(ctx, 28, 15, 6);
    puff(ctx, 22, 10, 5);
    puff(ctx, 34, 9, 5.5);
    puff(ctx, 28, 5, 4.5);
    ctx.fillStyle = erupting ? '#4A4A4A' : '#F2F2F2';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fill();
    if (erupting) {
      ctx.beginPath();
      puff(ctx, 28, 16, 3.5);
      ctx.fillStyle = '#FF7A1A';
      ctx.fill();
    }
  }

  // The cone, with a notch for the crater.
  ctx.beginPath();
  ctx.moveTo(5, 51);
  ctx.lineTo(22, 21);
  ctx.lineTo(25, 24);
  ctx.lineTo(31, 24);
  ctx.lineTo(34, 21);
  ctx.lineTo(51, 51);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fill();

  // Shade the right flank so the cone reads as a mountain, not a triangle.
  ctx.beginPath();
  ctx.moveTo(31, 24);
  ctx.lineTo(34, 21);
  ctx.lineTo(51, 51);
  ctx.lineTo(36, 51);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fill();

  if (erupting) {
    ctx.beginPath();
    ctx.moveTo(26, 25);
    ctx.lineTo(22, 34);
    ctx.lineTo(24, 42);
    ctx.moveTo(30, 25);
    ctx.lineTo(33, 33);
    ctx.lineTo(31, 40);
    // Lava in amber over a dark edge: red lava vanished on the red Awas cone.
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = '#FFB300';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  return { width: SIZE, height: SIZE, data: new Uint8Array(ctx.getImageData(0, 0, SIZE, SIZE).data) };
}

type VolcanoFilters = Pick<ActiveLayers, 'volcano_l1' | 'volcano_l2' | 'volcano_l3' | 'volcano_l4' | 'volcano_erupt'>;

/** The panel switches: Erupsi if erupting, else its level. Mirrors the map layer filter. */
export function volcanoShown(v: { level: number; erupting: boolean }, layers: VolcanoFilters): boolean {
  if (v.erupting) return layers.volcano_erupt;
  return [layers.volcano_l1, layers.volcano_l2, layers.volcano_l3, layers.volcano_l4][v.level - 1] === true;
}

/** Siaga, Awas, or erupting at any level: these get the ping ring. */
export function volcanoPulses(v: { level: number; erupting: boolean }): boolean {
  return v.level >= 3 || v.erupting;
}
