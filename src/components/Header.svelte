<script>
	import logo_svg from '$lib/assets/logo-atelier-red.svg?raw';
</script>

<header>
	<div class="header-inner">
		<a
			href="https://www.sciencespo.fr/cartographie/"
			class="logo"
			target="_blank"
			rel="noopener noreferrer"
			title="Atelier de cartographie de Sciences Po"
		>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted SVG asset imported at build time -->
			{@html logo_svg}
		</a>
		<h1>UN Security Council votes since 1946</h1>
	</div>
</header>

<style>
	header {
		position: sticky;
		top: 0;
		z-index: 50;
		background: var(--background);
		border-bottom: 1px solid var(--border);
	}

	.header-inner {
		max-width: 1400px;
		margin: 0 auto;
		padding: 0 2rem;
		height: 3.5rem;
		/* logo left, title centred across the full header width (the empty third
		   column balances the logo). */
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1rem;
	}

	.logo {
		grid-column: 1;
		justify-self: start;
		display: flex;
		align-items: center;
		color: var(--text);
		flex-shrink: 0;
	}

	h1 {
		grid-column: 2;
		text-align: center;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text);
		letter-spacing: -0.01em;
	}

	@media (max-width: 640px) {
		/* Back to a simple left-aligned flow: centring a long title next to the
		   logo is too cramped on narrow screens. */
		.header-inner {
			display: flex;
			align-items: center;
			gap: 1rem;
			padding: 0 1rem;
		}

		.logo {
			flex-shrink: 0;
		}

		h1 {
			text-align: left;
			font-size: 0.875rem;
		}
	}
</style>
