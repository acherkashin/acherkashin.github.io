import rss from '@astrojs/rss';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AppConfig } from '../utils/AppConfig';
import { getFirstMeaningfulParagraph } from '../utils/markdown-text.util';

export async function GET(context) {
  const [articleEntries, postEntries] = await Promise.all([
    loadEntries(import.meta.glob('./articles/*.{md,mdx}')),
    loadEntries(import.meta.glob('./posts/*.md'))
  ]);

  const [articleItems, postItems] = await Promise.all([
    Promise.all(articleEntries.map(entryToArticleRssItem)),
    Promise.all(postEntries.map(entryToPostRssItem))
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
      atom: 'http://www.w3.org/2005/Atom'
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
  return getValidDate(frontmatter.createdDate ?? frontmatter.publishDate);
}

async function getPostDescriptionFromBody(filePath, fallbackTitle) {
  const sourcePath = resolve(process.cwd(), 'src/pages', filePath.replace(/^\.\//, ''));
  const source = await readFile(sourcePath, 'utf8');
  return getFirstMeaningfulParagraph(source) || fallbackTitle;
}

async function entryToPostRssItem(entry) {
  const { module, filePath } = entry;
  const { frontmatter, url } = module;
  const parsedDate = getPostDate(frontmatter);
  const description = await getPostDescriptionFromBody(filePath, frontmatter.title);

  return {
    title: frontmatter.title,
    link: url,
    description,
    pubDate: parsedDate ?? new Date(0),
    sortDate: parsedDate
  };
}

async function entryToArticleRssItem(entry) {
  const { module } = entry;
  const { frontmatter, url } = module;
  const parsedDate = getArticleDate(frontmatter);

  return {
    title: frontmatter.title,
    link: url,
    description: frontmatter.description ?? frontmatter.excerpt ?? frontmatter.title,
    pubDate: parsedDate ?? new Date(0),
    sortDate: parsedDate
  };
}
