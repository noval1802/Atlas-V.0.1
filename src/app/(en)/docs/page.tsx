import type { Metadata } from 'next';
import DocsClient from './DocsClient';
import { ENDPOINT_COUNT } from './apiCatalog';

export const metadata: Metadata = {
  title: 'Documentation & API Reference',
  description: `ATLAS documentation — interface reference and the API reference for all ${ENDPOINT_COUNT} endpoints covering aviation, maritime, seismic, conflict, cyber, and OSINT feeds.`,
  alternates: { canonical: '/docs' },
  openGraph: {
    title: 'ATLAS — Documentation & API Reference',
    description: `Interface reference and the API reference for all ${ENDPOINT_COUNT} ATLAS endpoints.`,
    url: '/docs',
    type: 'article',
  },
};

export default function DocsPage() {
  return <DocsClient />;
}
