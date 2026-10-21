import type { ReactNode } from "react";
import { DocumentShell } from "@/components/ops/document-shell";
import { metadata, viewport } from "../site-metadata";
import "../globals.css";

export { metadata, viewport };

/** English document: the map HUD, documentation, and privacy notice. */
export default function EnglishLayout({ children }: { children: ReactNode }) {
  return <DocumentShell lang="en">{children}</DocumentShell>;
}
