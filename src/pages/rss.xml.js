import rss, { pagesGlobToRssItems } from '@astrojs/rss';

export async function GET(context) {
  // Get articles and Telegram posts
  const [articles, telegramPosts] = await Promise.all([
    pagesGlobToRssItems(import.meta.glob('./articles/*.{md,mdx}')),
    pagesGlobToRssItems(import.meta.glob('./posts/*.md'))
  ]);

  // Merge and sort by date
  const allItems = [...articles, ...telegramPosts].sort((a, b) => {
    return new Date(b.pubDate) - new Date(a.pubDate);
  });

  return rss({
    title: 'nicdun.dev - blog',
    description: 'Crafting the Digital Future with Web Development Wonders',
    site: context.site,
    items: allItems,
    stylesheet: './rss/styles.xsl',
    customData: `<language>en-us</language>`
  });
}
