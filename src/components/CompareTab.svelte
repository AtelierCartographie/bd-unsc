<script>
	import { untrack } from 'svelte';
	import * as Plot from '@observablehq/plot';
	import RangeSlider from './RangeSlider.svelte';
	import CountryMultiSelect from './CountryMultiSelect.svelte';
	import PlotComponent from './PlotComponent.svelte';
	import VotesTable from './VotesTable.svelte';
	import { MONTHS, MONTH_MIN, MONTH_MAX, monthToYM, monthLabel, monthToYear } from '$lib/time.js';
	import { P5, formatCountryName } from '$lib/countries.js';
	import {
		VOTE_ORDER,
		VOTE_COLORS,
		VOTE_LABELS,
		VOTE_SHORT_LABELS,
		VOTE_COLOR_SCALE,
		OPPOSITION_KEYS,
		classifyVote
	} from '$lib/votes-individual.js';
	import { PLOT_STYLE, buildXMarks } from '$lib/plot.js';

	/** @typedef {import('$lib/types.js').Vote} Vote */

	/** @type {{ votes: Vote[] }} */
	let { votes } = $props();

	// ── Filters ──
	let fromMonth = $state(MONTH_MIN);
	let toMonth = $state(MONTH_MAX);
	let search = $state('');

	// Default selection keeps the opening chart light: the P5 plus the five
	// most-active elected members (by total votes across the whole dataset).
	// Clearing the picker still falls back to "all countries".
	function defaultSelection() {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local count map, not reactive state
		const counts = new Map();
		for (const v of votes) {
			for (const c in v.countries) counts.set(c, (counts.get(c) ?? 0) + 1);
		}
		const topElected = [...counts.entries()]
			.filter(([c]) => !P5.includes(c))
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([c]) => c);
		return new Set([...P5.filter((c) => counts.has(c)), ...topElected]);
	}
	let selectedCountries = $state(/** @type {Set<string>} */ (defaultSelection()));

	// ── Chart controls ──
	let chartType = $state('total'); // 'total' | 'chrono'
	let chronoMode = $state('all'); // 'all' | 'opposition' (chrono only)
	let sortMode = $state('total'); // 'total' | 'alpha' | 'bertin'
	let timeStep = $state('annual'); // 'monthly' | 'annual' (chrono only)
	let showTable = $state(false); // matching-resolutions table (when a search is active)

	/** @param {'annual' | 'monthly'} step */
	function setTimeStep(step) {
		if (step === 'annual') {
			fromMonth = Math.floor(fromMonth / 12) * 12;
			toMonth = Math.floor(toMonth / 12) * 12 + 11;
		}
		timeStep = step;
	}

	const fromDateStr = $derived(monthToYM(fromMonth));
	const toDateStr = $derived(monthToYM(toMonth));

	// Countries with at least one entry in the selected period (for the picker).
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

	// Drop selected countries that fall out of scope when the period changes.
	$effect(() => {
		const avail = availableCountries;
		const current = untrack(() => selectedCountries);
		const valid = new Set([...current].filter((c) => avail.has(c)));
		if (valid.size !== current.size) selectedCountries = valid;
	});

	// Votes within the period and matching the title search.
	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return votes.filter((v) => {
			const ym = v.date.slice(0, 7);
			if (ym < fromDateStr || ym > toDateStr) return false;
			if (q && !v.title.toLowerCase().includes(q)) return false;
			return true;
		});
	});

	// Countries to display as facets: the explicit selection, or everything
	// available when nothing is selected (same convention as the Browse tab).
	const displaySet = $derived.by(() => {
		if (selectedCountries.size > 0) return selectedCountries;
		return availableCountries;
	});

	/**
	 * Per-country aggregation in a single pass.
	 * @typedef {{
	 *   total: number,
	 *   gravSum: number,
	 *   gravN: number,
	 *   oppGravSum: number,
	 *   oppGravN: number,
	 *   byCat: Record<string, number>,
	 *   byPeriod: Map<string, Record<string, number>>
	 * }} CountryStat
	 */
	const stats = $derived.by(() => {
		const show = displaySet;
		const step = timeStep;
		/** @type {Map<string, CountryStat>} */
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local aggregation map, not reactive state
		const map = new Map();

		for (const v of filtered) {
			const year = parseInt(v.date.slice(0, 4));
			const month = parseInt(v.date.slice(5, 7));
			const monthIdx = (year - 1946) * 12 + (month - 1);
			const periodKey =
				step === 'annual' ? String(year) : `${year}-${String(month).padStart(2, '0')}`;

			for (const country in v.countries) {
				if (!show.has(country)) continue;
				let s = map.get(country);
				if (!s) {
					s = { total: 0, gravSum: 0, gravN: 0, oppGravSum: 0, oppGravN: 0, byCat: {}, byPeriod: new Map() };
					map.set(country, s);
				}
				const cat = classifyVote(v.countries[country], country, v.outcome);
				s.total += 1;
				s.gravSum += monthIdx;
				s.gravN += 1;
				if (OPP_SET.has(cat)) {
					s.oppGravSum += monthIdx;
					s.oppGravN += 1;
				}
				s.byCat[cat] = (s.byCat[cat] ?? 0) + 1;
				let p = s.byPeriod.get(periodKey);
				if (!p) {
					p = {};
					s.byPeriod.set(periodKey, p);
				}
				p[cat] = (p[cat] ?? 0) + 1;
			}
		}
		return map;
	});

	// Country facet order, per the chosen sort.
	const sortedCountries = $derived.by(() => {
		const list = [...stats.keys()];
		const s = stats;
		const mode = sortMode;
		const byName = (/** @type {string} */ a, /** @type {string} */ b) =>
			formatCountryName(a).localeCompare(formatCountryName(b));
		if (mode === 'alpha') return list.sort(byName);
		if (mode === 'bertin') {
			// Centre of gravity: mean month-index of a country's votes. Ascending →
			// countries that voted earliest in the period appear first (top).
			// In the "opposition only" chrono view, base it on opposition votes only
			// so the diagonal reflects the timing of dissent (countries that never
			// opposed fall to the bottom).
			const useOpp = chartType === 'chrono' && chronoMode === 'opposition';
			const grav = (/** @type {CountryStat | undefined} */ st) => {
				if (!st) return Infinity;
				const sum = useOpp ? st.oppGravSum : st.gravSum;
				const n = useOpp ? st.oppGravN : st.gravN;
				return n ? sum / n : Infinity;
			};
			return list.sort((a, b) => grav(s.get(a)) - grav(s.get(b)) || byName(a, b));
		}
		// 'total' (default): most votes first.
		return list.sort((a, b) => (s.get(b)?.total ?? 0) - (s.get(a)?.total ?? 0) || byName(a, b));
	});

	const chartTitle = $derived.by(() => {
		let range;
		if (chartType === 'chrono' && timeStep === 'monthly') {
			const start = monthLabel(fromMonth);
			const end = monthLabel(toMonth);
			range = start === end ? start : `${start}–${end}`;
		} else {
			const a = monthToYear(fromMonth);
			const b = monthToYear(toMonth);
			range = a === b ? String(a) : `${a}–${b}`;
		}
		if (chartType === 'total') {
			return `Individual votes by State, total over ${range}`;
		}
		const variant = chronoMode === 'opposition' ? 'opposition only' : 'all votes';
		const stepLabel = timeStep === 'annual' ? 'annual' : 'monthly';
		return `Individual votes by State over time, ${range} (${stepLabel}, ${variant})`;
	});

	// ── Rendering ──
	/** @type {HTMLDivElement | null} */
	let wrapperEl = $state(null);
	let containerWidth = $state(0);
	/** @type {Element | null} */
	let plotSvg = $state(null);
	let hiddenCount = $state(0); // countries dropped by the facet cap

	// Both charts facet by country; cap the row count so a very wide selection
	// can't produce an unreadably tall (or slow) chart. The country filter is the
	// way to look beyond the cap (and the note below says how many are hidden).
	const MAX_FACETS = 50;

	// Emphasise the permanent members: bold any label whose text is a P5 display
	// name. Done by post-processing the SVG so it works for both the faceted
	// (axis-drawn) and the manual (text-mark) country labels.
	const P5_DISPLAY = new Set(P5.map(formatCountryName));
	const OPP_SET = new Set(OPPOSITION_KEYS);
	/** @param {Element} svg */
	function markP5Labels(svg) {
		for (const t of svg.querySelectorAll('text')) {
			if (t.textContent && P5_DISPLAY.has(t.textContent)) {
				/** @type {SVGElement} */ (t).style.fontWeight = '700';
			}
		}
	}

	$effect(() => {
		const el = wrapperEl;
		if (!el) return;
		containerWidth = el.offsetWidth || 600;
		const obs = new ResizeObserver(([entry]) => {
			containerWidth = entry.contentRect.width || 600;
		});
		obs.observe(el);
		return () => obs.disconnect();
	});

	$effect(() => {
		const w = containerWidth;
		const order = sortedCountries;
		const s = stats;
		const type = chartType;

		if (!w || order.length === 0) {
			plotSvg = null;
			hiddenCount = 0;
			return;
		}

		const shown = order.slice(0, MAX_FACETS);
		hiddenCount = order.length - shown.length;

		if (type === 'total') {
			// Proportional-square matrix: rows = countries, columns = vote
			// categories. Square area ∝ number of votes (one shared size scale, so
			// squares are comparable across countries); squares are bottom-aligned
			// on a per-row baseline so they sit on a common line, value above.
			//
			// Everything is positioned in pixel space (identity x/y scales) so the
			// squares are truly square and can be aligned to their baseline.
			const cats = VOTE_ORDER;
			const ncat = cats.length;
			const LEFT = 150;
			const RIGHT = 16;
			const ROW_H = 62;
			const HEADER = 30; // top band for the column labels
			const BOTTOM_PAD = 8; // gap between baseline and row bottom
			const H = HEADER + shown.length * ROW_H + 12;
			const colW = (w - LEFT - RIGHT) / ncat;
			const MAX_SIDE = Math.max(8, Math.min(colW - 14, ROW_H - 24));

			/** @type {{ country: string, category: string, count: number }[]} */
			const data = [];
			let globalMax = 0;
			for (const country of shown) {
				const byCat = s.get(country)?.byCat ?? {};
				for (const cat of cats) {
					const count = byCat[cat] ?? 0;
					if (count > globalMax) globalMax = count;
					if (count > 0) data.push({ country, category: cat, count });
				}
			}
			if (globalMax === 0) {
				plotSvg = null;
				return;
			}

			const rowIndex = new Map(shown.map((c, i) => [c, i]));
			const catIndex = new Map(cats.map((c, i) => [c, i]));
			const cx = (/** @type {string} */ cat) => LEFT + colW * (catIndex.get(cat) + 0.5);
			const baseY = (/** @type {string} */ country) =>
				HEADER + (rowIndex.get(country) ?? 0) * ROW_H + (ROW_H - BOTTOM_PAD);
			const sideOf = (/** @type {number} */ count) => Math.sqrt(count / globalMax) * MAX_SIDE;
			const rows = shown.map((country) => ({ country, name: formatCountryName(country) }));

			const svg = Plot.plot({
				width: w,
				height: H,
				marginLeft: 0,
				marginRight: 0,
				marginTop: 0,
				marginBottom: 0,
				style: PLOT_STYLE,
				x: { domain: [0, w], range: [0, w], axis: null },
				y: { domain: [0, H], range: [0, H], axis: null },
				color: VOTE_COLOR_SCALE,
				marks: [
					// Per-row baseline the squares rest on (overhangs slightly left).
					Plot.ruleY(shown, {
						y: (/** @type {string} */ c) => baseY(c),
						x1: LEFT - 30,
						x2: w - RIGHT,
						stroke: 'var(--border-strong)',
						strokeWidth: 1
					}),
					// Squares, bottom-aligned on the baseline.
					Plot.rect(data, {
						x1: (/** @type {any} */ d) => cx(d.category) - sideOf(d.count) / 2,
						x2: (/** @type {any} */ d) => cx(d.category) + sideOf(d.count) / 2,
						y1: (/** @type {any} */ d) => baseY(d.country) - sideOf(d.count),
						y2: (/** @type {any} */ d) => baseY(d.country),
						fill: 'category',
						channels: {
							Country: { value: (/** @type {any} */ d) => formatCountryName(d.country) },
							Vote: { value: (/** @type {any} */ d) => VOTE_LABELS[d.category] },
							Votes: { value: (/** @type {any} */ d) => d.count }
						},
						tip: { format: { x1: false, x2: false, y1: false, y2: false, fill: false } }
					}),
					// Value above each square.
					Plot.text(data, {
						x: (/** @type {any} */ d) => cx(d.category),
						y: (/** @type {any} */ d) => baseY(d.country) - sideOf(d.count) - 6,
						text: (/** @type {any} */ d) => d.count.toLocaleString('en'),
						fill: 'var(--text-muted)',
						fontSize: 10
					}),
					// Column header (category short labels).
					Plot.text(cats, {
						x: (/** @type {string} */ c) => cx(c),
						y: 14,
						text: (/** @type {string} */ c) => VOTE_SHORT_LABELS[c],
						fontWeight: 600,
						fontSize: 12
					}),
					// Country labels, aligned with each row's baseline (P5 emphasised
					// by markP5Labels below).
					Plot.text(rows, {
						x: LEFT - 8,
						y: (/** @type {any} */ d) => baseY(d.country),
						dy: -2,
						text: (/** @type {any} */ d) => d.name,
						textAnchor: 'end',
						fontSize: 12
					})
				]
			});
			markP5Labels(svg);
			plotSvg = svg;
			return;
		}

		// ── Chronological: a single faceted Plot (fy = country) so the X and Y
		// scales are SHARED across countries. Bars are bidirectional: one category
		// points up, the rest stack downward (Yes vs the rest; in opposition mode,
		// Abstention vs No + Veto). ──
		const step = timeStep;
		const xType = step === 'annual' ? 'linear' : 'utc';
		const xInterval = step === 'annual' ? 1 : 'month';
		const shownCats = chronoMode === 'opposition' ? OPPOSITION_KEYS : VOTE_ORDER;
		const upKey = chronoMode === 'opposition' ? 'abstention' : 'yes';

		const fmtPeriod = (/** @type {any} */ d) =>
			step === 'annual'
				? d.period
				: `${MONTHS[Number(d.period.slice(5, 7)) - 1]} ${d.period.slice(0, 4)}`;

		/** @type {any[]} */
		const data = [];
		for (const country of shown) {
			const byPeriod = s.get(country)?.byPeriod;
			if (!byPeriod) continue;
			for (const [period, catCounts] of byPeriod) {
				const x = step === 'annual' ? parseInt(period) : new Date(period + '-15');
				for (const cat of shownCats) {
					const count = catCounts[cat] ?? 0;
					if (count > 0) {
						data.push({
							country,
							period,
							x,
							category: cat,
							count,
							v: cat === upKey ? count : -count
						});
					}
				}
			}
		}

		if (data.length === 0) {
			plotSvg = null;
			return;
		}

		const ROW_H = 80;
		const marginTop = 26;
		const marginBottom = 28;
		const height = shown.length * ROW_H + marginTop + marginBottom;

		const xDomain =
			step === 'annual'
				? [monthToYear(fromMonth), monthToYear(toMonth) + 1]
				: [new Date(monthToYM(fromMonth) + '-01'), new Date(monthToYM(toMonth + 1) + '-01')];

		const tipOptions = {
			channels: {
				Country: { value: (/** @type {any} */ d) => formatCountryName(d.country) },
				Period: { value: fmtPeriod },
				Vote: { value: (/** @type {any} */ d) => VOTE_LABELS[d.category] },
				Votes: { value: (/** @type {any} */ d) => d.count }
			},
			tip: {
				format: { x: false, x1: false, x2: false, y: false, y1: false, y2: false, fill: false }
			}
		};

		const svg = Plot.plot({
			width: w,
			height,
			marginLeft: 150,
			marginRight: 14,
			marginTop,
			marginBottom,
			style: PLOT_STYLE,
			x: { type: xType, domain: xDomain, label: null },
			y: { label: null },
			fy: { domain: shown, label: null, axis: null },
			color: VOTE_COLOR_SCALE,
			marks: [
				Plot.gridY({ strokeDasharray: '0.75,2', strokeOpacity: 1, insetLeft: -30 }),
				Plot.axisY({
					anchor: 'left',
					tickSize: 0,
					dy: -3,
					lineAnchor: 'bottom',
					ticks: 3,
					tickFormat: (/** @type {number} */ d) => String(Math.abs(d))
				}),
				...buildXMarks(/** @type {'annual' | 'monthly'} */ (step), fromMonth, toMonth, 'top'),
				...buildXMarks(/** @type {'annual' | 'monthly'} */ (step), fromMonth, toMonth, 'bottom'),
				Plot.rectY(
					data,
					Plot.stackY({
						order: shownCats,
						x: 'x',
						y: 'v',
						fill: 'category',
						fy: 'country',
						interval: xInterval,
						inset: 0,
						...tipOptions
					})
				),
				Plot.ruleY([0], { insetLeft: -30 }),
				// Country label, aligned with the baseline (y = 0) of each facet.
				Plot.text(shown, {
					fy: (/** @type {string} */ c) => c,
					x: xDomain[0],
					y: 0,
					text: (/** @type {string} */ c) => formatCountryName(c),
					textAnchor: 'end',
					dx: -40,
					dy: -2,
					fontSize: 12
				})
			]
		});
		markP5Labels(svg);
		plotSvg = svg;
	});
