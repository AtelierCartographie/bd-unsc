<script>
	import Header from '../components/Header.svelte';
	import Footer from '../components/Footer.svelte';
	import BrowseTab from '../components/BrowseTab.svelte';
	import TrendsTab from '../components/TrendsTab.svelte';

	let { data } = $props();

	let activeTab = $state('browse');
</script>

<Header />

<main>
	<div class="tabs-bar">
		<div class="tabs-inner">
			<button
				class="tab"
				class:active={activeTab === 'browse'}
				onclick={() => (activeTab = 'browse')}
			>
				Browse the database
			</button>
			<button
				class="tab"
				class:active={activeTab === 'trends'}
				onclick={() => (activeTab = 'trends')}
			>
				View trends in resolutions
			</button>
			<button
				class="tab"
				class:active={activeTab === 'compare'}
				onclick={() => (activeTab = 'compare')}
			>
				Compare States' votes
			</button>
		</div>
	</div>

	<div class="content">
		{#if activeTab === 'browse'}
			<BrowseTab votes={data.votes ?? []} />
		{:else if activeTab === 'trends'}
			<TrendsTab votes={data.votes ?? []} />
		{:else}
			<div class="placeholder">
				<p class="placeholder-icon">🗳️</p>
				<h2>Compare States' votes</h2>
				<p>Per-country vote breakdowns — coming soon.</p>
			</div>
		{/if}
	</div>
</main>

<Footer />

<style>
	main {
		flex: 1;
	}

	.tabs-bar {
		background: var(--background);
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 3.5rem;
		z-index: 40;
	}

	.tabs-inner {
		max-width: 1400px;
		margin: 0 auto;
		padding: 0 2rem;
		display: flex;
	}

	.tab {
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		padding: 0.875rem 1.25rem;
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--text-muted);
		transition: color 0.15s, border-color 0.15s;
		margin-bottom: -1px;
	}

	.tab:hover {
		color: var(--text);
	}

	.tab.active {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}

	.content {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem;
	}

	.placeholder {
		padding: 5rem 2rem;
		text-align: center;
		color: var(--text-muted);
	}

	.placeholder-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.placeholder h2 {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 0.5rem;
	}

	.placeholder p {
		font-size: 0.95rem;
	}

	@media (max-width: 768px) {
		.tabs-inner {
			padding: 0 1rem;
			overflow-x: auto;
		}

		.tab {
			padding: 0.75rem 1rem;
			font-size: 0.85rem;
			white-space: nowrap;
		}

		.content {
			padding: 1.25rem 1rem;
		}
	}
</style>
