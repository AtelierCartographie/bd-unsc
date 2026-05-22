<script>
	import { untrack } from 'svelte';
	import RangeSlider from './RangeSlider.svelte';

	/**
	 * @typedef {{ id: number, ref: string, resNum: string, date: string, year: number,
	 *   title: string, outcome: string, yes: number, no: number,
	 *   abstentions: number, nonVoting: number, veto: number,
	 *   countries: Record<string, string> }} Vote
	 */

	/** @type {{ votes: Vote[] }} */
	let { votes } = $props();

	const P5 = ['CHINA', 'FRANCE', 'RUSSIAN FEDERATION/USSR', 'UNITED KINGDOM', 'UNITED STATES'];

	// Month 0 = Jan 1946, month 959 = Dec 2025
	let fromMonth = $state(0);
	let toMonth = $state(959);

	/** @param {number} n */
	function monthToYM(n) {
		const year = 1946 + Math.floor(n / 12);
		const month = String((n % 12) + 1).padStart(2, '0');
		return `${year}-${month}`;
	}

	const fromDateStr = $derived(monthToYM(fromMonth));
	const toDateStr = $derived(monthToYM(toMonth));

	// Countries that have a vote entry in the selected period
	const availableCountries = $derived.by(() => {
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
	// because it is also mutated directly by user interactions (toggleCountry, etc.).
	$effect(() => {
		const avail = availableCountries;
		const current = untrack(() => selectedCountries);
		const valid = new Set([...current].filter((c) => avail.has(c)));
		if (valid.size !== current.size) selectedCountries = valid;
	});

	let countryDropdownOpen = $state(false);
	let countrySearch = $state('');
	/** @type {HTMLElement | null} */
	let dropdownEl = $state(null);

	// Close dropdown on outside click.
	// Intentional side-effect: DOM event listener that mutates countryDropdownOpen.
	$effect(() => {
		if (!countryDropdownOpen) return;
		/** @param {MouseEvent} e */
		function onDown(e) {
			if (dropdownEl && !dropdownEl.contains(/** @type {Node} */ (e.target))) {
				countryDropdownOpen = false;
			}
		}
		document.addEventListener('mousedown', onDown);
		return () => document.removeEventListener('mousedown', onDown);
	});

	const dropdownCountries = $derived.by(() => {
		const q = countrySearch.trim().toLowerCase();
		const avail = [...availableCountries].filter((c) =>
			q ? formatCountryName(c).toLowerCase().includes(q) : true
		);
		const p5Here = P5.filter((c) => avail.includes(c));
		const others = avail.filter((c) => !P5.includes(c)).sort();
		return { p5: p5Here, others };
	});

	/** @param {string} name */
	function formatCountryName(name) {
		// Capitalise first letter after start-of-string, whitespace, slash, open-paren or hyphen
		return name.toLowerCase().replace(/(?:^|[\s/(\-])(\w)/g, (match, c) => {
			return match.slice(0, -1) + c.toUpperCase();
		});
	}

	/** @param {string} name */
	function toggleCountry(name) {
		const next = new Set(selectedCountries);
		if (next.has(name)) {
			next.delete(name);
		} else {
			next.add(name);
		}
		selectedCountries = next;
	}

	function selectAllAvailable() {
		selectedCountries = new Set(availableCountries);
	}

	function clearCountries() {
		selectedCountries = new Set();
	}

	let search = $state('');
	let outcomeFilter = $state('all');

	let showCountryCols = $state(false);
	let page = $state(1);
	let perPage = $state(50);
	let sortBy = $state('date');
	let sortDir = $state('desc');

	const OUTCOMES = [
		{ value: 'all', label: 'All outcomes' },
		{ value: 'adopted (unanimity)', label: 'Adopted (unanimity)' },
		{ value: 'adopted (majority)', label: 'Adopted (majority)' },
		{ value: 'not adopted (lack of majority)', label: 'Not adopted (no majority)' },
		{ value: 'not adopted (veto)', label: 'Not adopted (veto)' }
	];

	const OUTCOME_META = {
		'adopted (unanimity)': { cls: 'badge-adopted-unanimity', short: 'Adopted' },
		'adopted (majority)': { cls: 'badge-adopted-majority', short: 'Adopted (maj.)' },
		'not adopted (lack of majority)': { cls: 'badge-rejected-majority', short: 'Not adopted' },
		'not adopted (veto)': { cls: 'badge-rejected-veto', short: 'Vetoed' }
	};

	const VOTE_CODE_META = {
		Y: { cls: 'vc-y', label: 'Yes' },
		N: { cls: 'vc-n', label: 'No' },
		A: { cls: 'vc-a', label: 'Abstention' },
		NV: { cls: 'vc-nv', label: 'Non-voting' },
		'?': { cls: 'vc-unknown', label: 'Unknown' }
	};

	const filtered = $derived(
		votes.filter((v) => {
			const ym = v.date.slice(0, 7);
			if (ym < fromDateStr || ym > toDateStr) return false;
			const q = search.trim().toLowerCase();
			if (
				q &&
				!v.title.toLowerCase().includes(q) &&
				!v.ref.toLowerCase().includes(q)
			)
				return false;
			if (outcomeFilter !== 'all' && v.outcome !== outcomeFilter) return false;
			if (selectedCountries.size > 0) {
				const hasOne = [...selectedCountries].some((c) => c in v.countries);
				if (!hasOne) return false;
			}
			return true;
		})
	);

	const sorted = $derived(
		[...filtered].sort((a, b) => {
			const d = sortDir === 'asc' ? 1 : -1;
			if (sortBy === 'date') return d * (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
			if (sortBy === 'ref') return d * a.ref.localeCompare(b.ref);
			return 0;
		})
	);

	const totalPages = $derived(Math.max(1, Math.ceil(sorted.length / perPage)));
	const safePage = $derived(Math.min(page, totalPages));
	const paginated = $derived(sorted.slice((safePage - 1) * perPage, safePage * perPage));

	// Country columns to display when showCountryCols is true
	const activeCountryCols = $derived.by(() => {
		if (!showCountryCols) return /** @type {string[]} */ ([]);
		const seen = new Set();
		for (const v of filtered) {
			for (const c of Object.keys(v.countries)) seen.add(c);
		}
		const p5here = P5.filter((c) => seen.has(c));
		const others = [...seen].filter((c) => !P5.includes(c)).sort();
		return [...p5here, ...others];
	});

	// Reset page when any filter/sort changes.
	// Intentional side-effect: page cannot be $derived because it is also mutated
	// directly by pagination button clicks.
	$effect(() => {
		const _dep = `${fromMonth}|${toMonth}|${[...selectedCountries].join(',')}|${search}|${outcomeFilter}|${perPage}|${sortBy}|${sortDir}`;
		void _dep;
		page = 1;
	});

	/** @param {string} col */
	function toggleSort(col) {
		if (sortBy === col) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortBy = col;
			sortDir = 'desc';
		}
	}

	/** @param {string} col */
	function sortIcon(col) {
		if (sortBy !== col) return '↕';
		return sortDir === 'asc' ? '↑' : '↓';
	}

	/** @param {string} ref */
	function docUrl(ref) {
		if (ref && ref.startsWith('S/')) return `https://undocs.org/${encodeURIComponent(ref)}`;
		return null;
	}

	/** @param {string} dateStr */
	function formatDate(dateStr) {
		if (!dateStr) return '—';
		const d = new Date(dateStr + 'T00:00:00Z');
		return d.toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			timeZone: 'UTC'
		});
	}

	function resetFilters() {
		fromMonth = 0;
		toMonth = 959;
		selectedCountries = new Set();
		search = '';
		outcomeFilter = 'all';
	}

	const hasActiveFilters = $derived(
		fromMonth !== 0 ||
			toMonth !== 959 ||
			selectedCountries.size > 0 ||
			search !== '' ||
			outcomeFilter !== 'all'
	);

	/** @param {string} outcome */
	function getOutcomeMeta(outcome) {
		return OUTCOME_META[/** @type {keyof typeof OUTCOME_META} */ (outcome)] ?? null;
	}

	/** @param {string} vcode */
	function getVoteCodeMeta(vcode) {
		return VOTE_CODE_META[/** @type {keyof typeof VOTE_CODE_META} */ (vcode)] ?? null;
	}
</script>

<div class="browse">
	<div class="browse-intro">
		<p>
			Explore all <strong>{votes.length.toLocaleString('en')}</strong> votes cast in the UN Security
			Council since 1946. Filter by period, country, subject, or outcome — and follow links to the
			official UN documentation.
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
			<div class="filter-label">Country</div>
			<div class="country-filter" bind:this={dropdownEl}>
				<button
					class="country-trigger"
					class:has-selection={selectedCountries.size > 0}
					onclick={() => (countryDropdownOpen = !countryDropdownOpen)}
					aria-expanded={countryDropdownOpen}
					aria-haspopup="listbox"
				>
					{selectedCountries.size === 0
						? 'All countries'
						: `${selectedCountries.size} selected`}
					<span class="chevron" class:open={countryDropdownOpen}>&#x25BE;</span>
				</button>

				{#if countryDropdownOpen}
					<div class="country-dropdown" role="dialog" aria-label="Select countries">
						<div class="dropdown-search">
							<input
								type="search"
								placeholder="Search countries…"
								bind:value={countrySearch}
								autocomplete="off"
							/>
						</div>
						<div class="dropdown-actions">
							<button onclick={selectAllAvailable}>Select all</button>
							<button onclick={clearCountries}>Clear</button>
						</div>
						<div class="country-list" role="listbox" aria-multiselectable="true">
							{#if dropdownCountries.p5.length > 0}
								<div class="group-label">Permanent members (P5)</div>
								{#each dropdownCountries.p5 as country (country)}
									<label class="country-item p5-item">
										<input
											type="checkbox"
											checked={selectedCountries.has(country)}
											onchange={() => toggleCountry(country)}
										/>
										<span class="p5-dot" title="Permanent member"></span>
										{formatCountryName(country)}
									</label>
								{/each}
							{/if}
							{#if dropdownCountries.others.length > 0}
								<div class="group-label">Elected members</div>
								{#each dropdownCountries.others as country (country)}
									<label class="country-item">
										<input
											type="checkbox"
											checked={selectedCountries.has(country)}
											onchange={() => toggleCountry(country)}
										/>
										{formatCountryName(country)}
									</label>
								{/each}
							{/if}
							{#if dropdownCountries.p5.length === 0 && dropdownCountries.others.length === 0}
								<div class="no-results">No countries found</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- 3. Subject search -->
		<div class="filter-group filter-search">
			<label for="search" class="filter-label">Subject</label>
			<input
				id="search"
				type="search"
				placeholder="Search by title or document reference…"
				bind:value={search}
			/>
		</div>

		<!-- 4. Outcome -->
		<div class="filter-group filter-outcome">
			<label for="outcome" class="filter-label">Status</label>
			<select id="outcome" bind:value={outcomeFilter}>
				{#each OUTCOMES as o (o.value)}
					<option value={o.value}>{o.label}</option>
				{/each}
			</select>
		</div>

		{#if hasActiveFilters}
			<button class="btn-reset" onclick={resetFilters}>Clear all</button>
		{/if}
	</div>

	<!-- Table meta -->
	<div class="table-meta">
		<span class="results-count">
			{#if filtered.length === votes.length}
				{votes.length.toLocaleString('en')} votes
			{:else}
				<strong>{filtered.length.toLocaleString('en')}</strong> of {votes.length.toLocaleString(
					'en'
				)} votes
			{/if}
		</span>
		<div class="table-controls">
			<label class="per-page-label">
				Show
				<select bind:value={perPage}>
					<option value={25}>25</option>
					<option value={50}>50</option>
					<option value={100}>100</option>
				</select>
				per page
			</label>
			<button
				class="btn-toggle-countries"
				class:active={showCountryCols}
				onclick={() => (showCountryCols = !showCountryCols)}
			>
				{showCountryCols ? 'Hide' : 'Show'} country votes
			</button>
		</div>
	</div>

	<!-- Table -->
	<div class="table-wrapper">
		<table>
			<thead>
				<tr>
					<th class="col-ref sortable" onclick={() => toggleSort('ref')}>
						UN Classification {sortIcon('ref')}
					</th>
					<th class="col-outcome">Vote outcome</th>
					<th class="col-date sortable" onclick={() => toggleSort('date')}>
						Date {sortIcon('date')}
					</th>
					<th class="col-title">Title</th>
					{#if showCountryCols}
						{#each activeCountryCols as col (col)}
							<th
								class="col-country"
								class:col-p5={P5.includes(col)}
								title={formatCountryName(col)}
							>
								{#if P5.includes(col)}
									<span class="p5-dot"></span>
								{/if}
								{formatCountryName(col)}
							</th>
						{/each}
					{/if}
				</tr>
			</thead>
			<tbody>
				{#each paginated as vote (vote.id)}
					{@const url = docUrl(vote.ref)}
					{@const outcomeMeta = getOutcomeMeta(vote.outcome)}
					<tr>
						<td class="col-ref">
							{#if url}
								<a href={url} target="_blank" rel="noopener" title={vote.ref}>{vote.ref}</a>
							{:else}
								<span title={vote.ref}>{vote.ref || '—'}</span>
							{/if}
						</td>
						<td class="col-outcome">
							{#if outcomeMeta}
								<span class="badge {outcomeMeta.cls}">{outcomeMeta.short}</span>
							{:else}
								{vote.outcome}
							{/if}
						</td>
						<td class="col-date">{formatDate(vote.date)}</td>
						<td class="col-title">
							<span class="title-text" title={vote.title}>{vote.title}</span>
						</td>
						{#if showCountryCols}
							{#each activeCountryCols as col (col)}
								{@const vcode = vote.countries[col] ?? ''}
								{@const vcMeta = getVoteCodeMeta(vcode)}
								<td
									class="col-country vote-cell"
									class:col-p5={P5.includes(col)}
									class:vote-y={vcode === 'Y'}
									class:vote-n={vcode === 'N'}
									class:vote-a={vcode === 'A'}
									class:vote-nv={vcode === 'NV'}
									title={vcMeta?.label ?? (vcode ? vcode : 'Not a member')}
								>
									{vcode || ''}
								</td>
							{/each}
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Pagination -->
	{#if totalPages > 1}
		<div class="pagination">
			<button
				class="page-btn"
				disabled={safePage === 1}
				onclick={() => (page = 1)}
				aria-label="First page">&laquo;</button
			>
			<button
				class="page-btn"
				disabled={safePage === 1}
				onclick={() => (page = safePage - 1)}
				aria-label="Previous page">&lsaquo;</button
			>
			<span class="page-info">Page {safePage} of {totalPages}</span>
			<button
				class="page-btn"
				disabled={safePage === totalPages}
				onclick={() => (page = safePage + 1)}
				aria-label="Next page">&rsaquo;</button
			>
			<button
				class="page-btn"
				disabled={safePage === totalPages}
				onclick={() => (page = totalPages)}
				aria-label="Last page">&raquo;</button
			>
		</div>
	{/if}
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
		align-items: flex-end;
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

	/* Country dropdown */
	.country-filter {
		position: relative;
	}

	.country-trigger {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border-strong);
		border-radius: 6px;
		background: var(--background);
		color: var(--text);
		font-size: 0.875rem;
		white-space: nowrap;
		transition: border-color 0.15s;
	}

	.country-trigger:hover,
	.country-trigger[aria-expanded='true'] {
		border-color: var(--accent);
	}

	.country-trigger.has-selection {
		border-color: var(--accent);
		color: var(--accent);
	}

	.chevron {
		font-size: 0.75rem;
		transition: transform 0.15s;
	}

	.chevron.open {
		transform: rotate(180deg);
	}

	.country-dropdown {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		z-index: 100;
		min-width: 240px;
		max-width: 320px;
		background: var(--background);
		border: 1px solid var(--border-strong);
		border-radius: 8px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
		overflow: hidden;
	}

	.dropdown-search {
		padding: 0.75rem;
		border-bottom: 1px solid var(--border);
	}

	.dropdown-search input {
		width: 100%;
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--border-strong);
		border-radius: 5px;
		background: var(--surface);
		font-size: 0.8rem;
		outline: none;
	}

	.dropdown-search input:focus {
		border-color: var(--accent);
	}

	.dropdown-actions {
		display: flex;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--border);
	}

	.dropdown-actions button {
		flex: 1;
		padding: 0.3rem 0.5rem;
		border: 1px solid var(--border-strong);
		border-radius: 4px;
		background: var(--surface);
		font-size: 0.75rem;
		color: var(--text-muted);
		transition: background 0.15s;
	}

	.dropdown-actions button:hover {
		background: var(--border);
		color: var(--text);
	}

	.country-list {
		max-height: 240px;
		overflow-y: auto;
		padding: 0.5rem 0;
	}

	.group-label {
		padding: 0.4rem 0.75rem 0.2rem;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-faint);
	}

	.country-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.75rem;
		font-size: 0.8rem;
		cursor: pointer;
		transition: background 0.1s;
	}

	.country-item:hover {
		background: var(--surface);
	}

	.country-item input[type='checkbox'] {
		flex-shrink: 0;
		accent-color: var(--accent);
	}

	.no-results {
		padding: 1rem 0.75rem;
		font-size: 0.8rem;
		color: var(--text-faint);
		text-align: center;
	}

	/* P5 indicator */
	.p5-dot {
		display: inline-block;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #b45309;
		flex-shrink: 0;
	}

	.btn-reset {
		align-self: flex-end;
		padding: 0.5rem 0.875rem;
		border: 1px solid var(--border-strong);
		border-radius: 6px;
		background: var(--background);
		color: var(--text-muted);
		font-size: 0.875rem;
		transition: background 0.15s, color 0.15s;
	}

	.btn-reset:hover {
		background: var(--border);
		color: var(--text);
	}

	/* ── Table meta ── */
	.table-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
		font-size: 0.875rem;
		color: var(--text-muted);
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.table-controls {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.per-page-label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.875rem;
	}

	.per-page-label select {
		padding: 0.2rem 0.4rem;
		border: 1px solid var(--border-strong);
		border-radius: 4px;
		background: var(--background);
		font-size: 0.875rem;
	}

	.btn-toggle-countries {
		padding: 0.35rem 0.75rem;
		border: 1px solid var(--border-strong);
		border-radius: 6px;
		background: var(--background);
		color: var(--text-muted);
		font-size: 0.8rem;
		transition: all 0.15s;
	}

	.btn-toggle-countries:hover {
		background: var(--surface);
		color: var(--text);
	}

	.btn-toggle-countries.active {
		background: var(--accent);
		border-color: var(--accent);
		color: white;
	}

	/* ── Table ── */
	.table-wrapper {
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	thead {
		background: var(--surface);
		border-bottom: 1px solid var(--border);
	}

	th {
		padding: 0.75rem 0.875rem;
		text-align: left;
		font-weight: 600;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
		white-space: nowrap;
	}

	th.sortable {
		cursor: pointer;
		user-select: none;
	}

	th.sortable:hover {
		color: var(--text);
		background: var(--border);
	}

	th.col-p5 {
		background: #fef3c7;
		color: #92400e;
		border-left: 2px solid #d97706;
	}

	td {
		padding: 0.625rem 0.875rem;
		border-bottom: 1px solid var(--border);
		vertical-align: middle;
	}

	tbody tr:last-child td {
		border-bottom: none;
	}

	tbody tr:hover {
		background: var(--surface);
	}

	.col-ref {
		white-space: nowrap;
		width: 12rem;
	}

	.col-date {
		white-space: nowrap;
		width: 7.5rem;
		color: var(--text-muted);
	}

	.col-title {
		min-width: 0;
	}

	.title-text {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-height: 1.45;
	}

	.col-outcome {
		white-space: nowrap;
		width: 9rem;
	}

	.col-num {
		width: 2.5rem;
		text-align: center;
	}

	.num {
		font-variant-numeric: tabular-nums;
		color: var(--text-muted);
	}

	/* Country columns */
	.col-country {
		width: 2.5rem;
		text-align: center;
		font-size: 0.75rem;
		font-weight: 600;
		white-space: nowrap;
		padding: 0.5rem 0.4rem;
	}

	.col-p5 {
		background: #fffbeb;
		border-left: 2px solid #fcd34d;
	}

	/* Vote cell colors */
	.vote-y {
		color: #15803d;
		background: #f0fdf4;
	}
	.vote-n {
		color: #b91c1c;
		background: #fef2f2;
	}
	.vote-a {
		color: #c2410c;
		background: #fff7ed;
	}
	.vote-nv {
		color: var(--text-faint);
	}

	/* Badges */
	.badge {
		display: inline-block;
		padding: 0.2em 0.55em;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.badge-adopted-unanimity {
		background: var(--adopted-unanimity-bg);
		color: var(--adopted-unanimity-text);
	}
	.badge-adopted-majority {
		background: var(--adopted-majority-bg);
		color: var(--adopted-majority-text);
	}
	.badge-rejected-majority {
		background: var(--rejected-majority-bg);
		color: var(--rejected-majority-text);
	}
	.badge-rejected-veto {
		background: var(--rejected-veto-bg);
		color: var(--rejected-veto-text);
	}

	/* Pagination */
	.pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 1.5rem;
	}

	.page-btn {
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--border-strong);
		border-radius: 6px;
		background: var(--background);
		color: var(--text);
		font-size: 1rem;
		transition: background 0.15s;
	}

	.page-btn:hover:not(:disabled) {
		background: var(--surface);
	}

	.page-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.page-info {
		font-size: 0.875rem;
		color: var(--text-muted);
		padding: 0 0.5rem;
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
