import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_INPUT_ROOT = path.resolve(process.cwd(), ".telegram-export");
const MARKDOWN_DIRNAME = "markdown";
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".m4v"]);
const MEDIA_LIMIT = 10;
const MARKDOWN_ESCAPE_RE = /[\\`*_[\]()~|]/g;
const CUSTOM_REACTION_PREFIX = "custom:";
const ENTITY_PRIORITY = new Map([
  ["MessageEntityPre", 0],
  ["MessageEntityCode", 1],
  ["MessageEntityTextUrl", 2],
  ["MessageEntityUrl", 3],
  ["MessageEntityBlockquote", 4],
  ["MessageEntityBold", 5],
  ["MessageEntityItalic", 6],
  ["MessageEntityUnderline", 7],
  ["MessageEntityStrike", 8],
  ["MessageEntitySpoiler", 9],
]);

function parseArgs(argv) {
  const args = {
    inputRoot: DEFAULT_INPUT_ROOT,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === "--input" && value) {
      args.inputRoot = path.resolve(process.cwd(), value);
      i += 1;
    }
  }

  return args;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function comparePost(a, b) {
  const aDate = toIsoOrNull(a.date) ?? "";
  const bDate = toIsoOrNull(b.date) ?? "";
  if (aDate !== bDate) return aDate.localeCompare(bDate);
  return Number(a.id) - Number(b.id);
}

function firstLine(text) {
  if (!text) return "";
  const lines = String(text).split(/\r?\n/).map((line) => line.trim());
  return lines.find((line) => line.length > 0) ?? "";
}

function dedupeAdjacent(values) {
  const output = [];
  for (const value of values) {
    if (!value) continue;
    if (output.length === 0 || output[output.length - 1] !== value) {
      output.push(value);
    }
  }
  return output;
}

function parseCustomReactionEmojiMap(rawMap) {
  const map = new Map();
  if (!isObject(rawMap)) return map;
  for (const [key, value] of Object.entries(rawMap)) {
    if (typeof key !== "string") continue;
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    map.set(key, trimmed);
  }
  return map;
}

function yamlScalar(value) {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(String(value));
}

function toYaml(value, indent = 0) {
  const space = " ".repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return `${space}[]`;
    const lines = [];
    for (const item of value) {
      if (isObject(item) || Array.isArray(item)) {
        lines.push(`${space}-`);
        lines.push(toYaml(item, indent + 2));
      } else {
        lines.push(`${space}- ${yamlScalar(item)}`);
      }
    }
    return lines.join("\n");
  }

  if (isObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) return `${space}{}`;
    const lines = [];
    for (const key of keys) {
      const entry = value[key];
      if (isObject(entry) || Array.isArray(entry)) {
        lines.push(`${space}${key}:`);
        lines.push(toYaml(entry, indent + 2));
      } else {
        lines.push(`${space}${key}: ${yamlScalar(entry)}`);
      }
    }
    return lines.join("\n");
  }

  return `${space}${yamlScalar(value)}`;
}

function escapeMarkdownText(value) {
  return String(value).replace(MARKDOWN_ESCAPE_RE, "\\$&");
}

function getEntityPriority(className) {
  return ENTITY_PRIORITY.get(className) ?? 100;
}

function normalizeLanguage(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[^\w#+.-]/g, "");
}

function wrapInlineCode(rawText) {
  const value = String(rawText);
  const runs = value.match(/`+/g) ?? [];
  const maxBackticks = runs.reduce((max, run) => Math.max(max, run.length), 0);
  const fence = "`".repeat(maxBackticks + 1);
  const needsPadding = value.startsWith("`") || value.endsWith("`");
  const padded = needsPadding ? ` ${value} ` : value;
  return `${fence}${padded}${fence}`;
}

function wrapFencedCode(rawText, language) {
  const value = String(rawText).replace(/\r\n/g, "\n");
  const runs = value.match(/`+/g) ?? [];
  const maxBackticks = runs.reduce((max, run) => Math.max(max, run.length), 0);
  const fenceSize = Math.max(3, maxBackticks + 1);
  const fence = "`".repeat(fenceSize);
  const lang = normalizeLanguage(language);
  const header = lang ? `${fence}${lang}` : fence;
  const endOfCode = value.endsWith("\n") ? "" : "\n";
  return `${header}\n${value}${endOfCode}${fence}`;
}

function wrapBlockquote(text) {
  return String(text)
    .split("\n")
    .map((line) => (line.length > 0 ? `> ${line}` : ">"))
    .join("\n");
}

function escapeMarkdownLinkDestination(value) {
  return String(value).trim().replace(/\\/g, "\\\\").replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/\s/g, "%20");
}

