import assert from 'node:assert/strict';
import test from 'node:test';

import { extractTelegramTagsFromMarkdown } from '../src/utils/telegram-tags.util.ts';

test('preserves markdown block boundaries when extracting hashtags', () => {
	const markdown = `---
title: "post"
publishDate: "2024-03-28T07:28:28.000Z"
---

#рекомендую\\_канал

Сегодня решил начать делиться каналами.`;

	const tags = extractTelegramTagsFromMarkdown(markdown);

	assert.deepEqual(tags, ['рекомендую_канал']);
	assert.ok(!tags.includes('рекомендую_каналсегодня'));
});

test('extracts multiple hashtags from a single line', () => {
	const tags = extractTelegramTagsFromMarkdown('#frontend #testing #astro');

	assert.deepEqual(tags, ['frontend', 'testing', 'astro']);
});

test('normalizes hashtags to lowercase and removes duplicates', () => {
	const tags = extractTelegramTagsFromMarkdown('#Frontend #frontend #TESTING');

	assert.deepEqual(tags, ['frontend', 'testing']);
});

test('ignores hashtags from frontmatter fields', () => {
	const markdown = `---
title: "#frontmatter-tag"
description: "Contains #another-one"
---

Основной текст без тегов.`;

	const tags = extractTelegramTagsFromMarkdown(markdown);

	assert.deepEqual(tags, []);
});

test('returns an empty array for empty markdown', () => {
	assert.deepEqual(extractTelegramTagsFromMarkdown(''), []);
});
