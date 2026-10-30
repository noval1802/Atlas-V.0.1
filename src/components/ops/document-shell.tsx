import ErrorBoundary from "@/components/ErrorBoundary";
import { jsonLd } from "@/app/site-metadata";
import { MotionPreference } from "./motion-preference";

export function DocumentShell({
  lang,
  children,
}: {
  lang: "id" | "en";
  children: React.ReactNode;
}) {
  return (
    <html lang={lang} dir="ltr" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

      </head>
      {/* Extensions such as ColorZilla set attributes on body before hydration. */}
      <body className="antialiased" suppressHydrationWarning>
        <MotionPreference>
          <ErrorBoundary name="ATLAS Core">
            {children}
          </ErrorBoundary>
        </MotionPreference>
      </body>
    </html>
  );
}
