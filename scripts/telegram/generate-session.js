import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

const ENV_FILE = path.resolve(process.cwd(), ".env");

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function loadDotEnv() {
  try {
    const raw = await fs.readFile(ENV_FILE, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const normalized = trimmed.startsWith("export ")
        ? trimmed.slice("export ".length)
        : trimmed;
      const idx = normalized.indexOf("=");
      if (idx <= 0) continue;

      const key = normalized.slice(0, idx).trim();
      const value = normalized.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value.replace(/^['"]|['"]$/g, "");
      }
    }
  } catch {
    // .env is optional.
  }
}

async function main() {
  await loadDotEnv();
  const apiId = Number(getRequiredEnv("TG_API_ID"));
  const apiHash = getRequiredEnv("TG_API_HASH");
  if (!Number.isFinite(apiId)) {
    throw new Error("TG_API_ID must be a number.");
  }

  const rl = readline.createInterface({ input, output });
  const ask = async (q) => (await rl.question(q)).trim();
  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
  });

  try {
    await client.start({
      phoneNumber: async () => ask("Phone number (international format): "),
      phoneCode: async () => ask("Code from Telegram: "),
      password: async (hint) => ask(`2FA password (if enabled): ${hint}`),
      onError: (error) => console.error("Auth error:", error?.message ?? error),
    });

    console.log("\nCopy this value to your .env and GitHub secret TG_STRING_SESSION:");
    console.log(client.session.save());
  } finally {
    await client.disconnect();
    rl.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