</script>

<div class="compare-layout">
	<aside class="sidebar">
		<div class="sidebar-section">
			<h3 class="section-label">Period</h3>
			<RangeSlider
				bind:from={fromMonth}
				bind:to={toMonth}
				granularity={chartType === 'chrono' && timeStep === 'annual' ? 'year' : 'month'}
			/>
		</div>

		<div class="sidebar-section">
			<h3 class="section-label">Voting country</h3>
			<CountryMultiSelect available={availableCountries} bind:selected={selectedCountries} />
		</div>

		<div class="sidebar-section">
			<label for="compare-search" class="section-label">Topic</label>
			<input
				id="compare-search"
				class="text-input"
				type="search"
				placeholder="Search by title…"
				bind:value={search}
			/>
			<p class="filter-feedback">
				{filtered.length.toLocaleString('en')} of {votes.length.toLocaleString('en')} votes
			</p>
		</div>

		<div class="sidebar-section">
			<h3 class="section-label">Chart</h3>
			<div class="toggle-group">
				<button
					class="toggle-btn"
					class:active={chartType === 'total'}
					onclick={() => (chartType = 'total')}>Total</button
				>
				<button
					class="toggle-btn"
					class:active={chartType === 'chrono'}
					onclick={() => (chartType = 'chrono')}>Chronological</button
				>
			</div>
		</div>

		{#if chartType === 'chrono'}
			<div class="sidebar-section">
				<h3 class="section-label">Votes shown</h3>
				<div class="toggle-group">
					<button
						class="toggle-btn"
						class:active={chronoMode === 'all'}
						onclick={() => (chronoMode = 'all')}>All</button
					>
					<button
						class="toggle-btn"
						class:active={chronoMode === 'opposition'}
						onclick={() => (chronoMode = 'opposition')}>Opposition only</button
					>
				</div>
			</div>

			<div class="sidebar-section">
				<h3 class="section-label">Time step</h3>
				<div class="toggle-group">
					<button
						class="toggle-btn"
						class:active={timeStep === 'annual'}
						onclick={() => setTimeStep('annual')}>Annual</button
					>
					<button
						class="toggle-btn"
						class:active={timeStep === 'monthly'}
						onclick={() => setTimeStep('monthly')}>Monthly</button
					>
				</div>
			</div>
		{/if}

		<div class="sidebar-section">
			<h3 class="section-label">Sort countries</h3>
			<div class="toggle-group toggle-group-col">
				<button
					class="toggle-btn"
					class:active={sortMode === 'total'}
					onclick={() => (sortMode = 'total')}>By total votes</button
				>
				<button
					class="toggle-btn"
					class:active={sortMode === 'alpha'}
					onclick={() => (sortMode = 'alpha')}>A–Z</button
				>
				<button
					class="toggle-btn"
					class:active={sortMode === 'bertin'}
					onclick={() => (sortMode = 'bertin')}>Chronological</button
				>
			</div>
		</div>

		<div class="sidebar-section">
			<h3 class="section-label">Legend</h3>
			{#each VOTE_ORDER as cat (cat)}
				{#if chartType !== 'chrono' || chronoMode !== 'opposition' || OPPOSITION_KEYS.includes(cat)}
					<div class="legend-item">
						<span class="legend-swatch" style="background:{VOTE_COLORS[cat]}"></span>
						<span class="legend-label">{VOTE_LABELS[cat]}</span>
					</div>
				{/if}
			{/each}
		</div>
	</aside>

	<div class="chart-area" bind:this={wrapperEl}>
		<h2 class="chart-title">{chartTitle}</h2>
		{#if hiddenCount > 0}
			<p class="chrono-note">
				Showing the first {Math.min(sortedCountries.length, MAX_FACETS)} countries by the current sort.
				{hiddenCount} more are hidden — narrow the country filter to see them.
			</p>
		{/if}
		{#if plotSvg}
			<PlotComponent svgElement={plotSvg} />
		{:else}
			<p class="empty-msg">No votes match the current filters.</p>
		{/if}
		<p class="chart-source">Source : UNSC Votes Since 1946 Database, v.1 (2026)</p>

		{#if search.trim()}
			<div class="match-table">
				<button class="match-toggle" onclick={() => (showTable = !showTable)}>
					{showTable ? 'Hide' : 'Show'} matching resolutions ({filtered.length.toLocaleString(
						'en'
					)})
				</button>
				{#if showTable}
					<VotesTable rows={filtered} totalCount={votes.length} />
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.compare-layout {
		display: flex;
		gap: 2rem;
		align-items: flex-start;
	}

	.sidebar {
		width: 220px;
		flex-shrink: 0;
	}

	.chart-area {
		flex: 1;
		min-width: 0;
	}

	.chart-title {
		font-size: 0.95rem;
		font-weight: 600;
		line-height: 1.3;
		color: var(--text);
		margin: 0 0 0.5rem;
	}

	.chart-source {
		font-size: 0.68rem;
		color: var(--text-muted);
		margin: 0.5rem 0 0;
	}

	.empty-msg {
		font-size: 0.875rem;
		color: var(--text-muted);
		padding: 2rem 0;
	}

	.chrono-note {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin: 0 0 0.5rem;
	}

	.filter-feedback {
		margin: 0.4rem 0 0;
		font-size: 0.72rem;
		color: var(--text-muted);
	}

	.match-table {
		margin-top: 1.5rem;
		border-top: 1px solid var(--border);
		padding-top: 1rem;
	}

	.match-toggle {
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--border-strong);
		border-radius: 6px;
		background: var(--background);
		color: var(--accent);
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		margin-bottom: 1rem;
	}

	.match-toggle:hover {
		background: var(--surface);
	}

	.sidebar-section {
		margin-bottom: 1.5rem;
	}

	.section-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		font-weight: 600;
		margin-bottom: 0.5rem;
		display: block;
	}

	.text-input {
		width: 100%;
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

	.text-input:focus {
		border-color: var(--accent);
	}

	.toggle-group {
		display: flex;
		border: 1px solid var(--border-strong);
		border-radius: 6px;
		overflow: hidden;
	}

	.toggle-group-col {
		flex-direction: column;
	}

	.toggle-btn {
		flex: 1;
		padding: 0.4rem 0.4rem;
		background: none;
		border: none;
		border-right: 1px solid var(--border-strong);
		font-size: 0.8rem;
		color: var(--text-muted);
		transition:
			background 0.1s,
			color 0.1s;
		line-height: 1.2;
		cursor: pointer;
	}

	.toggle-group-col .toggle-btn {
		border-right: none;
		border-bottom: 1px solid var(--border-strong);
	}

	.toggle-btn:last-child {
		border-right: none;
		border-bottom: none;
	}

	.toggle-btn.active {
		background: #e6edfb;
		color: var(--accent);
		font-weight: 600;
	}

	.toggle-btn:hover:not(.active) {
		background: var(--surface);
		color: var(--text);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.4rem;
		font-size: 0.8rem;
		color: var(--text);
	}

	.legend-swatch {
		width: 12px;
		height: 12px;
		border-radius: 3px;
		flex-shrink: 0;
		border: 1px solid rgba(0, 0, 0, 0.08);
	}

	@media (max-width: 768px) {
		.compare-layout {
			flex-direction: column;
			gap: 1.25rem;
		}

		.sidebar {
			width: 100%;
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 1rem;
		}

		.sidebar-section:first-child {
			grid-column: 1 / -1;
		}

		.chart-area {
			width: 100%;
		}
	}
</style>