function normalizeEntities(rawEntities, textLength) {
  if (!Array.isArray(rawEntities) || textLength <= 0) return [];

  const entities = [];
  for (const raw of rawEntities) {
    if (!isObject(raw)) continue;

    const className = typeof raw.className === "string" ? raw.className.trim() : "";
    const offset = Number(raw.offset);
    const length = Number(raw.length);
    if (!className) continue;
    if (!Number.isInteger(offset) || offset < 0 || offset >= textLength) continue;
    if (!Number.isInteger(length) || length <= 0) continue;

    const end = Math.min(offset + length, textLength);
    if (end <= offset) continue;

    const entity = {
      className,
      offset,
      length: end - offset,
    };
    if (typeof raw.language === "string" && raw.language.trim().length > 0) {
      entity.language = raw.language;
    }
    if (typeof raw.url === "string" && raw.url.length > 0) {
      entity.url = raw.url;
    }
    if (raw.userId !== undefined && raw.userId !== null) {
      entity.userId = String(raw.userId);
    }
    if (raw.documentId !== undefined && raw.documentId !== null) {
      entity.documentId = String(raw.documentId);
    }

    entities.push(entity);
  }

  entities.sort((a, b) => {
    if (a.offset !== b.offset) return a.offset - b.offset;
    if (a.length !== b.length) return b.length - a.length;
    const p = getEntityPriority(a.className) - getEntityPriority(b.className);
    if (p !== 0) return p;
    return a.className.localeCompare(b.className);
  });

  return entities;
}

function renderEntity(entity, innerRenderedText, rawText) {
  switch (entity.className) {
    case "MessageEntityPre":
      return wrapFencedCode(rawText, entity.language ?? "");
    case "MessageEntityCode":
      return wrapInlineCode(rawText);
    case "MessageEntityBold":
      return `**${innerRenderedText}**`;
    case "MessageEntityItalic":
      return `*${innerRenderedText}*`;
    case "MessageEntityStrike":
      return `~~${innerRenderedText}~~`;
    case "MessageEntityUnderline":
      return `<u>${innerRenderedText}</u>`;
    case "MessageEntityTextUrl": {
      const href = escapeMarkdownLinkDestination(entity.url ?? rawText);
      return `[${innerRenderedText}](${href})`;
    }
    case "MessageEntityUrl": {
      const target = String(rawText).trim();
      if (!target) return "";
      return `<${target}>`;
    }
    case "MessageEntityBlockquote":
      return wrapBlockquote(innerRenderedText);
    case "MessageEntitySpoiler":
      return `||${innerRenderedText}||`;
    default:
      return innerRenderedText;
  }
}

function renderTelegramRange(text, entities, offset, length, startIndex) {
  if (length <= 0) return "";

  const end = offset + length;
  let cursor = offset;
  let output = "";

  for (let i = startIndex; i < entities.length; i += 1) {
    const entity = entities[i];
    if (entity.offset >= end) break;
    if (entity.offset < offset) continue;
    if (entity.offset < cursor) continue;

    if (entity.offset > cursor) {
      output += escapeMarkdownText(text.slice(cursor, entity.offset));
    }

    const entityEnd = Math.min(entity.offset + entity.length, end);
    if (entityEnd <= entity.offset) {
      continue;
    }

    const entityLength = entityEnd - entity.offset;
    const rawEntityText = text.slice(entity.offset, entityEnd);
    const renderedEntityText = renderTelegramRange(text, entities, entity.offset, entityLength, i + 1);
    output += renderEntity(entity, renderedEntityText, rawEntityText);
    cursor = entityEnd;
  }

  if (cursor < end) {
    output += escapeMarkdownText(text.slice(cursor, end));
  }

  return output;
}

function renderTelegramTextToMarkdown(text, rawEntities) {
  const source = typeof text === "string" ? text : "";
  const entities = normalizeEntities(rawEntities, source.length);
  if (entities.length === 0) return source;
  return renderTelegramRange(source, entities, 0, source.length, 0);
}

function buildGroupedPosts(posts) {
  const groups = new Map();
  for (const post of posts) {
    const key = post.groupedId ? `group:${post.groupedId}` : `post:${post.id}`;
    const existing = groups.get(key);
    if (existing) {
      existing.push(post);
    } else {
      groups.set(key, [post]);
    }
  }
  return Array.from(groups.values()).map((group) => group.slice().sort(comparePost));
}

function normalizeReactionValue(value, customReactionEmojiMap) {
  if (typeof value !== "string") return "unknown";
  if (!value.startsWith(CUSTOM_REACTION_PREFIX)) return value;
  const id = value.slice(CUSTOM_REACTION_PREFIX.length).trim();
  if (!id) return value;
  return customReactionEmojiMap.get(id) ?? value;
}

