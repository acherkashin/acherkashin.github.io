export interface PlaygroundItem {
	slug: string;
	title: string;
	description: string;
	cover?: string | null;
}

export const playgrounds: PlaygroundItem[] = [
	{
		slug: 'size-adjust-playground',
		title: 'CSS size-adjust Playground',
		description: 'Interactive playground for @font-face size-adjust with Inter and Nunito',
		cover: null
	},
	{
		slug: 'max-height-demo',
		title: 'Browser Height Limit Test',
		description: 'Interactive of Browser Height Limit Test',
		cover: null
	},
	{
		slug: 'stories-scroll-demo',
		title: 'Telegram Stories Demo',
		description: 'Interactive demo of Telegram-style stories with scroll animations',
		cover: null
	},
	{
		slug: 'css-features-demo-2025',
		title: 'CSS Next Demo with Theme Switch',
		description: 'Demo with modern CSS features and interactive theme switching',
		cover: null
	}
];
