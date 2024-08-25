export function formatDate(pubDate: string) {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };

  const result = new Date(pubDate).toLocaleDateString('ru-RU', options);
    
  return result;
}

export interface WithFrontmatter<T = any> {
  frontmatter: T
}

export function sortPostsByDate(a: WithFrontmatter<any>, b: WithFrontmatter<any>) {
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