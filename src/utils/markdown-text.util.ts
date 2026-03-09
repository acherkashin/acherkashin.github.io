import { toString } from 'mdast-util-to-string';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
const markdownParser = unified().use(remarkParse);

export function stripFrontmatter(markdown: string): string {
  if (!markdown) return '';
  return markdown.replace(FRONTMATTER_RE, '');
}

function normalizeText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*|__|~~/g, '')
    .replace(/(^|\s)[*`~]+(?=\S)/g, '$1')
    .replace(/(?<=\S)[*`~]+(?=\s|$|[.,!?;:])/g, '');
}

export function markdownToPlainText(markdown: string): string {
  if (!markdown) return '';

  try {
    const tree = markdownParser.parse(markdown);
    type MdastNode = Parameters<typeof toString>[0];
    const children = Array.isArray((tree as { children?: unknown }).children)
      ? (tree as { children: MdastNode[] }).children
      : [tree as MdastNode];

    const text = children
      .map((node) => toString(node))
      .filter((chunk) => chunk.trim().length > 0)
      .join('\n\n');

    return stripInlineMarkdown(text);
  } catch {
    // Fallback to raw markdown text if parser fails.
    return stripInlineMarkdown(markdown);
  }
}

function isMeaningfulParagraph(block: string): boolean {
  const trimmed = block.trim();
  if (!trimmed) return false;

  if (/^#{1,6}\s/.test(trimmed)) return false;
  if (/^>\s?/.test(trimmed)) return false;
  if (/^([-*+]\s|\d+\.\s)/.test(trimmed)) return false;
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) return false;
  if (/^!\[[^\]]*]\(([^)]+)\)/.test(trimmed)) return false;

  return true;
}

export function getFirstMeaningfulParagraph(markdown: string): string {
  const bodyWithoutFrontmatter = stripFrontmatter(markdown)
    .replace(/```[\s\S]*?```/g, '\n')
    .replace(/~~~[\s\S]*?~~~/g, '\n');

  const blocks = bodyWithoutFrontmatter
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const candidate = blocks.find(isMeaningfulParagraph);
  if (!candidate) return '';

  return normalizeText(markdownToPlainText(candidate));
}

export function buildTextPreview(markdown: string, maxLength: number = 250): string {
  const cleaned = normalizeText(markdownToPlainText(stripFrontmatter(markdown)));
  if (!cleaned) return '';
  if (cleaned.length <= maxLength) return cleaned;

  return cleaned.slice(0, maxLength) + '...';
}
