import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ userId: "u0", role: "ANALYST", kotamaopsId: null as string | null, where: undefined as unknown }));
vi.mock("@/lib/ops/current-user", () => ({
  currentUser: async () => ({ id: state.userId, role: state.role, kotamaopsId: state.kotamaopsId }),
}));
vi.mock("@/lib/ops/db", () => ({
  opsDb: () => ({ situation: { findMany: async (q: { where: unknown }) => {
    state.where = q.where;
    return [{
      status: "SIAGA", personnel: 120, deployed: 40, incidentCount: 3, note: "banjir\nsurut", updatedAt: new Date("2026-11-19T03:00:00Z"),
      kotamaops: { code: "KODAM-JAYA", name: "Kodam Jaya", matra: "AD", region: "Jakarta", location: "Jakarta Timur" },
    }];
  } } }),
}));

import { POST } from "./route";

const ask = () =>
  POST(new Request("http://localhost/api/ai/chat", {
    method: "POST",
    body: JSON.stringify({ messages: [{ role: "user", content: "halo" }] }),
  }));

let n = 0;
beforeEach(() => {
  state.userId = `u${++n}`; // own rate-limit bucket per test
  state.role = "ANALYST";
  state.kotamaopsId = null;
  vi.stubEnv("HERMES_URL", "http://127.0.0.1:8642/");
  vi.stubEnv("HERMES_API_KEY", "k".repeat(32));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/ai/chat via Hermes", () => {
  it("answers 503 when Hermes is not configured", async () => {
    vi.stubEnv("HERMES_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect((await ask()).status).toBe(503);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends the key and a system prompt carrying the situation data first, and returns the reply", async () => {
    const fetchSpy = vi.fn(async () => Response.json({ choices: [{ message: { content: " Siap. " }, finish_reason: "stop" }] }));
    vi.stubGlobal("fetch", fetchSpy);
    const res = await ask();
    expect(await res.json()).toEqual({ reply: "Siap." });
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8642/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${"k".repeat(32)}`);
    const [system, user] = JSON.parse(init.body as string).messages;
    expect(system.role).toBe("system");
    expect(system.content).toContain("KODAM-JAYA | Kodam Jaya | AD | Jakarta | Jakarta Timur | SIAGA | 120 | 40 | 3 | banjir surut |");
    expect(user).toEqual({ role: "user", content: "halo" });
    expect(state.where).toEqual({});
  });

  it("gives a Kodam operator only their own unit's rows", async () => {
    state.role = "OPERATOR_KODAM";
    state.kotamaopsId = "k1";
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ choices: [{ message: { content: "ok" } }] })));
    await ask();
    expect(state.where).toEqual({ kotamaopsId: "k1" });
  });

  it("says the assistant is unavailable when Hermes is down, without crashing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await ask();
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/tidak tersedia/);
  });

  it("maps a Hermes error to 502", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await ask()).status).toBe(502);
  });
});
