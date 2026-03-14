import fs from "node:fs/promises";
import path from "node:path";
import { parse, stringify } from "yaml";
import {
  buildArchiveExcerpt,
  ensureArchiveImage,
  extractArchiveTags,
  getPreviewImageSrc,
} from "./archive-metadata.js";

const POSTS_DIR = path.resolve(process.cwd(), "src/pages/posts");
const MEDIA_DIR = path.resolve(process.cwd(), "public/telegram-media");

function splitMarkdownFile(rawMarkdown) {
  const match = rawMarkdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return null;
  }

  return {
    frontmatterRaw: match[1],
    body: match[2] ?? "",
  };
}

async function listMarkdownFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(rootDir, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function withArchiveFields(frontmatter, archiveFields) {
  const output = {};

  for (const [key, value] of Object.entries(frontmatter)) {
    output[key] = value;
    if (key === "media") {
      output.archiveExcerpt = archiveFields.archiveExcerpt;
      output.archiveTags = archiveFields.archiveTags;
      if (archiveFields.archiveImage) {
        output.archiveImage = archiveFields.archiveImage;
      }
    }
  }

  if (!("archiveExcerpt" in output)) {
    output.archiveExcerpt = archiveFields.archiveExcerpt;
  }
  if (!("archiveTags" in output)) {
    output.archiveTags = archiveFields.archiveTags;
  }
  if (archiveFields.archiveImage) {
    output.archiveImage = archiveFields.archiveImage;
  }

  return output;
}

async function main() {
  const files = await listMarkdownFiles(POSTS_DIR);
  let updated = 0;

  for (const filePath of files) {
    const rawMarkdown = await fs.readFile(filePath, "utf8");
    const parts = splitMarkdownFile(rawMarkdown);
    if (!parts) {
      continue;
    }

    const frontmatter = parse(parts.frontmatterRaw);
    if (!frontmatter || typeof frontmatter !== "object" || Array.isArray(frontmatter)) {
      continue;
    }

    const mediaList = Array.isArray(frontmatter.media) ? frontmatter.media : [];
    const archiveImage = await ensureArchiveImage({
      mediaUrl: getPreviewImageSrc(mediaList),
      mediaDir: MEDIA_DIR,
    });

    const archiveFields = {
      archiveExcerpt: buildArchiveExcerpt(parts.body, 250) || String(frontmatter.title ?? "").trim(),
      archiveTags: extractArchiveTags(parts.body),
      archiveImage,
    };

    const nextFrontmatter = withArchiveFields(frontmatter, archiveFields);
    const nextMarkdown = `---\n${stringify(nextFrontmatter, { lineWidth: 0 }).trimEnd()}\n---\n\n${parts.body.replace(/^\r?\n+/, "")}`;

    if (nextMarkdown !== rawMarkdown) {
      await fs.writeFile(filePath, nextMarkdown, "utf8");
      updated += 1;
    }
  }

  console.log(`Archive metadata updated: ${updated}`);
  console.log(`Posts scanned: ${files.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
