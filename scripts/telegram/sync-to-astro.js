import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_EXPORT_DIR = path.resolve(process.cwd(), ".telegram-export");
const DEFAULT_POSTS_DIR = path.resolve(process.cwd(), "src/pages/posts");
const DEFAULT_MEDIA_DIR = path.resolve(process.cwd(), "public/telegram-media");

function parseArgs(argv) {
  const args = {
    mode: "week",
    days: 7,
    exportDir: DEFAULT_EXPORT_DIR,
    postsDir: DEFAULT_POSTS_DIR,
    mediaDir: DEFAULT_MEDIA_DIR,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === "--mode" && value) {
      args.mode = value;
      i += 1;
    } else if (key === "--days" && value) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --days value: ${value}`);
      }
      args.days = parsed;
      i += 1;
    } else if (key === "--export-dir" && value) {
      args.exportDir = path.resolve(process.cwd(), value);
      i += 1;
    } else if (key === "--posts-dir" && value) {
      args.postsDir = path.resolve(process.cwd(), value);
      i += 1;
    } else if (key === "--media-dir" && value) {
      args.mediaDir = path.resolve(process.cwd(), value);
      i += 1;
    }
  }

  if (!["bootstrap", "week"].includes(args.mode)) {
    throw new Error(`Invalid --mode value: ${args.mode}. Expected "bootstrap" or "week".`);
  }

  return args;
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function listFilesRecursive(rootDir) {
  const files = [];
  if (!(await pathExists(rootDir))) return files;
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
      } else if (entry.isFile()) {
        files.push(abs);
      }
    }
  }
  files.sort((a, b) => a.localeCompare(b));
  return files;
}

async function copyDirectoryContents(sourceDir, targetDir) {
  if (!(await pathExists(sourceDir))) {
    throw new Error(`Missing source directory: ${sourceDir}`);
  }

  const files = await listFilesRecursive(sourceDir);
  let copied = 0;
  for (const sourceFile of files) {
    const rel = path.relative(sourceDir, sourceFile);
    const targetFile = path.join(targetDir, rel);
    await ensureDir(path.dirname(targetFile));
    await fs.copyFile(sourceFile, targetFile);
    copied += 1;
  }
  return copied;
}

async function removeFilesByExtension(rootDir, extension) {
  const files = await listFilesRecursive(rootDir);
  let removed = 0;
  for (const filePath of files) {
    if (path.extname(filePath).toLowerCase() !== extension.toLowerCase()) {
      continue;
    }
    await fs.rm(filePath, { force: true });
    removed += 1;
  }
  return removed;
}

function parseFrontmatterPublishDate(markdownRaw) {
  const fmMatch = markdownRaw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return null;
  const fm = fmMatch[1];
  const publishMatch = fm.match(/^publishDate:\s*(.+)$/m);
  if (!publishMatch) return null;

  let value = publishMatch[1].trim();
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

async function removeRecentMarkdownPosts(postsDir, cutoffDate) {
  const files = await listFilesRecursive(postsDir);
  let removed = 0;

  for (const filePath of files) {
    if (path.extname(filePath).toLowerCase() !== ".md") continue;
    const raw = await fs.readFile(filePath, "utf8");
    const publishDate = parseFrontmatterPublishDate(raw);
    if (!publishDate) continue;
    if (publishDate.getTime() >= cutoffDate.getTime()) {
      await fs.rm(filePath, { force: true });
      removed += 1;
    }
  }

  return removed;
}

async function runBootstrapSync(args) {
  const sourceMarkdownDir = path.join(args.exportDir, "markdown");
  const sourceMediaDir = path.join(args.exportDir, "media");

  await ensureDir(args.postsDir);
  await ensureDir(args.mediaDir);

  const removedPosts = await removeFilesByExtension(args.postsDir, ".md");
  await fs.rm(args.mediaDir, { recursive: true, force: true });
  await ensureDir(args.mediaDir);

  const copiedPosts = await copyDirectoryContents(sourceMarkdownDir, args.postsDir);
  const copiedMedia = await copyDirectoryContents(sourceMediaDir, args.mediaDir);

  return { removedPosts, copiedPosts, copiedMedia };
}

async function runWeeklySync(args) {
  const sourceMarkdownDir = path.join(args.exportDir, "markdown");
  const sourceMediaDir = path.join(args.exportDir, "media");
  const cutoffDate = new Date(Date.now() - args.days * 24 * 60 * 60 * 1000);

  await ensureDir(args.postsDir);
  await ensureDir(args.mediaDir);

  const removedRecentPosts = await removeRecentMarkdownPosts(args.postsDir, cutoffDate);
  const copiedPosts = await copyDirectoryContents(sourceMarkdownDir, args.postsDir);
  const copiedMedia = await copyDirectoryContents(sourceMediaDir, args.mediaDir);

  return { removedRecentPosts, copiedPosts, copiedMedia, cutoffDate: cutoffDate.toISOString() };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const postsJsonPath = path.join(args.exportDir, "posts.json");
  if (!(await pathExists(postsJsonPath))) {
    throw new Error(`Missing export payload: ${postsJsonPath}`);
  }

  if (args.mode === "bootstrap") {
    const result = await runBootstrapSync(args);
    console.log("Sync mode: bootstrap");
    console.log(`Posts dir: ${args.postsDir}`);
    console.log(`Media dir: ${args.mediaDir}`);
    console.log(`Removed markdown posts: ${result.removedPosts}`);
    console.log(`Copied markdown posts: ${result.copiedPosts}`);
    console.log(`Copied media files: ${result.copiedMedia}`);
    return;
  }

  const result = await runWeeklySync(args);
  console.log("Sync mode: week");
  console.log(`Cutoff: ${result.cutoffDate}`);
  console.log(`Posts dir: ${args.postsDir}`);
  console.log(`Media dir: ${args.mediaDir}`);
  console.log(`Removed recent markdown posts: ${result.removedRecentPosts}`);
  console.log(`Copied markdown posts: ${result.copiedPosts}`);
  console.log(`Copied media files: ${result.copiedMedia}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
