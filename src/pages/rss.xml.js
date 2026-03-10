import rss from '@astrojs/rss';
import { AppConfig } from '../utils/AppConfig';
import { buildTextPreview } from '../utils/markdown-text.util';

const MAX_RSS_TITLE_LENGTH = 100;
const RSS_PREVIEW_LENGTH = 320;
const IMAGE_FILE_RE = /\.(avif|gif|jpe?g|png|webp)$/i;

export async function GET(context) {
  const [articleEntries, postEntries] = await Promise.all([
    loadEntries(import.meta.glob('./articles/*.{md,mdx}')),
    loadEntries(import.meta.glob('./posts/*.md'))
  ]);

  const [articleItems, postItems] = await Promise.all([
    Promise.all(articleEntries.map((entry) => entryToArticleRssItem(entry, context.site))),
    Promise.all(postEntries.map((entry) => entryToPostRssItem(entry, context.site)))
  ]);

  const allItems = [...articleItems, ...postItems].sort((a, b) => {
    const dateA = a.sortDate ? a.sortDate.getTime() : Number.NEGATIVE_INFINITY;
    const dateB = b.sortDate ? b.sortDate.getTime() : Number.NEGATIVE_INFINITY;
    return dateB - dateA;
  });

  const latestDate = allItems.find((item) => item.sortDate)?.sortDate ?? new Date();
  const language = AppConfig.locale === 'ru' ? 'ru-RU' : AppConfig.locale;
  const feedSelfLink = new URL('/rss.xml', context.site).toString();
  const rssItems = allItems.map(({ sortDate, ...item }) => item);

  const response = await rss({
    title: AppConfig.title,
    description: AppConfig.description,
    site: context.site,
    items: rssItems,
    stylesheet: './rss/styles.xsl',
    xmlns: {
      atom: 'http://www.w3.org/2005/Atom',
      media: 'http://search.yahoo.com/mrss/'
    },
    customData: [
      `<language>${language}</language>`,
      `<lastBuildDate>${latestDate.toUTCString()}</lastBuildDate>`,
      `<atom:link href="${feedSelfLink}" rel="self" type="application/rss+xml" />`
    ].join('')
  });

  response.headers.set('Content-Type', 'application/xml; charset=utf-8');
  response.headers.set('X-Content-Type-Options', 'nosniff');

  return response;
}

async function loadEntries(globMap) {
  return Promise.all(
    Object.entries(globMap).map(async ([filePath, load]) => {
      const module = await load();
      return { filePath, module };
    })
  );
}

function getValidDate(value) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function getArticleDate(frontmatter) {
  return getValidDate(frontmatter.createdDate ?? frontmatter.pubDate);
}

function getPostDate(frontmatter) {
  return getValidDate(frontmatter.publishDate ?? frontmatter.createdDate);
}

function resolveDescription({ frontmatter, previewText, fallbackTitle }) {
  return firstNonEmpty(
    frontmatter?.description,
    frontmatter?.excerpt,
    previewText,
    fallbackTitle
  );
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.slice(0, maxLength).replace(/\s+\S*$/, '').trim();
  return `${truncated}…`;
}

function toRssTitle(title) {
  return truncateText(firstNonEmpty(title, 'Untitled'), MAX_RSS_TITLE_LENGTH);
}

function getRawMarkdown(module) {
  if (typeof module?.rawContent !== 'function') {
    return '';
  }
  return module.rawContent();
}

function isImagePath(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const cleanValue = value.split('#')[0].split('?')[0];
  return IMAGE_FILE_RE.test(cleanValue);
}

function toAbsoluteUrl(value, site) {
  if (typeof value !== 'string' || !value.trim() || !site) {
    return null;
  }

  try {
    return new URL(value, site).toString();
  } catch {
    return null;
  }
}

function escapeXmlAttr(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function buildMediaCustomData(coverUrl) {
  if (!coverUrl) {
    return '';
  }

  const safeUrl = escapeXmlAttr(coverUrl);
  return `<media:content url="${safeUrl}" medium="image" /><media:thumbnail url="${safeUrl}" />`;
}

function resolveArticleCoverUrl(frontmatter, site) {
  const imageSource = frontmatter?.image?.src;
  if (!isImagePath(imageSource)) {
    return null;
  }

  return toAbsoluteUrl(imageSource, site);
}

function resolvePostCoverUrl(frontmatter, site) {
  const mediaItems = Array.isArray(frontmatter?.media) ? frontmatter.media : [];
  const firstImage = mediaItems.find((mediaItem) => isImagePath(mediaItem));
  if (!firstImage) {
    return null;
  }

  return toAbsoluteUrl(firstImage, site);
}

async function entryToPostRssItem(entry, site) {
  const { module } = entry;
  const { frontmatter, url } = module;
  const title = toRssTitle(frontmatter.title);
  const parsedDate = getPostDate(frontmatter);
  const markdownSource = getRawMarkdown(module);
  const previewText = buildTextPreview(markdownSource, RSS_PREVIEW_LENGTH);
  const compiledContent = typeof module?.compiledContent === 'function'
    ? await module.compiledContent()
    : '';
  const description = resolveDescription({
    frontmatter,
    previewText,
    fallbackTitle: title
  });
  const coverUrl = resolvePostCoverUrl(frontmatter, site);
  const customData = buildMediaCustomData(coverUrl);

  return {
    title,
    link: url,
    description,
    pubDate: parsedDate ?? new Date(0),
    ...(compiledContent ? { content: compiledContent } : {}),
    ...(customData ? { customData } : {}),
    sortDate: parsedDate
  };
}

async function entryToArticleRssItem(entry, site) {
  const { module } = entry;
  const { frontmatter, url } = module;
  const title = toRssTitle(frontmatter.title);
  const parsedDate = getArticleDate(frontmatter);
  const previewText = buildTextPreview(getRawMarkdown(module), RSS_PREVIEW_LENGTH);
  const description = resolveDescription({
    frontmatter,
    previewText,
    fallbackTitle: title
  });
  const coverUrl = resolveArticleCoverUrl(frontmatter, site);
  const customData = buildMediaCustomData(coverUrl);

  return {
    title,
    link: url,
    description,
    pubDate: parsedDate ?? new Date(0),
    ...(customData ? { customData } : {}),
    sortDate: parsedDate
  };
}
