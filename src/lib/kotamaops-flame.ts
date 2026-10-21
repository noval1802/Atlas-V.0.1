/** Shared flame for Kodam that still have fire spots. Eight frames, one timer. */

import { karhutlaReports } from "@/lib/karhutla-lapsit";

/** Only a remaining hotspot count gets a flame. Extinguished and unaffected units stay still. */
export const KOTAMAOPS_FLAME_CODES = karhutlaReports()
  .filter((item) => (item.prosesTitik ?? 0) > 0)
  .map((item) => item.code);
export const KOTAMAOPS_FLAME_FRAMES = 8;
export const KOTAMAOPS_FLAME_FRAME_MS = 110;
export const KOTAMAOPS_FLAME_WIDTH = 96;
export const KOTAMAOPS_FLAME_HEIGHT = 144;

export function kotamaopsHasFlame(code: string): boolean {
  return KOTAMAOPS_FLAME_CODES.includes(code);
}

export function nextKotamaopsFlameFrame(frame: number): number {
  return (frame + 1) % KOTAMAOPS_FLAME_FRAMES;
}

export function kotamaopsFlameImageId(frame: number): string {
  return `kotamaops-flame-${frame % KOTAMAOPS_FLAME_FRAMES}`;
}

/** Draw one flame frame. The base sits on the bottom edge so a bottom anchor rests on the crest. */
export function drawKotamaopsFlame(ctx: CanvasRenderingContext2D, frame: number): void {
  const width = KOTAMAOPS_FLAME_WIDTH;
  const height = KOTAMAOPS_FLAME_HEIGHT;
  ctx.clearRect(0, 0, width, height);
  const phase = (frame / KOTAMAOPS_FLAME_FRAMES) * Math.PI * 2;
  const sway = Math.sin(phase) * width * 0.045;
  const flicker = 0.86 + 0.14 * Math.sin(phase * 2);
  const baseY = height * 0.9;

  const glow = ctx.createRadialGradient(width / 2, baseY, 4, width / 2, baseY, width * 0.42);
  glow.addColorStop(0, "rgba(255, 140, 32, 0.55)");
  glow.addColorStop(1, "rgba(255, 60, 0, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(width / 2, baseY, width * 0.34, height * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  const tongue = (centerX: number, tipY: number, halfWidth: number, core: string, alpha: number) => {
    ctx.beginPath();
    ctx.moveTo(centerX - halfWidth, baseY);
    ctx.bezierCurveTo(
      centerX - halfWidth * 0.85,
      baseY - height * 0.28,
      centerX - halfWidth * 0.15 + sway,
      (baseY + tipY) / 2,
      centerX + sway * 0.35,
      tipY,
    );
    ctx.bezierCurveTo(
      centerX + halfWidth * 0.2 + sway,
      (baseY + tipY) / 2,
      centerX + halfWidth * 0.9,
      baseY - height * 0.22,
      centerX + halfWidth,
      baseY,
    );
    ctx.closePath();
    const paint = ctx.createLinearGradient(0, tipY, 0, baseY);
    paint.addColorStop(0, core);
    paint.addColorStop(0.45, "rgba(255, 90, 16, 0.9)");
    paint.addColorStop(1, "rgba(160, 24, 0, 0)");
    ctx.globalAlpha = alpha;
    ctx.fillStyle = paint;
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  const tip = height * (0.1 + (1 - flicker) * 0.18);
  tongue(width / 2, tip, width * 0.26, "#ff6a1a", 0.9);
  tongue(width * 0.36 + Math.sin(phase + 1.2) * 3, tip + height * 0.3, width * 0.11, "#ffc14a", 0.75);
  tongue(width * 0.66 + Math.cos(phase + 0.4) * 3, tip + height * 0.24, width * 0.1, "#ff8a2a", 0.7);
  tongue(width / 2 + sway * 0.2, tip + height * 0.2, width * 0.1, "#fff1b8", 0.95);
}
