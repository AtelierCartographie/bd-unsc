<script>
	import { untrack } from 'svelte';
	import RangeSlider from './RangeSlider.svelte';
	import CountryMultiSelect from './CountryMultiSelect.svelte';
	import VotesTable from './VotesTable.svelte';
	import { MONTH_MIN, MONTH_MAX, monthToYM } from '$lib/time.js';
	import { OUTCOME_FILTER_OPTIONS } from '$lib/outcomes.js';

	/** @typedef {import('$lib/types.js').Vote} Vote */

	/** @type {{ votes: Vote[] }} */
	let { votes } = $props();

	// Month 0 = Jan 1946, month 959 = Dec 2025
	let fromMonth = $state(MONTH_MIN);
	let toMonth = $state(MONTH_MAX);

	const fromDateStr = $derived(monthToYM(fromMonth));
	const toDateStr = $derived(monthToYM(toMonth));

	// Countries that have a vote entry in the selected period
	const availableCountries = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local set, rebuilt each derivation
		const seen = new Set();
		for (const v of votes) {
			const ym = v.date.slice(0, 7);
			if (ym >= fromDateStr && ym <= toDateStr) {
				for (const c of Object.keys(v.countries)) seen.add(c);
			}
		}
		return seen;
	});

	let selectedCountries = $state(/** @type {Set<string>} */ (new Set()));

	// When the date range changes, remove selected countries no longer in scope.
	// This is an intentional side-effect: selectedCountries cannot be a $derived
	// because it is also mutated directly by the country multi-select.
	$effect(() => {
		const avail = availableCountries;
		const current = untrack(() => selectedCountries);
		const valid = new Set([...current].filter((c) => avail.has(c)));
		if (valid.size !== current.size) selectedCountries = valid;
	});

	let search = $state('');
	let outcomeFilter = $state('all');

	const filtered = $derived(
		votes.filter((v) => {
			const ym = v.date.slice(0, 7);
			if (ym < fromDateStr || ym > toDateStr) return false;
			const q = search.trim().toLowerCase();
			if (q && !v.title.toLowerCase().includes(q)) return false;
			if (outcomeFilter !== 'all' && v.outcome !== outcomeFilter) return false;
			if (selectedCountries.size > 0) {
				const hasOne = [...selectedCountries].some((c) => c in v.countries);
				if (!hasOne) return false;
			}
			return true;
		})
	);

	function resetFilters() {
		fromMonth = MONTH_MIN;
		toMonth = MONTH_MAX;
		selectedCountries = new Set();
		search = '';
		outcomeFilter = 'all';
	}

	const hasActiveFilters = $derived(
		fromMonth !== MONTH_MIN ||
			toMonth !== MONTH_MAX ||
			selectedCountries.size > 0 ||
			search !== '' ||
			outcomeFilter !== 'all'
	);
</script>

<div class="browse">
	<div class="browse-intro">
		<p>
			Explore all <strong>{votes.length.toLocaleString('en')}</strong> votes cast in the UN Security
			Council since 1946.
			<br />
			Filter by period, country, subject, or outcome — and follow links to the official UN documentation.
		</p>
	</div>

	<!-- Filters -->
	<div class="filters">
		<!-- 1. Period (date range slider) -->
		<div class="filter-group filter-period">
			<div class="filter-label">Period</div>
			<RangeSlider bind:from={fromMonth} bind:to={toMonth} />
		</div>

		<!-- 2. Country -->
		<div class="filter-group">
			<div class="filter-label">Voting Country</div>
			<CountryMultiSelect available={availableCountries} bind:selected={selectedCountries} />
		</div>

		<!-- 3. Subject search -->
		<div class="filter-group filter-search">
			<label for="search" class="filter-label">Topic</label>
			<input id="search" type="search" placeholder="Search by title…" bind:value={search} />
		</div>

		<!-- 4. Outcome -->
		<div class="filter-group filter-outcome">
			<label for="outcome" class="filter-label">Outcome</label>
			<select id="outcome" bind:value={outcomeFilter}>
				{#each OUTCOME_FILTER_OPTIONS as o (o.value)}
					<option value={o.value}>{o.label}</option>
				{/each}
			</select>
		</div>

		{#if hasActiveFilters}
			<button class="btn-reset" onclick={resetFilters}>Clear all</button>
		{/if}
	</div>

	<VotesTable rows={filtered} totalCount={votes.length} />
</div>

<style>
	.browse-intro {
		margin-bottom: 1.5rem;
	}
	.browse-intro p {
		font-size: 0.95rem;
		color: var(--text-muted);
		max-width: 70ch;
		line-height: 1.6;
	}

	/* ── Filters ── */
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: flex-start;
		padding: 1.25rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		margin-bottom: 1.25rem;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.filter-period {
		flex: 1;
		min-width: 260px;
	}

	.filter-search {
		flex: 1;
		min-width: 200px;
	}

	.filter-label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}

	.filter-search input,
	.filter-outcome select {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border-strong);
		border-radius: 6px;
		background: var(--background);
		color: var(--text);
		outline: none;
		transition: border-color 0.15s;
		font-family: inherit;
		font-size: 0.875rem;
	}

	.filter-search input:focus,
	.filter-outcome select:focus {
		border-color: var(--accent);
	}

	.btn-reset {
		align-self: flex-end;
		padding: 0.5rem 0.875rem;
		border: 1px solid var(--border-strong);
		border-radius: 6px;
		background: var(--background);
		color: var(--text-muted);
		font-size: 0.875rem;
		transition:
			background 0.15s,
			color 0.15s;
	}

	.btn-reset:hover {
		background: var(--border);
		color: var(--text);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.filters {
			padding: 0.875rem;
			gap: 0.75rem;
		}
		.filter-period {
			min-width: 0;
			width: 100%;
		}
		.filter-search {
			min-width: 0;
		}
	}
</style>
