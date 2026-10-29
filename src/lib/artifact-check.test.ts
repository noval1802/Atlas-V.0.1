import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanArtifact } from "../../tools/check-artifact.mjs";

const CANARY = "canary-value-must-never-be-printed";
const dirs: string[] = [];

function artifact(files: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "artifact-check-"));
  dirs.push(root);
  for (const file of files) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), `SECRET=${CANARY}\n`);
  }
  return root;
}

function cli(root: string, ...flags: string[]) {
  const run = spawnSync("node", ["tools/check-artifact.mjs", root, ...flags], { encoding: "utf8" });
  return { code: run.status, output: `${run.stdout}${run.stderr}` };
}

const CLEAN = [
  "server.js",
  "package.json",
  ".env.example",
  ".next/server/app/api/cctv/route.js",
  ".next/server/app/api/cctv/route.js.nft.json",
  "prisma/schema.prisma",
  "prisma/migrations/20261002081920_ops_init/migration.sql",
  "public/kodam/jaya.png",
  "node_modules/next/dist/server/next.js",
];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("artifact safety check", () => {
  it("passes a standalone output that holds only server code and assets", () => {
    const root = artifact(CLEAN);
    expect(scanArtifact(root)).toEqual([]);
    expect(cli(root)).toMatchObject({ code: 0 });
  });

  it("flags every class of sensitive file", () => {
    const root = artifact([
      ...CLEAN,
      ".env",
      ".env.production",
      ".env.local",
      "docs/security/pentest-atlas-local-2026-10-24.md",
      "backups/osiris_ops-20261029.dump",
      "nginx/certs/server.key",
      "ops/tls/atlas.pem",
      ".npmrc",
      ".cache/nominatim.json",
      "scratch/start-dev.sh",
      ".omc/state/agent-replay.jsonl",
      "src/lib/cctv-tokens.ts",
      ".git/config",
    ]);
    const reasons = Object.fromEntries(scanArtifact(root).map(({ path, reason }) => [path, reason]));
    expect(reasons).toMatchObject({
      ".env": "env file",
      ".env.production": "env file",
      ".env.local": "env file",
      "docs/security/pentest-atlas-local-2026-10-24.md": "security or pentest document",
      "backups/osiris_ops-20261029.dump": "database dump or backup",
      "nginx/certs/server.key": "private key or certificate",
      "ops/tls/atlas.pem": "private key or certificate",
      ".npmrc": "registry credentials",
      ".cache/nominatim.json": "runtime cache (may hold operator searches)",
      "scratch/start-dev.sh": "development scratch or investigation files",
      ".omc/state/agent-replay.jsonl": "development scratch or investigation files",
      "src/lib/cctv-tokens.ts": "repository swept in by file tracing",
      ".git/config": "version control data",
    });
    expect(Object.keys(reasons)).not.toContain(".env.example");
  });

  it("fails strictly, reports without failing, and never prints file contents", () => {
    const root = artifact([...CLEAN, ".env", "docs/security/pentest.md"]);
    const strict = cli(root);
    expect(strict.code).toBe(1);
    expect(strict.output).toContain(".env");
    const report = cli(root, "--report");
    expect(report.code).toBe(0);
    expect(report.output).toContain("do not copy or ship");
    for (const run of [strict, report]) expect(run.output).not.toContain(CANARY);
  });

  it("refuses to pass when the artifact is missing", () => {
    expect(cli(join(tmpdir(), "artifact-check-does-not-exist")).code).toBe(2);
  });
});
