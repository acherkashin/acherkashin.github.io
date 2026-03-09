import { toString } from 'mdast-util-to-string';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

const markdownParser = unified().use(remarkParse);
const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
const HASHTAG_RE = /(?:^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]+)/gu;

export function extractTelegramTagsFromMarkdown(rawMarkdown: string): string[] {
  if (!rawMarkdown) return [];

  const bodyWithoutFrontmatter = rawMarkdown.replace(FRONTMATTER_RE, '');
  let plainText = bodyWithoutFrontmatter;

  try {
    const tree = markdownParser.parse(bodyWithoutFrontmatter);
    plainText = toString(tree);
  } catch {
    // Keep raw body as fallback if markdown parsing fails.
  }

  const uniqueTags = new Set<string>();
  for (const match of plainText.matchAll(HASHTAG_RE)) {
    const normalizedTag = match[1]?.trim().toLowerCase();
    if (normalizedTag) {
      uniqueTags.add(normalizedTag);
    }
  }

  return [...uniqueTags];
}
