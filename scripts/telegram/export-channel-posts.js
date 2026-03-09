import fs from "node:fs/promises";
import path from "node:path";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { FloodWaitError } from "telegram/errors/index.js";

const DEFAULT_CHANNEL = "@cherkashindev";
const DEFAULT_DAYS = 7;
const DEFAULT_OUTPUT_ROOT = path.resolve(process.cwd(), ".telegram-export");
const ENV_FILE = path.resolve(process.cwd(), ".env");
const CUSTOM_REACTION_PREFIX = "custom:";
const CUSTOM_EMOJI_BATCH_SIZE = 200;

function parseArgs(argv) {
  const envChannel = process.env.TG_CHANNEL;
  const envDays = process.env.EXPORT_DAYS;
  const envOutput = process.env.EXPORT_OUTPUT_DIR;

  const parsedEnvDays = Number(envDays);
  const args = {
    channel: envChannel || DEFAULT_CHANNEL,
    days: Number.isFinite(parsedEnvDays) && parsedEnvDays > 0 ? parsedEnvDays : DEFAULT_DAYS,
    outputRoot: envOutput ? path.resolve(process.cwd(), envOutput) : DEFAULT_OUTPUT_ROOT,
    all: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];

    if (key === "--channel" && value) {
      args.channel = value;
      i += 1;
    } else if (key === "--days" && value) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid value for --days: ${value}`);
      }
      args.days = parsed;
      i += 1;
    } else if (key === "--output" && value) {
      args.outputRoot = path.resolve(process.cwd(), value);
      i += 1;
    } else if (key === "--all") {
      args.all = true;
    }
  }

  return args;
}

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

function escapeFilename(name) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
}

function mimeToExt(mimeType) {
  if (!mimeType) return "";
  const map = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/ogg": ".ogg",
    "audio/mp4": ".m4a",
    "application/pdf": ".pdf",
    "application/zip": ".zip",
  };
  return map[mimeType] ?? "";
}

function extractFileNameFromDocument(document) {
  if (!document || !Array.isArray(document.attributes)) return "";
  for (const attr of document.attributes) {
    if (attr instanceof Api.DocumentAttributeFilename && attr.fileName) {
      return escapeFilename(attr.fileName);
    }
  }
  return "";
}

function inferMediaInfo(message, index) {
  const base = `msg-${message.id}-${index}`;
  const media = message.media;
  if (!media) {
    return null;
  }

  if (media instanceof Api.MessageMediaPhoto) {
    return {
      type: "photo",
      fileName: `${base}.jpg`,
      mimeType: "image/jpeg",
    };
  }

  if (media instanceof Api.MessageMediaDocument) {
    const doc = media.document;
    const explicitName = extractFileNameFromDocument(doc);
    if (explicitName) {
      return {
        type: "document",
        fileName: explicitName,
        mimeType: doc?.mimeType ?? null,
      };
    }

    const ext = mimeToExt(doc?.mimeType) || ".bin";
    return {
      type: "document",
      fileName: `${base}${ext}`,
      mimeType: doc?.mimeType ?? null,
    };
  }

  return {
    type: "unsupported",
    fileName: `${base}.bin`,
    mimeType: null,
  };
}

function parseReactions(reactionsObj) {
  if (!reactionsObj?.results) return [];
  return reactionsObj.results.map((item) => {
    let reaction = "unknown";
    if (item.reaction instanceof Api.ReactionEmoji) {
      reaction = item.reaction.emoticon;
    } else if (item.reaction instanceof Api.ReactionCustomEmoji) {
      reaction = `${CUSTOM_REACTION_PREFIX}${item.reaction.documentId.toString()}`;
    }
    return {
      reaction,
      count: item.count ?? 0,
      chosenOrder: item.chosenOrder ?? null,
    };
  });
}

function serializeMessageEntities(entities) {
  if (!Array.isArray(entities) || entities.length === 0) return [];

  return entities
    .map((entity) => {
      const className =
        typeof entity?.className === "string" && entity.className.length > 0
          ? entity.className
          : typeof entity?.constructor?.name === "string"
            ? entity.constructor.name
            : null;
      const offset = Number(entity?.offset);
      const length = Number(entity?.length);

      if (!className) return null;
      if (!Number.isInteger(offset) || offset < 0) return null;
      if (!Number.isInteger(length) || length <= 0) return null;

      const payload = { className, offset, length };
      if (typeof entity?.language === "string" && entity.language.length > 0) {
        payload.language = entity.language;
      }
      if (typeof entity?.url === "string" && entity.url.length > 0) {
        payload.url = entity.url;
      }
      if (entity?.userId !== undefined && entity?.userId !== null) {
        payload.userId = String(entity.userId);
      }
      if (entity?.documentId !== undefined && entity?.documentId !== null) {
        payload.documentId = String(entity.documentId);
      }

      return payload;
    })
    .filter(Boolean);
}

function collectCustomReactionDocumentIds(posts) {
  const ids = new Set();
  for (const post of posts) {
    if (!Array.isArray(post?.reactions)) continue;
    for (const reaction of post.reactions) {
      if (typeof reaction?.reaction !== "string") continue;
      if (!reaction.reaction.startsWith(CUSTOM_REACTION_PREFIX)) continue;
      const documentId = reaction.reaction.slice(CUSTOM_REACTION_PREFIX.length).trim();
      if (documentId.length > 0) {
        ids.add(documentId);
      }
    }
  }
  return Array.from(ids);
}

async function resolveCustomReactionEmojiMap(client, documentIds) {
  const map = new Map();
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return map;
  }

  for (let i = 0; i < documentIds.length; i += CUSTOM_EMOJI_BATCH_SIZE) {
    const batch = documentIds.slice(i, i + CUSTOM_EMOJI_BATCH_SIZE);
    const normalizedIds = [];
    for (const value of batch) {
      try {
        normalizedIds.push(BigInt(value));
      } catch {
        // Ignore malformed IDs.
      }
    }
    if (normalizedIds.length === 0) continue;

    const documents = await withFloodWaitRetry(() =>
      client.invoke(
        new Api.messages.GetCustomEmojiDocuments({
          documentId: normalizedIds,
        }),
      ),
    );

    for (const doc of documents ?? []) {
      const id = doc?.id?.toString?.();
      if (!id || !Array.isArray(doc.attributes)) continue;
      const attr = doc.attributes.find(
        (item) => item instanceof Api.DocumentAttributeCustomEmoji,
      );
      const alt = typeof attr?.alt === "string" ? attr.alt.trim() : "";
      if (alt) {
        map.set(id, alt);
      }
    }
  }

  return map;
}

function applyCustomReactionEmojiMap(posts, emojiMap) {
  if (!(emojiMap instanceof Map) || emojiMap.size === 0) return;
  for (const post of posts) {
    if (!Array.isArray(post?.reactions)) continue;
    post.reactions = post.reactions.map((reaction) => {
      if (typeof reaction?.reaction !== "string") return reaction;
      if (!reaction.reaction.startsWith(CUSTOM_REACTION_PREFIX)) return reaction;
      const documentId = reaction.reaction.slice(CUSTOM_REACTION_PREFIX.length).trim();
      const replacement = emojiMap.get(documentId);
      if (!replacement) return reaction;
      return { ...reaction, reaction: replacement };
    });
  }
}

function mapToSortedObject(map) {
  const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  return Object.fromEntries(entries);
}

async function withFloodWaitRetry(fn, retries = 3) {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof FloodWaitError && attempt < retries) {
        const waitMs = (error.seconds + 1) * 1000;
        console.warn(`Flood wait: sleeping ${error.seconds}s...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        attempt += 1;
        continue;
      }
      throw error;
    }
  }
  throw new Error("Unexpected retry loop termination.");
}

