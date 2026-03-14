import fs from "node:fs/promises";
import path from "node:path";
import { toString } from "mdast-util-to-string";
import remarkParse from "remark-parse";
import sharp from "sharp";
import { unified } from "unified";

export const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
export const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".m4v", ".ogg"]);

const ARCHIVE_IMAGE_MAX_WIDTH = 720;
const ARCHIVE_IMAGE_QUALITY = 82;
const ARCHIVE_IMAGE_DIR = "archive";
const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
const HASHTAG_RE = /(?:^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]+)/gu;
const parser = unified().use(remarkParse);

function normalizeText(text) {
  return String(text)
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripFrontmatter(markdown) {
  if (!markdown) return "";
  return String(markdown).replace(FRONTMATTER_RE, "");
}

function stripInlineMarkdown(text) {
  return String(text)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*|__|~~/g, "")
    .replace(/(^|\s)[*`~]+(?=\S)/g, "$1")
    .replace(/(?<=\S)[*`~]+(?=\s|$|[.,!?;:])/g, "");
}

function markdownToPlainText(markdown) {
  if (!markdown) return "";

  try {
    const tree = parser.parse(markdown);
    const children = Array.isArray(tree?.children) ? tree.children : [tree];
    const text = children
      .map((node) => toString(node))
      .filter((chunk) => chunk.trim().length > 0)
      .join("\n\n");

    return stripInlineMarkdown(text);
  } catch {
    return stripInlineMarkdown(markdown);
  }
}

export function buildArchiveExcerpt(markdown, maxLength = 250) {
  const cleaned = normalizeText(markdownToPlainText(stripFrontmatter(markdown)));
  if (!cleaned) return "";
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength)}...`;
}

export function extractArchiveTags(markdown) {
  if (!markdown) return [];

  const bodyWithoutFrontmatter = stripFrontmatter(markdown);
  let plainText = bodyWithoutFrontmatter;

  try {
    const tree = parser.parse(bodyWithoutFrontmatter);
    const children = Array.isArray(tree?.children) ? tree.children : [tree];
    plainText = children
      .map((node) => toString(node))
      .filter((chunk) => chunk.trim().length > 0)
      .join("\n\n");
  } catch {
  }

  const uniqueTags = new Set();
  for (const match of plainText.matchAll(HASHTAG_RE)) {
    const normalizedTag = match[1]?.trim().toLowerCase();
    if (normalizedTag) {
      uniqueTags.add(normalizedTag);
    }
  }

  return [...uniqueTags];
}

export function isImageMedia(src) {
  const cleanSrc = String(src ?? "").split("#")[0].split("?")[0].toLowerCase();
  return IMAGE_EXTENSIONS.has(path.extname(cleanSrc));
}

export function isVideoMedia(src) {
  const cleanSrc = String(src ?? "").split("#")[0].split("?")[0].toLowerCase();
  return VIDEO_EXTENSIONS.has(path.extname(cleanSrc));
}

export function getPreviewImageSrc(mediaList) {
  return Array.isArray(mediaList) ? mediaList.find((src) => isImageMedia(src) && !isVideoMedia(src)) ?? null : null;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function getImageDimensions(filePath) {
  const metadata = await sharp(filePath).metadata();
  const width = Number(metadata.width);
  const height = Number(metadata.height);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Could not read image dimensions for ${filePath}`);
  }

  return { width, height };
}

async function generateArchiveImage(sourcePath, outputPath) {
  const image = sharp(sourcePath, { animated: false }).rotate().resize({
    width: ARCHIVE_IMAGE_MAX_WIDTH,
    withoutEnlargement: true,
    fit: "inside",
  });

  if (outputPath.toLowerCase().endsWith(".webp")) {
    await image.webp({ quality: ARCHIVE_IMAGE_QUALITY }).toFile(outputPath);
    return;
  }

  await image.jpeg({ quality: ARCHIVE_IMAGE_QUALITY }).toFile(outputPath);
}

export async function ensureArchiveImage({ mediaUrl, mediaDir }) {
  if (!mediaUrl || !isImageMedia(mediaUrl)) {
    return null;
  }

  const originalFileName = decodeURIComponent(path.basename(String(mediaUrl)));
  const sourcePath = path.join(mediaDir, originalFileName);
  if (!(await pathExists(sourcePath))) {
    return null;
  }

  await fs.mkdir(path.join(mediaDir, ARCHIVE_IMAGE_DIR), { recursive: true });
  const outputExtension = ".webp";
  const outputFileName = `${path.basename(originalFileName, path.extname(originalFileName))}-archive${outputExtension}`;
  const outputPath = path.join(mediaDir, ARCHIVE_IMAGE_DIR, outputFileName);

  if (!(await pathExists(outputPath))) {
    await generateArchiveImage(sourcePath, outputPath);
  }

  const { width, height } = await getImageDimensions(outputPath);
  return {
    src: `/telegram-media/${ARCHIVE_IMAGE_DIR}/${encodeURIComponent(outputFileName)}`,
    width,
    height,
  };
}
