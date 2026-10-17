"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/** Map chrome uses Framer Motion. Honor the system motion setting without changing the layout. */
export function MotionPreference({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
