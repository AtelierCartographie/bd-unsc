import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		// Honour the PORT env var when set (e.g. by the preview harness),
		// otherwise fall back to Vite's default.
		port: process.env.PORT ? Number(process.env.PORT) : undefined
	}
});
