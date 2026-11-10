import { describe, expect, it } from "vitest";
import { parseChatMessages } from "./ai-chat";

describe("parseChatMessages", () => {
  it("accepts a user-first, user-last conversation and trims text", () => {
    expect(parseChatMessages({ messages: [
      { role: "user", content: " halo " },
      { role: "assistant", content: "Ada yang bisa dibantu?" },
      { role: "user", content: "cara simpan situasi?" },
    ] })).toEqual([
      { role: "user", content: "halo" },
      { role: "assistant", content: "Ada yang bisa dibantu?" },
      { role: "user", content: "cara simpan situasi?" },
    ]);
  });

  it("rejects bad shapes, roles, empty or oversized text", () => {
    expect(parseChatMessages(null)).toBeNull();
    expect(parseChatMessages({ messages: [] })).toBeNull();
    expect(parseChatMessages({ messages: [{ role: "system", content: "x" }] })).toBeNull();
    expect(parseChatMessages({ messages: [{ role: "assistant", content: "x" }] })).toBeNull();
    expect(parseChatMessages({ messages: [{ role: "user", content: "   " }] })).toBeNull();
    expect(parseChatMessages({ messages: [{ role: "user", content: "a".repeat(2001) }] })).toBeNull();
    expect(parseChatMessages({ messages: Array(21).fill({ role: "user", content: "x" }) })).toBeNull();
  });
});
