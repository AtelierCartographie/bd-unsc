<script>
	import { P5, formatCountryName } from '$lib/countries.js';
	import { OUTCOME_RANK, OUTCOME_BADGE_CLASS, OUTCOME_LABELS } from '$lib/outcomes.js';

	/** @typedef {import('$lib/types.js').Vote} Vote */

	/** @type {{ rows: Vote[], totalCount: number }} */
	let { rows, totalCount } = $props();

	let showCountryCols = $state(false);
	let page = $state(1);
	let perPage = $state(10);
	let sortBy = $state('date');
	let sortDir = $state('desc');

	const VOTE_CODE_META = {
		Y: { cls: 'vc-y', label: 'Yes' },
		N: { cls: 'vc-n', label: 'No' },
		A: { cls: 'vc-a', label: 'Abstention' },
		NV: { cls: 'vc-nv', label: 'Non-voting' },
		'?': { cls: 'vc-unknown', label: 'Unknown' }
	};

	const sorted = $derived(
		[...rows].sort((a, b) => {
			const d = sortDir === 'asc' ? 1 : -1;
			if (sortBy === 'date') return d * (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
			if (sortBy === 'ref') return d * a.ref.localeCompare(b.ref);
			if (sortBy === 'outcome') {
				const ra = OUTCOME_RANK[a.outcome] ?? 99;
				const rb = OUTCOME_RANK[b.outcome] ?? 99;
				return d * (ra - rb);
			}
			return 0;
		})
	);

	const totalPages = $derived(Math.max(1, Math.ceil(sorted.length / perPage)));
	const safePage = $derived(Math.min(page, totalPages));
	const paginated = $derived(sorted.slice((safePage - 1) * perPage, safePage * perPage));

	// Country columns to display when showCountryCols is true
	const activeCountryCols = $derived.by(() => {
		if (!showCountryCols) return /** @type {string[]} */ ([]);
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local set, rebuilt each derivation
		const seen = new Set();
		for (const v of rows) {
			for (const c of Object.keys(v.countries)) seen.add(c);
		}
		const p5here = P5.filter((c) => seen.has(c));
		const others = [...seen].filter((c) => !P5.includes(c)).sort();
		return [...p5here, ...others];
	});

	// Reset to the first page when the data, sort or page size changes.
	// page cannot be $derived because it is also mutated by pagination clicks.
	$effect(() => {
		void rows;
		void perPage;
		void sortBy;
		void sortDir;
		page = 1;
	});

	/** @type {HTMLDivElement | null} */
	let tableWrapperEl = $state(null);
	let scrollLeft = $state(0);
	let scrollMax = $state(0);

	$effect(() => {
		if (!tableWrapperEl || !showCountryCols) {
			scrollLeft = 0;
			scrollMax = 0;
			return;
		}
		const el = /** @type {HTMLDivElement} */ (tableWrapperEl);
		function update() {
			scrollLeft = el.scrollLeft;
			scrollMax = Math.max(0, el.scrollWidth - el.clientWidth);
		}
		update();
		el.addEventListener('scroll', update, { passive: true });
		const ro = new ResizeObserver(update);
		ro.observe(el);
		return () => {
			el.removeEventListener('scroll', update);
			ro.disconnect();
		};
	});

	const canScrollLeft = $derived(scrollLeft > 1);
	const canScrollRight = $derived(scrollLeft < scrollMax - 1);

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

	/** @param {string} vcode */
	function getVoteCodeMeta(vcode) {
		return VOTE_CODE_META[/** @type {keyof typeof VOTE_CODE_META} */ (vcode)] ?? null;
	}
</script>

<!-- Table meta -->
<div class="table-meta">
	<div class="table-meta-left">
		<span class="results-count">
			{#if rows.length === totalCount}
				{totalCount.toLocaleString('en')} votes
			{:else}
				<strong>{rows.length.toLocaleString('en')}</strong> of {totalCount.toLocaleString('en')} votes
			{/if}
		</span>
		<label class="per-page-label">
			Show
			<select bind:value={perPage}>
				<option value={10}>10</option>
				<option value={25}>25</option>
				<option value={50}>50</option>
				<option value={100}>100</option>
			</select>
			per page
		</label>
	</div>
	<div class="table-controls">
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
<div class="table-outer">
	<div class="table-wrapper" class:scrollable={showCountryCols} bind:this={tableWrapperEl}>
		<table>
			<thead>
				<tr>
					<th class="col-ref">UN classification</th>
					<th class="col-outcome sortable" onclick={() => toggleSort('outcome')}>
						Vote outcome {sortIcon('outcome')}
					</th>
					<th class="col-date sortable" onclick={() => toggleSort('date')}>
						Date {sortIcon('date')}
					</th>
					<th class="col-title">Title</th>
					{#if showCountryCols}
						{#each activeCountryCols as col (col)}
							<th class="col-country" class:col-p5={P5.includes(col)} title={formatCountryName(col)}>
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
					{@const badgeClass = OUTCOME_BADGE_CLASS[vote.outcome]}
					<tr>
						<td class="col-ref">
							{#if url}
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external UN docs link, not SvelteKit navigation -->
								<a href={url} target="_blank" rel="noopener" title={vote.ref}>{vote.ref}</a>
							{:else}
								<span title={vote.ref}>{vote.ref || '—'}</span>
							{/if}
						</td>
						<td class="col-outcome">
							{#if badgeClass}
								<span class="badge {badgeClass}">{OUTCOME_LABELS[vote.outcome]}</span>
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
	{#if showCountryCols}
		<div class="edge-shadow edge-shadow-left" class:visible={canScrollLeft} aria-hidden="true"></div>
		<div
			class="edge-shadow edge-shadow-right"
			class:visible={canScrollRight}
			aria-hidden="true"
		></div>
	{/if}
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

<style>
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

	.table-meta-left {
		display: flex;
		align-items: center;
		gap: 1rem;
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
		border: 1px solid #c5d5f5;
		border-radius: 6px;
		background: #e6edfb;
		color: var(--accent);
		font-size: 0.8rem;
		transition: all 0.15s;
	}

	.btn-toggle-countries:hover {
		background: #d0dff9;
		color: var(--accent);
	}

	.btn-toggle-countries.active {
		background: var(--accent);
		border-color: var(--accent);
		color: white;
	}

	/* ── Table ── */
	.table-outer {
		position: relative;
	}

	.table-wrapper {
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	.edge-shadow {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 28px;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.18s ease;
		z-index: 4;
	}

	.edge-shadow.visible {
		opacity: 1;
	}

	.edge-shadow-left {
		left: 0;
		background: linear-gradient(to right, rgba(0, 0, 0, 0.14), transparent);
		border-radius: 8px 0 0 8px;
	}

	.edge-shadow-right {
		right: 0;
		background: linear-gradient(to left, rgba(0, 0, 0, 0.14), transparent);
		border-radius: 0 8px 8px 0;
	}

	.table-wrapper.scrollable {
		overflow: auto;
		max-height: calc(100vh - var(--header-height) - var(--tabs-height) - 6rem);

		scrollbar-width: thin;
		scrollbar-color: var(--border-strong) var(--surface);
	}

	.table-wrapper.scrollable::-webkit-scrollbar {
		height: 12px;
		width: 12px;
	}
	.table-wrapper.scrollable::-webkit-scrollbar-track {
		background: var(--surface);
	}
	.table-wrapper.scrollable::-webkit-scrollbar-thumb {
		background: var(--border-strong);
		border-radius: 6px;
	}
	.table-wrapper.scrollable::-webkit-scrollbar-thumb:hover {
		background: var(--text-muted);
	}

	.table-wrapper.scrollable thead {
		top: 0;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	thead {
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: calc(var(--header-height) + var(--tabs-height));
		z-index: 1;
	}

	th {
		padding: 0.75rem 0.875rem;
		text-align: left;
		font-weight: 600;
		font-size: 0.75rem;
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

	/* Country columns */
	.col-country {
		width: 2.5rem;
		text-align: center;
		font-size: 0.75rem;
		font-weight: 600;
		white-space: nowrap;
		padding: 0.5rem 0.4rem;
	}

	th.col-country {
		white-space: normal;
		overflow-wrap: break-word;
		vertical-align: bottom;
		line-height: 1.2;
		text-align: left;
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

	.p5-dot {
		display: inline-block;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #b45309;
		flex-shrink: 0;
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
</style>
