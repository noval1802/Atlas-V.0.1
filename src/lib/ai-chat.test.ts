import { describe, expect, it } from "vitest";
import { chatReply, chatSystem, parseChatMessages } from "./ai-chat";

describe("chatReply", () => {
  it("reads the first choice, and never returns an empty or broken reply", () => {
    expect(chatReply({ choices: [{ message: { content: " jawab " } }] })).toBe("jawab");
    expect(chatReply({ choices: [{ message: { content: "" } }] })).toBe("Tidak ada jawaban.");
    expect(chatReply(null)).toBe("Tidak ada jawaban.");
    expect(chatReply({ choices: [{ message: { content: "x" }, finish_reason: "content_filter" }] })).toMatch(/tidak dapat dijawab/);
  });
});

describe("chatSystem", () => {
  it("lists one row per unit in WIB, and says so when the user may see none", () => {
    const text = chatSystem([{ code: "A", name: "N | x", matra: "AL", region: "R", location: "L", status: "KONDUSIF",
      personnel: 1, deployed: 0, incidentCount: 0, note: "", updatedAt: new Date("2026-11-19T03:00:00Z") }]);
    expect(text).toMatch(/^A \| N x \| AL \| R \| L \| KONDUSIF \| 1 \| 0 \| 0 \| - \| .*10[.:]00 WIB$/m);
    expect(chatSystem([])).toContain("tidak ada Kotamaops");
  });
});

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

  /* A full answer (max_tokens 4000) runs past 2000 characters; the next
     question carried it back and every later message was refused with 400. */
  it("accepts a long earlier answer but still caps it", () => {
    const turns = (answer: string) => ({ messages: [
      { role: "user", content: "jelaskan" },
      { role: "assistant", content: answer },
      { role: "user", content: "lanjut" },
    ] });
    expect(parseChatMessages(turns("a".repeat(9000)))).not.toBeNull();
    expect(parseChatMessages(turns("a".repeat(16_001)))).toBeNull();
  });
});
