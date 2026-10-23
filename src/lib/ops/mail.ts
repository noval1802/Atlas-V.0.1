import net from "node:net";
import tls from "node:tls";

const MAILBOX = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export function mailboxError(value: string): string | null {
  if (/[\r\n]/.test(value) || value.length > 200 || !MAILBOX.test(value)) return "Alamat surel tidak valid.";
  return null;
}

/**
 * Origin for the reset link: OPS_PUBLIC_URL only. The Host header is never used,
 * because a forged Host would mail the victim a real link to the attacker's site.
 * Without a valid public URL no reset mail is sent at all.
 */
export function resetOrigin(): string | null {
  const configured = process.env.OPS_PUBLIC_URL?.trim().replace(/\/$/, "") ?? "";
  return /^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(configured) ? configured : null;
}

export function resetMessage(link: string): { subject: string; text: string } {
  return {
    subject: "ATLAS — tautan reset kata sandi",
    text: [
      "Seseorang meminta reset kata sandi akun ATLAS.",
      "Buka tautan berikut dalam 30 menit. Tautan hanya berlaku sekali.",
      link,
      "Jika Anda tidak meminta reset, abaikan pesan ini.",
    ].join("\n"),
  };
}

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim());
}

type Mail = { to: string; subject: string; text: string };

export async function sendAuthMail(mail: Mail): Promise<{ ok: true } | { ok: false; error: string }> {
  const host = process.env.SMTP_HOST?.trim() ?? "";
  const from = process.env.SMTP_FROM?.trim() ?? "";
  if (!host || !from) return { ok: false, error: "unconfigured" };
  if (mailboxError(from) || mailboxError(mail.to)) return { ok: false, error: "bad_mailbox" };
  const port = Number(process.env.SMTP_PORT || "587");
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { ok: false, error: "bad_port" };
  const user = process.env.SMTP_USER ?? "";
  const pass = process.env.SMTP_PASSWORD ?? "";
  try {
    await deliver({ host, port, implicit: port === 465, user, pass, from, ...mail });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "send_failed";
    const hidden = pass && message.includes(pass) ? "send_failed" : message;
    return { ok: false, error: hidden.slice(0, 160) };
  }
}

type Delivery = {
  host: string;
  port: number;
  implicit: boolean;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  text: string;
};

function connect(host: string, port: number, implicit: boolean): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = implicit ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("smtp_timeout"));
    }, 10000);
    const ready = implicit ? "secureConnect" : "connect";
    socket.once(ready, () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function readReply(socket: net.Socket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => finish(new Error("smtp_timeout")), 10000);
    function onData(chunk: Buffer) {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] ?? "";
      if (/^\d{3} /.test(last)) finish(buffer);
    }
    function onError(error: Error) {
      finish(error);
    }
    function finish(value: string | Error) {
      clearTimeout(timer);
      socket.off("data", onData);
      socket.off("error", onError);
      if (value instanceof Error) reject(value);
      else resolve(value);
    }
    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function expectCode(socket: net.Socket, code: number): Promise<void> {
  const reply = await readReply(socket);
  if (!reply.startsWith(String(code)) && !reply.includes(`\n${code} `)) {
    throw new Error(`smtp_${code}`);
  }
}

function command(socket: net.Socket, line: string): void {
  socket.write(`${line}\r\n`);
}

function upgrade(socket: net.Socket, host: string): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const secure = tls.connect({ socket, servername: host });
    secure.once("secureConnect", () => resolve(secure));
    secure.once("error", reject);
  });
}

async function deliver(input: Delivery): Promise<void> {
  let socket = await connect(input.host, input.port, input.implicit);
  await expectCode(socket, 220);
  command(socket, "EHLO osiris");
  await expectCode(socket, 250);
  if (!input.implicit) {
    command(socket, "STARTTLS");
    await expectCode(socket, 220);
    socket = await upgrade(socket, input.host);
    command(socket, "EHLO osiris");
    await expectCode(socket, 250);
  }
  if (input.user) {
    command(socket, "AUTH LOGIN");
    await expectCode(socket, 334);
    command(socket, Buffer.from(input.user).toString("base64"));
    await expectCode(socket, 334);
    command(socket, Buffer.from(input.pass).toString("base64"));
    await expectCode(socket, 235);
  }
  command(socket, `MAIL FROM:<${input.from}>`);
  await expectCode(socket, 250);
  command(socket, `RCPT TO:<${input.to}>`);
  await expectCode(socket, 250);
  command(socket, "DATA");
  await expectCode(socket, 354);
  const subject = input.subject.replace(/[\r\n]/g, " ");
  const body = input.text.replace(/\r?\n/g, "\r\n").split("\r\n").map((line) => (line.startsWith(".") ? `.${line}` : line)).join("\r\n");
  socket.write(`From: ${input.from}\r\nTo: ${input.to}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}\r\n.\r\n`);
  await expectCode(socket, 250);
  command(socket, "QUIT");
  socket.end();
}
