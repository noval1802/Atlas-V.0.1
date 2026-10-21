import { describe, expect, it } from "vitest";
import { isAdminApi, isProtectedPage, isPublicApi } from "./gate";

describe("ops gate", () => {
  it("leaves login, health, and keyed ingest open", () => {
    expect(isPublicApi("/api/ops/login", "POST")).toBe(true);
    expect(isPublicApi("/api/ops/register", "POST")).toBe(true);
    expect(isPublicApi("/api/ops/password/forgot", "POST")).toBe(true);
    expect(isPublicApi("/api/ops/password/reset", "POST")).toBe(true);
    expect(isPublicApi("/api/health", "GET")).toBe(true);
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
});
