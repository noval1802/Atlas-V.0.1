"use client";

import { useEffect } from "react";

/** Feeds the pointer position (-1..1) into --px/--py on .auth-root for the backdrop parallax. Mouse and pen only. */
export function AuthPointer() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".auth-root");
    if (!root || !matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    let frame = 0;
    const move = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty("--px", ((event.clientX / innerWidth) * 2 - 1).toFixed(3));
        root.style.setProperty("--py", ((event.clientY / innerHeight) * 2 - 1).toFixed(3));
      });
    };
    addEventListener("pointermove", move, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("pointermove", move);
    };
  }, []);
  return null;
}
