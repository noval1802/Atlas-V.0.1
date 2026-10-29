#!/usr/bin/env node
/**
 * Pemulihan sandi SUPER_ADMIN lokal.
 *
 *   npm run ops:recover-admin -- --username <nama>
 *
 * Sandi baru hanya dibaca lewat prompt tersembunyi (diketik dua kali), tidak pernah
 * lewat argumen, dan tidak pernah dicetak. Butuh DATABASE_URL yang sah, sama seperti
 * aplikasi; tanpa akses basis data alat ini tidak bisa apa-apa.
 * Masukan lewat pipa (bukan terminal) diterima untuk pengujian; jangan memakainya
 * dengan `echo`, karena sandi bisa tertinggal di riwayat shell.
 */
import { PrismaClient } from "@prisma/client";
import { recoverAdminPassword } from "./admin-recovery.mjs";

function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== "--username" || !argv[1] || argv[1].startsWith("-")) {
    return { error: "Pemakaian: npm run ops:recover-admin -- --username <nama>. Kata sandi tidak diterima lewat argumen; alat ini akan menanyakannya." };
  }
  return { username: argv[1] };
}

/** Read one line from the terminal without echoing it. */
function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    process.stderr.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const finish = (done) => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stderr.write("\n");
      done();
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") return finish(() => resolve(value));
        if (ch === "\u0003" || ch === "\u0004") return finish(() => reject(new Error("Dibatalkan.")));
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function readPiped() {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  const [password = "", confirmPassword = ""] = text.split(/\r?\n/);
  return { password, confirmPassword };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.error) {
    console.error(args.error);
    return 2;
  }
  let password;
  let confirmPassword;
  if (process.stdin.isTTY) {
    password = await readHidden(`Kata sandi baru untuk ${args.username}: `);
    confirmPassword = await readHidden("Ulangi kata sandi baru: ");
  } else {
    ({ password, confirmPassword } = await readPiped());
  }

  const db = new PrismaClient();
  try {
    const result = await recoverAdminPassword(db, { username: args.username, password, confirmPassword });
    if (!result.ok) {
      console.error(`Gagal: ${result.error}`);
      return 1;
    }
    console.log(`Sandi ${result.username} diperbarui. Semua sesi lama dicabut (sessionVersion ${result.sessionVersion}).`);
    if (result.warning) console.error(`Perhatian: ${result.warning}`);
    return 0;
  } finally {
    await db.$disconnect();
  }
}

main().then(
  (code) => { process.exitCode = code; },
  (error) => {
    // Only an error code: a stack or a full Prisma message is never printed, in case it echoes input.
    const cancelled = error instanceof Error && error.message === "Dibatalkan.";
    const code = error?.code ?? error?.name ?? "tidak diketahui";
    console.error(cancelled ? "Dibatalkan. Tidak ada yang diubah." : `Gagal (${code}). Perubahan berjalan dalam satu transaksi, jadi tidak ada yang tersimpan setengah.`);
    process.exitCode = 1;
  },
);