async function downloadMessageMedia(client, message, mediaDir) {
  const info = inferMediaInfo(message, 1);
  if (!info) return [];

  const absolutePath = path.join(mediaDir, info.fileName);
  let result;
  try {
    result = await withFloodWaitRetry(() => client.downloadMedia(message, {}));
  } catch (error) {
    return [
      {
        type: info.type,
        fileName: path.basename(absolutePath),
        path: absolutePath,
        relativePath: path.join("media", path.basename(absolutePath)),
        mimeType: info.mimeType,
        downloadError: error?.message ?? String(error),
      },
    ];
  }
  if (!result) return [];

  if (Buffer.isBuffer(result)) {
    await fs.writeFile(absolutePath, result);
  } else if (typeof result === "string") {
    try {
      await fs.rename(result, absolutePath);
    } catch {
      await fs.copyFile(result, absolutePath);
    }
  } else {
    return [];
  }

  return [
    {
      type: info.type,
      fileName: path.basename(absolutePath),
      path: absolutePath,
      relativePath: path.join("media", path.basename(absolutePath)),
      mimeType: info.mimeType,
    },
  ];
}

function normalizeTelegramDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    // GramJS dates are typically unix seconds.
    return new Date(value * 1000);
  }
  if (typeof value === "bigint") {
    return new Date(Number(value) * 1000);
  }
  if (typeof value === "string") {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      return new Date(asNumber * 1000);
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && typeof value.valueOf === "function") {
    const v = value.valueOf();
    if (v instanceof Date) return v;
    if (typeof v === "number" && Number.isFinite(v)) {
      return new Date(v * 1000);
    }
  }
  return null;
}

