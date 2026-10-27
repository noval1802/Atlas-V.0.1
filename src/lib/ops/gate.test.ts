import { describe, expect, it } from "vitest";
import { crossSiteWrite, isAdminApi, isProtectedPage, isPublicApi } from "./gate";

describe("ops gate", () => {
  it("leaves login and health open", () => {
    expect(isPublicApi("/api/ops/login")).toBe(true);
    expect(isPublicApi("/api/ops/register")).toBe(true);
    expect(isPublicApi("/api/ops/password/forgot")).toBe(true);
    expect(isPublicApi("/api/ops/password/reset")).toBe(true);
    expect(isPublicApi("/api/health")).toBe(true);
    expect(isPublicApi("/api/health/ready")).toBe(true);
  });

  it("closes monitoring feeds and removed integrations", () => {
    expect(isPublicApi("/api/maritime")).toBe(false);
    expect(isPublicApi("/api/cctv")).toBe(false);
    expect(isPublicApi("/api/flights")).toBe(false);
    expect(isPublicApi("/api/proxy-tiles")).toBe(false);
    expect(isPublicApi("/api/ops/situations")).toBe(false);
    expect(isPublicApi("/api/ops/users")).toBe(false);
    expect(isPublicApi("/api/sdk/ingest")).toBe(false);
    expect(isPublicApi("/api/github-webhook")).toBe(false);
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
