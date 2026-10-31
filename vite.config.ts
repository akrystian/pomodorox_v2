import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the repo at /<repo-name>/.
const base = '/pomodorox_v2/';

export default defineConfig({
	base,
	plugins: [
		preact(),
		VitePWA({
			registerType: 'prompt',
			includeAssets: [
				'favicon.svg',
				'favicon.ico',
				'apple-touch-icon-180x180.png',
				'session-end.wav',
			],
			manifest: {
				name: 'Pomodorox',
				short_name: 'Pomodorox',
				description: 'Timer Pomodoro z listą zadań i dziennikiem zdarzeń',
				lang: 'pl',
				display: 'standalone',
				theme_color: '#c2410c',
				background_color: '#fafaf9',
				icons: [
					{ src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
					{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
					{ src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
					{ src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
				],
			},
		}),
	],
	test: {
		include: ['src/**/*.test.ts'],
	},
});
