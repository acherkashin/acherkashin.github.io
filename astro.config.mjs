import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import { remarkReadingTime } from './src/utils/readingTime';
import rehypePrettyCode from 'rehype-pretty-code';
import react from '@astrojs/react';
// for google crawlers https://docs.astro.build/en/guides/integrations-guide/sitemap/
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";
const options = {
  // Specify the theme to use or a custom theme json, in our case
  // it will be a moonlight-II theme from
  // https://github.com/atomiks/moonlight-vscode-theme/blob/master/src/moonlight-ii.json
  // Callbacks to customize the output of the nodes
  //theme: json,
  onVisitLine(node) {
    // Prevent lines from collapsing in `display: grid` mode, and
    // allow empty lines to be copy/pasted
    if (node.children.length === 0) {
      node.children = [{
        type: 'text',
        value: ' '
      }];
    }
  },
  onVisitHighlightedLine(node) {
    // Adding a class to the highlighted line
    node.properties.className = ['highlighted'];
  }
};


// https://astro.build/config
export default defineConfig({
  site: 'https://cherkashin.dev/',
  markdown: {
    syntaxHighlight: false,
    // Disable syntax built-in syntax hightlighting from astro
    rehypePlugins: [[rehypePrettyCode, options]],
    remarkPlugins: [remarkReadingTime]
  },
  integrations: [tailwind(), react(), sitemap(), mdx()],
  output: 'static',
  redirects: {
    '/vscode/typescript/extension/2020/04/14/virtualbox-vscode-extension.html': 'articles/virtualbox-vscode-extension',
    '/accessibility/html/css/2020/06/05/keyboard-navigation.html': '/articles/keyboard-navigation',
    '/csharp/dotnet/scripts/2020/09/26/csharp-repl.html': '/articles/csharp-repl'
  }
});