"use client";

import { useEffect, useRef } from "react";

const REFERENCE_AREA = 1440 * 900;
const BASE_COUNT = 120;
const MIN_COUNT = 24;
const SPEED = 0.5;
const LINK_DISTANCE = 130;
const LINK_DISTANCE_SQ = LINK_DISTANCE * LINK_DISTANCE;
const CURSOR_DISTANCE = 150;
const CURSOR_DISTANCE_SQ = CURSOR_DISTANCE * CURSOR_DISTANCE;
const LINE_WIDTH = 0.6;
const CYAN = "rgb(0, 229, 255)";

type Particle = { x: number; y: number; vx: number; vy: number; r: number };

/** Fewer dots on a small screen, never more than the reference field. */
export function particleCountForViewport(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 0;
  const scaled = Math.round((BASE_COUNT * width * height) / REFERENCE_AREA);
  return Math.max(MIN_COUNT, Math.min(BASE_COUNT, scaled));
}

function makeParticle(width: number, height: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: Math.cos(angle) * SPEED,
    vy: Math.sin(angle) * SPEED,
    r: 0.8 + Math.random() * 1.2,
  };
}

/**
 * Cyan particle field for the login screen. One animation loop lives for the
 * lifetime of the canvas. Resize only updates the buffer and the particle list.
 */
export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const particles: Particle[] = [];
    const pointer = { x: 0, y: 0, active: false };
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = motion.matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let looping = false;

    const fitCount = () => {
      const count = particleCountForViewport(width, height);
      while (particles.length > count) particles.pop();
      while (particles.length < count) particles.push(makeParticle(width, height));
    };

    const applySize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      fitCount();
      for (const particle of particles) {
        if (particle.x > width) particle.x = width;
        if (particle.y > height) particle.y = height;
      }
    };

    const paint = () => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = CYAN;
      context.strokeStyle = CYAN;
      context.lineWidth = LINE_WIDTH;
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        if (!reduced) {
          particle.x += particle.vx;
          particle.y += particle.vy;
          if (particle.x < 0) particle.x += width;
          else if (particle.x > width) particle.x -= width;
          if (particle.y < 0) particle.y += height;
          else if (particle.y > height) particle.y -= height;
        }
        context.globalAlpha = 0.72;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        context.fill();
        for (let other = index + 1; other < particles.length; other += 1) {
          const neighbor = particles[other];
          const dx = particle.x - neighbor.x;
          const dy = particle.y - neighbor.y;
          const distanceSq = dx * dx + dy * dy;
          if (distanceSq >= LINK_DISTANCE_SQ) continue;
          context.globalAlpha = (1 - distanceSq / LINK_DISTANCE_SQ) * 0.36;
          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(neighbor.x, neighbor.y);
          context.stroke();
        }
        if (!pointer.active) continue;
        const dx = particle.x - pointer.x;
        const dy = particle.y - pointer.y;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq >= CURSOR_DISTANCE_SQ) continue;
        context.globalAlpha = (1 - distanceSq / CURSOR_DISTANCE_SQ) * 0.5;
        context.beginPath();
        context.moveTo(particle.x, particle.y);
        context.lineTo(pointer.x, pointer.y);
        context.stroke();
      }
      context.globalAlpha = 1;
    };

    const tick = () => {
      if (!looping) return;
      paint();
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (looping || reduced || document.hidden) return;
      looping = true;
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      looping = false;
      cancelAnimationFrame(frame);
    };

    const onResize = () => {
      applySize();
      if (reduced) paint();
    };

    const onMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = event.pointerType === "mouse";
    };

    const onLeave = () => {
      pointer.active = false;
    };

    const onVisibility = () => {
      if (document.hidden || reduced) {
        stop();
        return;
      }
      start();
    };

    const onMotion = () => {
      reduced = motion.matches;
      if (reduced) {
        stop();
        paint();
        return;
      }
      start();
    };

    applySize();
    if (reduced) paint();
    else start();

    const onOut = (event: PointerEvent) => {
      if (!event.relatedTarget) onLeave();
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("blur", onLeave);
    document.documentElement.addEventListener("pointerout", onOut);
    document.addEventListener("visibilitychange", onVisibility);
    motion.addEventListener("change", onMotion);

    return () => {
      stop();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("blur", onLeave);
      document.documentElement.removeEventListener("pointerout", onOut);
      document.removeEventListener("visibilitychange", onVisibility);
      motion.removeEventListener("change", onMotion);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-0" />;
}
