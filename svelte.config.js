import adapter from '@sveltejs/adapter-static';

// Offline single-file build: `INLINE=1 vite build` bundles every asset (JS, CSS,
// data and fonts) into one self-contained build-offline/index.html that runs
// from file:// with no server. Left unset (the default, and what CI uses via
// BASE_PATH), the build is the standard multi-file static site for GitHub Pages.
const inline = !!process.env.INLINE;

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({
			pages: inline ? 'build-offline' : 'build',
			assets: inline ? 'build-offline' : 'build',
			fallback: 'index.html',
			// Inline <link> stylesheets straight into the HTML for the offline build.
			...(inline && { inlineStylesheets: 'always' })
		}),
		// Collapse the whole app into a single inline <script> for the offline build.
		...(inline && { output: { bundleStrategy: 'inline' } }),
		// Offline: relative URLs so it works from file://. Online: GitHub Pages base path.
		paths: inline ? { relative: true } : { base: process.env.BASE_PATH ?? '' },
		version: {
			pollInterval: 0
		}
	}
};

export default config;
