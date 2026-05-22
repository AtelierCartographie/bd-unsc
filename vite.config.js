import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		assetsInlineLimit: 1024 * 1024 // inline all assets up to 1 MB as base64
	}
});
