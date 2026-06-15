import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// For the offline single-file build (INLINE=1), inline every asset — including
// the woff2 fonts referenced by CSS url() — as base64 data URIs so nothing is
// fetched from disk. The default build keeps Vite's normal 4 KB threshold.
const inline = !!process.env.INLINE;

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		// Honour the PORT env var when set (e.g. by the preview harness),
		// otherwise fall back to Vite's default.
		port: process.env.PORT ? Number(process.env.PORT) : undefined
	},
	...(inline && { build: { assetsInlineLimit: 100_000_000 } })
});
