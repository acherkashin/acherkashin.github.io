export function formatDate(pubDate: string) {
  var options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };

  return new Date(pubDate).toLocaleDateString('ru-RU', options);
}

export interface WithFrontmatter<T = any> {
  frontmatter: T
}

export function sortPostsByDate(a: WithFrontmatter<any>, b: WithFrontmatter<any>) {
  console.log(a.frontmatter.title);
  console.log(b.frontmatter.title);
  const pubDateA = new Date(a.frontmatter.pubDate);
  const pubDateB = new Date(b.frontmatter.pubDate);
  if (pubDateA < pubDateB) {
    return 1;
  }
  if (pubDateA > pubDateB) {
    return -1;
  }
  return 0;
} 