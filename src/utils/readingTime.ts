import getReadingTime from 'reading-time';
import { toString } from 'mdast-util-to-string';

export function remarkReadingTime() {
	return function (tree: any, { data }: any) {
		const textOnPage = toString(tree);
		const readingTime = getReadingTime(textOnPage);
		const displayText = Math.ceil(readingTime.minutes) + ' мин';
		data.astro.frontmatter.minutesRead = displayText;
	};
}
