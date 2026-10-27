import { describe, expect, it } from "vitest";
import { crossSiteWrite, isAdminApi, isOperatorApi, isProtectedPage, isPublicApi } from "./gate";

describe("ops gate", () => {
  it("leaves login, health, and keyed ingest open", () => {
    expect(isPublicApi("/api/ops/login", "POST")).toBe(true);
    expect(isPublicApi("/api/ops/register", "POST")).toBe(true);
    expect(isPublicApi("/api/ops/password/forgot", "POST")).toBe(true);
    expect(isPublicApi("/api/ops/password/reset", "POST")).toBe(true);
    expect(isPublicApi("/api/health", "GET")).toBe(true);
    expect(isPublicApi("/api/health/ready", "GET")).toBe(true);
    expect(isPublicApi("/api/github-webhook", "POST")).toBe(true);
    expect(isPublicApi("/api/sdk/ingest", "POST")).toBe(true);
  });

  it("closes monitoring feeds and the ingest listing", () => {
    expect(isPublicApi("/api/maritime", "GET")).toBe(false);
    expect(isPublicApi("/api/cctv", "GET")).toBe(false);
    expect(isPublicApi("/api/flights", "GET")).toBe(false);
    expect(isPublicApi("/api/proxy-tiles", "GET")).toBe(false);
    expect(isPublicApi("/api/ops/situations", "GET")).toBe(false);
    expect(isPublicApi("/api/ops/users", "GET")).toBe(false);
    expect(isPublicApi("/api/sdk/ingest", "GET")).toBe(false);
  });

  it("marks user administration and token changes as admin APIs", () => {
    expect(isAdminApi("/api/ops/users")).toBe(true);
    expect(isAdminApi("/api/ops/users/abc")).toBe(true);
    expect(isAdminApi("/api/ops/audit")).toBe(true);
    expect(isAdminApi("/api/cctv/tokens")).toBe(true);
    expect(isAdminApi("/api/ops/situations")).toBe(false);
    expect(isAdminApi("/api/ops/login")).toBe(false);
    expect(isAdminApi("/api/maritime")).toBe(false);
  });

  it("guards the map and the operational pages only", () => {
    expect(isProtectedPage("/peta")).toBe(true);
    expect(isProtectedPage("/operator")).toBe(true);
    expect(isProtectedPage("/pengguna")).toBe(true);
    expect(isProtectedPage("/")).toBe(false);
    expect(isProtectedPage("/masuk")).toBe(false);
    expect(isProtectedPage("/daftar")).toBe(false);
    expect(isProtectedPage("/docs")).toBe(false);
  });

  it("marks active recon and OSINT lookups as operator APIs", () => {
    expect(isOperatorApi("/api/scanner")).toBe(true);
    expect(isOperatorApi("/api/osint/whois")).toBe(true);
    expect(isOperatorApi("/api/osint/leaks")).toBe(true);
    expect(isOperatorApi("/api/osintx")).toBe(false);
    expect(isOperatorApi("/api/cctv")).toBe(false);
  });

  it("refuses state-changing requests from another site", () => {
    const h = (entries: Record<string, string>) => new Headers(entries);
    expect(crossSiteWrite("POST", h({ "sec-fetch-site": "cross-site" }))).toBe(true);
    expect(crossSiteWrite("POST", h({ "sec-fetch-site": "same-site" }))).toBe(true);
    expect(crossSiteWrite("PATCH", h({ host: "ops.example:8080", origin: "https://evil.example" }))).toBe(true);
    expect(crossSiteWrite("POST", h({ host: "ops.example:8080", origin: "null" }))).toBe(true);
  });

  it("lets same-origin writes, reads, and server callers through", () => {
    const h = (entries: Record<string, string>) => new Headers(entries);
    expect(crossSiteWrite("POST", h({ "sec-fetch-site": "same-origin", origin: "http://ops.example:8080", host: "ops.example:8080" }))).toBe(false);
    expect(crossSiteWrite("POST", h({ host: "ops.example:8080", origin: "http://ops.example:8080" }))).toBe(false);
    expect(crossSiteWrite("GET", h({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(crossSiteWrite("POST", h({ host: "ops.example" }))).toBe(false);
  });
});
