<script>
	import Header from '../components/Header.svelte';
	import Footer from '../components/Footer.svelte';
	import BrowseTab from '../components/BrowseTab.svelte';
	import TrendsTab from '../components/TrendsTab.svelte';
	import CompareTab from '../components/CompareTab.svelte';

	let { data } = $props();

	let activeTab = $state('browse');

	const unDigitalLibraryUrl =
		'https://digitallibrary.un.org/search?ln=en&cc=Security%20Council&p=&f=&rm=&ln=en&sf=&so=d&rg=100&c=Security%20Council&c=&of=hb&fti=0&fct__1=Voting%20Data&fct__2=Security%20Council&fti=0';

	const ccByUrl = 'https://creativecommons.org/licenses/by/4.0/';

	const citation = `"UNSC votes since 1946 Database", MARTIN, Benoît, 2026, data.sciencespo, V1. Atelier de cartographie de Sciences Po/Groupe de recherche sur l'action multilatérale (GRAM).`;
</script>

<Header />

<main>
	<section class="intro" aria-labelledby="about-project-title">
		<h2 id="about-project-title" class="sr-only">About this database</h2>

		<p class="intro-lead">
			The "UN Security Council Votes Since 1946" database records the individual votes of all states
			that have served on the United Nations Security Council (UNSC) since its establishment in
			1946. This unique resource compiles three types of voting results — resolutions adopted, those
			not adopted due to lack of a majority, and those vetoed — resulting from the votes of member
			States.
		</p>

		<p class="intro-note">
			It is updated at the beginning of each year. This resource is part of the work of the Groupe
			de recherche sur l'action multilatérale (GRAM, GDR CNRS). The data exploration and
			visualization interface was designed by the Atelier de cartographie de Sciences Po.
		</p>
		<p class="intro-note">
			A beta version of the database was used in a presentation by Mélanie Albaret (Université de
			Clermont-Auvergne) and Benoît Martin (Sciences Po Paris) titled "Has the UNSC reached a fatal
			deadlock since the war in Ukraine? A socio-historical perspective" at the Marc Bloch Center
			(Berlin) in December 2024.
		</p>

		<div class="intro-meta">
			<section class="meta-block" aria-labelledby="primary-sources-title">
				<h3 id="primary-sources-title" class="meta-label">Primary sources</h3>
				<ul class="meta-links">
					<li>
						<a href={unDigitalLibraryUrl} target="_blank" rel="noopener noreferrer">
							United Nations Digital Library, Voting Data
						</a>
					</li>
					<li>
						<a
							href="https://research.un.org/en/docs/sc/quick/meetings"
							target="_blank"
							rel="noopener noreferrer"
						>
							UN Dag Hammarskjöld Library, Meetings &amp; Outcomes Tables
						</a>
					</li>
					<li>
						<a
							href="https://psdata.un.org/dataset/DPPA-SCVETOES"
							target="_blank"
							rel="noopener noreferrer"
						>
							Peace Security Data Hub, DPPA-SCVETOES
						</a>
					</li>
				</ul>
			</section>

			<section class="meta-block meta-reuse" aria-labelledby="how-to-cite-title">
				<h3 id="how-to-cite-title" class="meta-label">How to cite</h3>
				<div class="citation">
					<p class="citation-text">{citation}</p>
				</div>
				<p class="license">
					<a class="cc-badge" href={ccByUrl} target="_blank" rel="noopener noreferrer">CC BY 4.0</a>
					Free to share and adapt, with attribution.
				</p>
			</section>
		</div>
	</section>

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
			<CompareTab votes={data.votes ?? []} />
		{/if}
	</div>
</main>

<Footer />

<style>
	main {
		flex: 1;
	}

	.intro {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2.25rem 2rem 2rem;
		/* Two equal columns: lead and meta span both; the two notes sit one per column. */
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.25rem 2.5rem;
		align-items: start;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.intro-lead {
		grid-column: 1 / -1;
		font-size: 1.15rem;
		line-height: 1.6;
		color: var(--text);
		letter-spacing: -0.005em;
	}

	.intro-note {
		font-size: 0.9rem;
		line-height: 1.6;
		color: var(--text-muted);
	}

	.intro-meta {
		grid-column: 1 / -1;
		margin-top: 0.5rem;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem 2.5rem;
		padding: 1.4rem 1.6rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
	}

	.meta-label {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		margin-bottom: 0.7rem;
	}

	.meta-links {
		list-style: none;
		display: grid;
		gap: 0.55rem;
	}

	.meta-links a {
		font-size: 0.875rem;
		line-height: 1.4;
	}

	.meta-links a::after {
		content: ' ↗';
		color: var(--text-faint);
	}

	.meta-reuse {
		display: grid;
		align-content: start;
	}

	.citation {
		background: var(--background);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 0.85rem 0.95rem;
	}

	.citation-text {
		font-size: 0.85rem;
		line-height: 1.55;
		color: var(--text);
	}

	.license {
		font-size: 0.82rem;
		line-height: 1.55;
		color: var(--text-muted);
		margin-top: 0.5rem;
	}

	.cc-badge {
		display: inline-block;
		margin-right: 0.35rem;
		padding: 0.1rem 0.4rem;
		border: 1px solid var(--border-strong);
		border-radius: 4px;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		color: var(--text);
		white-space: nowrap;
		vertical-align: baseline;
	}

	.cc-badge:hover {
		border-color: var(--accent);
		color: var(--accent);
		text-decoration: none;
	}

	.tabs-bar {
		background: var(--background);
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: var(--header-height);
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
		transition:
			color 0.15s,
			border-color 0.15s;
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

	@media (max-width: 768px) {
		.intro {
			padding: 1.5rem 1rem 1.25rem;
			grid-template-columns: 1fr;
		}

		.intro-lead {
			font-size: 1.05rem;
		}

		.intro-meta {
			grid-template-columns: 1fr;
			padding: 1.1rem 1.1rem;
		}

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
