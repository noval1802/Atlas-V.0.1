import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Standalone Node utility scripts, not part of the Next app build. They use
    // CommonJS (require) legitimately, so the app's browser/TS rules don't apply.
    "scratch/**",
    "intel/**",
  ]),
]);

export default eslintConfig;
