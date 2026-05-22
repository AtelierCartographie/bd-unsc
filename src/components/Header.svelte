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
		display: flex;
		align-items: center;
		gap: 2rem;
	}

	.logo {
		display: flex;
		align-items: center;
		color: var(--text);
		flex-shrink: 0;
		opacity: 0.7;
		transition: opacity 0.15s;
	}

	.logo:hover {
		opacity: 1;
		text-decoration: none;
	}

	h1 {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text);
		letter-spacing: -0.01em;
	}

	@media (max-width: 640px) {
		h1 {
			font-size: 0.875rem;
		}
		.header-inner {
			padding: 0 1rem;
			gap: 1rem;
		}
	}
</style>