function aggregateReactions(group, customReactionEmojiMap) {
  const map = new Map();
  for (const post of group) {
    if (!Array.isArray(post.reactions)) continue;
    for (const reaction of post.reactions) {
      const key = normalizeReactionValue(
        reaction?.reaction,
        customReactionEmojiMap,
      );
      const count = Number(reaction?.count) || 0;
      map.set(key, (map.get(key) ?? 0) + count);
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([reaction, count]) => ({ reaction, count }));
}

function computeMaxNumeric(group, field) {
  let maxValue = null;
  for (const post of group) {
    const value = Number(post?.[field]);
    if (!Number.isFinite(value)) continue;
    if (maxValue === null || value > maxValue) {
      maxValue = value;
    }
  }
  return maxValue;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectMediaLinks(group, sourceDir) {
  const seen = new Set();
  const links = [];
  for (const post of group) {
    if (!Array.isArray(post.media)) continue;
    for (const media of post.media) {
      const fileName = path.basename(String(media?.fileName ?? ""));
      if (!fileName) continue;
      if (fileName.toLowerCase().endsWith(".bin")) continue;

      const ext = path.extname(fileName).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(ext) && !VIDEO_EXTENSIONS.has(ext)) {
        continue;
      }

      const absolutePath = path.join(sourceDir, "media", fileName);
      if (!(await fileExists(absolutePath))) {
        continue;
      }

      const mediaUrl = `/telegram-media/${encodeURIComponent(fileName)}`;
      if (seen.has(mediaUrl)) continue;
      seen.add(mediaUrl);
      links.push(mediaUrl);
      if (links.length >= MEDIA_LIMIT) {
        return links;
      }
    }
  }
  return links;
}

function pickUpdatedDate(group) {
  let latest = null;
  for (const post of group) {
    const value = toIsoOrNull(post.editDate);
    if (!value) continue;
    if (latest === null || value > latest) {
      latest = value;
    }
  }
  return latest;
}

function pickPublishDate(group) {
  for (const post of group) {
    const value = toIsoOrNull(post.date);
    if (value) return value;
  }
  return null;
}

function collectBody(group) {
  const chunks = group
    .map((post) => {
      const text = typeof post.text === "string" ? post.text : "";
      return renderTelegramTextToMarkdown(text, post.entities).trim();
    })
    .filter((text) => text.length > 0);
  return dedupeAdjacent(chunks).join("\n\n");
}

function collectRawBody(group) {
  const chunks = group
    .map((post) => (typeof post.text === "string" ? post.text.trim() : ""))
    .filter((text) => text.length > 0);
  return dedupeAdjacent(chunks).join("\n\n");
}

function buildFrontmatter(group, payloadMeta, mediaLinks, customReactionEmojiMap) {
  const ids = group
    .map((post) => Number(post.id))
    .filter((id) => Number.isFinite(id))
    .sort((a, b) => a - b);
  const canonicalId = ids[0];
  const body = collectBody(group);
  const rawBody = collectRawBody(group);
  const title = firstLine(rawBody) || `Post ${canonicalId}`;
  return {
    canonicalId,
    body,
    data: {
      layout: "../../layouts/telegram-post.astro",
      title,
      publishDate: pickPublishDate(group),
      updatedDate: pickUpdatedDate(group),
      telegramId: canonicalId,
      telegramMessageIds: ids,
      telegramGroupedId: group[0]?.groupedId ?? null,
      channel: payloadMeta?.channel ?? null,
      views: computeMaxNumeric(group, "views"),
      forwards: computeMaxNumeric(group, "forwards"),
      reactions: aggregateReactions(group, customReactionEmojiMap),
      media: mediaLinks,
    },
  };
}

function markdownFromFrontmatter(frontmatter, body) {
  const yaml = toYaml(frontmatter);
  return `---\n${yaml}\n---\n\n${body}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = args.inputRoot;
  const postsJsonPath = path.join(sourceDir, "posts.json");

  let payload;
  try {
    const raw = await fs.readFile(postsJsonPath, "utf8");
    payload = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to read or parse ${postsJsonPath}: ${error?.message ?? error}`);
  }

  if (!Array.isArray(payload?.posts)) {
    throw new Error(`Invalid posts.json: "posts" must be an array in ${postsJsonPath}`);
  }
  const customReactionEmojiMap = parseCustomReactionEmojiMap(
    payload?.meta?.customReactionEmojiMap,
  );

  const outputDir = path.join(sourceDir, MARKDOWN_DIRNAME);
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  const groupedPosts = buildGroupedPosts(payload.posts);
  const usedNames = new Set();
  let written = 0;

  for (const group of groupedPosts) {
    const sortedGroup = group.slice().sort(comparePost);
    const mediaLinks = await collectMediaLinks(sortedGroup, sourceDir);
    const { canonicalId, body, data } = buildFrontmatter(
      sortedGroup,
      payload.meta,
      mediaLinks,
      customReactionEmojiMap,
    );

    if (!body.trim() && mediaLinks.length === 0) {
      continue;
    }

    let fileName = `${canonicalId}.md`;
    let collisionIdx = 2;
    while (usedNames.has(fileName)) {
      fileName = `${canonicalId}-${collisionIdx}.md`;
      collisionIdx += 1;
    }
    usedNames.add(fileName);

    const markdown = markdownFromFrontmatter(data, body);
    await fs.writeFile(path.join(outputDir, fileName), markdown, "utf8");
    written += 1;
  }

  console.log(`Source export folder: ${sourceDir}`);
  console.log(`Markdown output: ${outputDir}`);
  console.log(`Markdown files written: ${written}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
