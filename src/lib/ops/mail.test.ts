import { afterEach, describe, expect, it } from "vitest";
import { mailboxError, resetMessage, resetOrigin, sendAuthMail } from "./mail";

describe("auth mail", () => {
  afterEach(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;
    delete process.env.OPS_PUBLIC_URL;
  });

  it("does not claim a message can be sent when SMTP is unset", async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;
    await expect(sendAuthMail({ to: "orang@example.com", subject: "uji", text: "tautan" })).resolves.toEqual({
      ok: false,
      error: "unconfigured",
    });
  });

  it("builds a reset note that contains the link and no password", () => {
    const message = resetMessage("https://osiris.example/atur-sandi?token=rahasia");
    expect(message.text).toContain("https://osiris.example/atur-sandi?token=rahasia");
    expect(message.text).not.toContain("password=");
    expect(mailboxError("orang@example.com\nBcc: x")).not.toBeNull();
  });

  it("prefers the configured public origin over the request host", () => {
    process.env.OPS_PUBLIC_URL = "https://ops.example";
    const request = new Request("http://evil.example/api", { headers: { host: "evil.example" } });
    expect(resetOrigin(request)).toBe("https://ops.example");
  });
});