async function readPreviousPosts(outputRoot) {
  try {
    const previousJsonPath = path.join(outputRoot, "posts.json");
    const raw = await fs.readFile(previousJsonPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.posts) ? parsed.posts : null;
  } catch {
    return null;
  }
}

async function main() {
  await loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  const apiId = Number(getRequiredEnv("TG_API_ID"));
  const apiHash = getRequiredEnv("TG_API_HASH");
  const stringSession = getRequiredEnv("TG_STRING_SESSION");
  if (!Number.isFinite(apiId)) {
    throw new Error("TG_API_ID must be a number.");
  }

  const nowMs = Date.now();
  const cutoffMs = args.all ? null : nowMs - args.days * 24 * 60 * 60 * 1000;
  const outputDir = args.outputRoot;
  const mediaDir = path.join(outputDir, "media");
  const stagingMediaDir = path.join(outputDir, ".media-tmp");
  const jsonPath = path.join(outputDir, "posts.json");

  await fs.mkdir(outputDir, { recursive: true });
  await fs.rm(stagingMediaDir, { recursive: true, force: true });
  await fs.mkdir(stagingMediaDir, { recursive: true });
  const previousPosts = await readPreviousPosts(outputDir);

  const session = new StringSession(stringSession);
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  console.log("Connecting to Telegram...");
  await client.connect();
  const authorized = await client.checkAuthorization();
  if (!authorized) {
    throw new Error("Unauthorized TG_STRING_SESSION. Regenerate TG_STRING_SESSION and retry.");
  }

  console.log(`Loading channel ${args.channel}...`);
  const entity = await client.getEntity(args.channel);

  const posts = [];
  let scanned = 0;
  let withinRangeCount = 0;

  for await (const message of client.iterMessages(entity, { reverse: false })) {
    scanned += 1;
    const messageDate = normalizeTelegramDate(message?.date);
    if (!messageDate) continue;

    const dateMs = messageDate.getTime();
    if (cutoffMs !== null && dateMs < cutoffMs) {
      break;
    }

    withinRangeCount += 1;
    if (message.fwdFrom) continue;
    if (!message.post) continue;

    const mediaFiles = await downloadMessageMedia(client, message, stagingMediaDir);
    const text = message.message ?? "";
    const entities = serializeMessageEntities(message.entities ?? []);
    const reactions = parseReactions(message.reactions);

    const editDate = normalizeTelegramDate(message.editDate);
    posts.push({
      id: message.id,
      date: messageDate.toISOString(),
      editDate: editDate ? editDate.toISOString() : null,
      text,
      entities,
      views: message.views ?? null,
      forwards: message.forwards ?? null,
      reactions,
      media: mediaFiles,
      groupedId: message.groupedId ? message.groupedId.toString() : null,
      postAuthor: message.postAuthor ?? null,
    });

    if (posts.length % 25 === 0) {
      console.log(`Collected ${posts.length} posts so far...`);
    }
  }

  posts.sort((a, b) => {
    if (a.date === b.date) {
      return a.id - b.id;
    }
    return a.date.localeCompare(b.date);
  });

  const customReactionDocumentIds = collectCustomReactionDocumentIds(posts);
  const customReactionEmojiMap = await resolveCustomReactionEmojiMap(
    client,
    customReactionDocumentIds,
  );
  applyCustomReactionEmojiMap(posts, customReactionEmojiMap);

  const exportPayload = {
    meta: {
      channel: args.channel,
      exportedAt: new Date(nowMs).toISOString(),
      windowHours: args.all ? null : args.days * 24,
      cutoff: cutoffMs === null ? null : new Date(cutoffMs).toISOString(),
      scannedMessages: scanned,
      inWindowMessages: withinRangeCount,
      exportedPosts: posts.length,
      customReactionEmojiMap: mapToSortedObject(customReactionEmojiMap),
    },
    posts,
  };

  const unchanged = JSON.stringify(previousPosts ?? []) === JSON.stringify(posts);
  if (unchanged) {
    await fs.rm(stagingMediaDir, { recursive: true, force: true });
  } else {
    await fs.rm(mediaDir, { recursive: true, force: true });
    await fs.rename(stagingMediaDir, mediaDir);
    await fs.writeFile(jsonPath, JSON.stringify(exportPayload, null, 2), "utf8");
  }

  await client.disconnect();

  if (unchanged) {
    console.log("Export complete. No changes versus previous export; skipping output commit.");
  } else {
    console.log("Export complete.");
    console.log(`JSON: ${jsonPath}`);
    console.log(`Media dir: ${mediaDir}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
