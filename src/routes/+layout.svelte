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
		--background: #ffffff;
		--surface: #f9fafb;
		--border: #e5e7eb;
		--border-strong: #d1d5db;
		--text: #111827;
		--text-muted: #6b7280;
		--text-faint: #9ca3af;
		--accent: #1d4ed8;
		--accent-hover: #1e40af;

		--adopted-unanimity-bg: #dcfce7;
		--adopted-unanimity-text: #14532d;
		--adopted-majority-bg: #d1fae5;
		--adopted-majority-text: #065f46;
		--rejected-majority-bg: #fff7ed;
		--rejected-majority-text: #7c2d12;
		--rejected-veto-bg: #fee2e2;
		--rejected-veto-text: #7f1d1d;
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
