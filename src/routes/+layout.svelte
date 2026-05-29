<script>
	// @ts-ignore — CSS-only side-effect import, no type declarations needed
	import '@fontsource-variable/atkinson-hyperlegible-next';

	let { children } = $props();
</script>

<svelte:head>
	<title>UN Security Council — Votes Database</title>
</svelte:head>

{@render children()}

<style>
	:global(*),
	:global(*::before),
	:global(*::after) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(:root) {
		--header-height: 3.5rem;
		--tabs-height: 2.875rem;

		--background: #ffffff;
		--surface: #f9fafb;
		--border: #e5e7eb;
		--border-strong: #d1d5db;
		--text: #111827;
		--text-muted: #6b7280;
		--text-faint: #9ca3af;
		--accent: #1d4ed8;

		--adopted-unanimity-bg: #6abf89;
		--adopted-unanimity-text: #fff;
		--adopted-majority-bg: #b5cc6a;
		--adopted-majority-text: #2d3a00;
		--rejected-majority-bg: #e89050;
		--rejected-majority-text: #fff;
		--rejected-veto-bg: #d94f3d;
		--rejected-veto-text: #fff;
	}

	:global(html) {
		font-family: 'Atkinson Hyperlegible Next Variable', system-ui, sans-serif;
		font-size: 16px;
		background: var(--background);
		color: var(--text);
		-webkit-font-smoothing: antialiased;
	}

	:global(body) {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	:global(a) {
		color: var(--accent);
		text-decoration: none;
	}

	:global(a:hover) {
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	:global(button) {
		cursor: pointer;
		font-family: inherit;
		font-size: inherit;
	}

	:global(input),
	:global(select) {
		font-family: inherit;
		font-size: inherit;
	}
</style>
