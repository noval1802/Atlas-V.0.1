#!/usr/bin/env node
/**
 * Artifact safety check for the Next.js standalone output.
 *
 * Judges files by path and name only. It never opens a file, so it cannot print a
 * secret, and reports paths relative to the artifact root.
 *
 *   node tools/check-artifact.mjs [dir]           strict: exit 1 when anything is found
 *   node tools/check-artifact.mjs [dir] --report  local builds: list findings, exit 0
 *
 * Next.js copies the .env it loaded at build time into .next/standalone by design,
 * so a build on a machine that has .env is never distributable. Only a build from a
 * context without .env (the Docker builder, which honours .dockerignore) passes.
 */
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** [reason, test on the slash-separated relative path] */
const RULES = [
  ["env file", (p, name) => /^\.env/.test(name) && name !== ".env.example"],
  ["private key or certificate", (p, name) => /\.(pem|key|crt|p12|pfx)$/i.test(name) || /^id_(rsa|ed25519|ecdsa)/.test(name)],
  ["database dump or backup", (p, name) => /\.(dump|sql\.gz)$/i.test(name) || /(^|\/)backups\//.test(p)],
  ["registry credentials", (p, name) => name === ".npmrc"],
  ["security or pentest document", (p) => /(^|\/)docs\/security\//.test(p) || /pentest/i.test(p)],
  ["development scratch or investigation files", (p) => /(^|\/)(scratch|\.dev-env|\.claude|\.omc)\//.test(p)],
  ["runtime cache (may hold operator searches)", (p) => /(^|\/)(\.cache|runs)\//.test(p)],
  ["version control data", (p) => /(^|\/)\.git\//.test(p)],
  // Source and docs are not secret, but finding them means tracing swept the whole repository.
  ["repository swept in by file tracing", (p) => /^(src|docs|engine|ops|nginx)\//.test(p)],
];

const SKIP_DIRS = new Set(["node_modules"]);

export function scanArtifact(root) {
  const findings = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full);
        continue;
      }
      const path = relative(root, full).split(sep).join("/");
      const rule = RULES.find(([, test]) => test(path, entry.name));
      if (rule) findings.push({ path, reason: rule[0] });
    }
  };
  walk(root);
  return findings.sort((a, b) => a.path.localeCompare(b.path));
}

function main(argv) {
  const report = argv.includes("--report");
  const root = argv.find((arg) => !arg.startsWith("--")) ?? ".next/standalone";
  let findings;
  try {
    findings = scanArtifact(root);
  } catch {
    console.error(`[artifact-check] ${root} not found. Run the build first.`);
    return 2;
  }
  if (findings.length === 0) {
    console.log(`[artifact-check] OK: no sensitive files in ${root}`);
    return 0;
  }
  const byReason = new Map();
  for (const { path, reason } of findings) byReason.set(reason, [...(byReason.get(reason) ?? []), path]);
  console.error(`[artifact-check] ${findings.length} sensitive file(s) in ${root}:`);
  for (const [reason, paths] of byReason) {
    console.error(`  ${reason} (${paths.length})`);
    for (const path of paths.slice(0, 10)) console.error(`    ${path}`);
    if (paths.length > 10) console.error(`    … ${paths.length - 10} more`);
  }
  if (report) {
    console.error("[artifact-check] Local build: do not copy or ship this output. Distributable builds come from the Docker builder only.");
    return 0;
  }
  return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
