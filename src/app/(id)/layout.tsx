import type { ReactNode } from "react";
import { DocumentShell } from "@/components/ops/document-shell";
import { metadata, viewport } from "../site-metadata";
import "../globals.css";

export { metadata, viewport };

/** Indonesian operational pages. The English map, docs, and privacy use the other root layout. */
export default function IndonesianLayout({ children }: { children: ReactNode }) {
  return <DocumentShell lang="id">{children}</DocumentShell>;
}
