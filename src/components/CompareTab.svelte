<script>
	import { untrack } from 'svelte';
	import * as Plot from '@observablehq/plot';
	import RangeSlider from './RangeSlider.svelte';
	import CountryMultiSelect from './CountryMultiSelect.svelte';
	import PlotComponent from './PlotComponent.svelte';
	import ChartExport from './ChartExport.svelte';
	import VotesTable from './VotesTable.svelte';
	import { MONTHS, MONTH_MIN, MONTH_MAX, monthToYM, monthLabel, monthToYear } from '$lib/time.js';
	import { P5, formatCountryName } from '$lib/countries.js';
	import {
		VOTE_ORDER,
		VOTE_COLORS,
		VOTE_LABELS,
		VOTE_COLOR_SCALE,
		OPPOSITION_KEYS,
		classifyVote
	} from '$lib/votes-individual.js';
	import { PLOT_STYLE, buildXMarks, CHART_SOURCE, niceIntStep } from '$lib/plot.js';

	/** @typedef {import('$lib/types.js').Vote} Vote */

	/** @type {{ votes: Vote[] }} */
	let { votes } = $props();

	// ── Filters ──
	let fromMonth = $state(MONTH_MIN);
	let toMonth = $state(MONTH_MAX);
	let search = $state('');

	// Default selection keeps the opening chart light: the P5 plus the five
	// most-active elected members (by total votes across the whole dataset).
	// "Reset" in the picker returns to exactly this set (creator's remark #5).
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
	const initialSelection = defaultSelection();
	let selectedCountries = $state(/** @type {Set<string>} */ (new Set(initialSelection)));

	// ── Chart controls (chronological only — the proportional-square "Total"
	// view was retired) ──
	let chronoMode = $state('all'); // 'all' | 'opposition'
	let sortMode = $state('total'); // 'total' | 'alpha' | 'bertin'
	let timeStep = $state('annual'); // 'monthly' | 'annual'
	let showTable = $state(false); // matching-resolutions table (when a search is active)

	const OPP_SET = new Set(OPPOSITION_KEYS);

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

	// Countries to display as facets: exactly the user's selection. An empty
	// selection means "no country" — the chart stays empty and prompts the user
	// to pick some (distinct from the default ten, which "Reset" restores).
	const displaySet = $derived(selectedCountries);

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
				const cat = classifyVote(v.countries[country], country, v.outcome);
				if (cat === null) continue; // unrecorded historical vote — dropped
				let s = map.get(country);
				if (!s) {
					s = {
						total: 0,
						gravSum: 0,
						gravN: 0,
						oppGravSum: 0,
						oppGravN: 0,
						byCat: {},
						byPeriod: new Map()
					};
					map.set(country, s);
				}
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

	// Council membership per YEAR, derived from the *full* dataset (period range
	// only, ignoring the topic search). UNSC terms run over full calendar years
	// (elected members serve Jan 1 → Dec 31), so a country "sat" in year Y if it
	// has any recorded vote that year. Resolving membership at the year level —
	// even in monthly mode — avoids mistaking a quiet month (no resolution at
	// all) for an absence, which would wrongly shade the permanent members.
	const membership = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local map of sets, not reactive state
		const map = new Map();
		for (const v of votes) {
			const ym = v.date.slice(0, 7);
			if (ym < fromDateStr || ym > toDateStr) continue;
			const year = v.date.slice(0, 4);
			for (const c in v.countries) {
				let set = map.get(c);
				if (!set) {
					// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local set, not reactive state
					set = new Set();
					map.set(c, set);
				}
				set.add(year);
			}
		}
		return map;
	});

	// Country facet order, per the chosen sort. In "opposition only" mode,
	// countries that never opposed have nothing to show — drop them so the
	// chart isn't padded with empty rows (creator's remark #13).
	const sortedCountries = $derived.by(() => {
		const s = stats;
		let list = [...s.keys()];
		if (chronoMode === 'opposition') list = list.filter((c) => (s.get(c)?.oppGravN ?? 0) > 0);
		const mode = sortMode;
		const byName = (/** @type {string} */ a, /** @type {string} */ b) =>
			formatCountryName(a).localeCompare(formatCountryName(b));
		if (mode === 'alpha') return list.sort(byName);
		if (mode === 'bertin') {
			// Centre of gravity: mean month-index of a country's votes. Ascending →
			// countries that voted earliest in the period appear first (top). In the
			// "opposition only" view, base it on opposition votes only so the diagonal
			// reflects the timing of dissent.
			const useOpp = chronoMode === 'opposition';
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
		if (timeStep === 'monthly') {
			const start = monthLabel(fromMonth);
			const end = monthLabel(toMonth);
			range = start === end ? start : `${start}–${end}`;
		} else {
			const a = monthToYear(fromMonth);
			const b = monthToYear(toMonth);
			range = a === b ? String(a) : `${a}–${b}`;
		}
		const variant = chronoMode === 'opposition' ? 'opposition only' : 'all votes';
		const stepLabel = timeStep === 'annual' ? 'annual' : 'monthly';
		return `Individual votes by State, ${range} (${stepLabel}, ${variant})`;
	});

	// ── Rendering ──
	/** @type {HTMLDivElement | null} */
	let wrapperEl = $state(null);
	let containerWidth = $state(0);
	/** @type {Element | null} */
	let plotSvg = $state(null);
	/** @type {HTMLDivElement | null} */
	let matchTableEl = $state(null);

	function revealTable() {
		showTable = true;
		// Wait for the table to render before scrolling to it.
		requestAnimationFrame(() =>
			matchTableEl?.scrollIntoView({ behavior: 'smooth', block: 'start' })
		);
	}

	const canExport = $derived(!!plotSvg);

	// Gather the live pieces for the image export. The legend mirrors the sidebar:
	// the (optionally filtered) vote categories plus the "not on the council" band.
	/** @returns {import('$lib/export-chart.js').ExportData} */
	function exportData() {
		const legend = VOTE_ORDER.filter(
			(cat) => chronoMode !== 'opposition' || OPPOSITION_KEYS.includes(cat)
		).map((cat) => ({ color: VOTE_COLORS[cat], label: VOTE_LABELS[cat] }));
		legend.push({ color: '#f5f5f7', label: 'State not seating' });
		return {
			title: chartTitle,
			legend,
			charts: plotSvg ? [{ svg: /** @type {SVGSVGElement} */ (plotSvg) }] : [],
			source: CHART_SOURCE
		};
	}

	// Emphasise the permanent members: bold any label whose text is a P5 display
	// name. Done by post-processing the SVG so it works for the manual
	// (text-mark) country labels.
	const P5_DISPLAY = new Set(P5.map(formatCountryName));
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
		const shown = sortedCountries;
		const s = stats;
		const mem = membership;

		if (!w || shown.length === 0) {
			plotSvg = null;
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

		// Symmetric-ish y extent from the stacked sums, so the absence bands span
		// the full row height and the axis ticks can be forced to integers
		// (creator's remark #10 — "you can't cast half a vote").
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local maps, not reactive state
		const posSum = new Map();
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local maps, not reactive state
		const negSum = new Map();
		for (const d of data) {
			const k = `${d.country}|${d.period}`;
			if (d.v >= 0) posSum.set(k, (posSum.get(k) ?? 0) + d.v);
			else negSum.set(k, (negSum.get(k) ?? 0) + d.v);
		}
		let yMax = 0;
		let yMin = 0;
		for (const val of posSum.values()) if (val > yMax) yMax = val;
		for (const val of negSum.values()) if (val < yMin) yMin = val;
		yMax = Math.max(0, Math.ceil(yMax));
		yMin = Math.min(0, Math.floor(yMin));

		const maxAbs = Math.max(1, yMax, -yMin);
		// Round, human-friendly tick step: snap to 1·2·5·10… so the axis reads
		// 0/10/20 rather than 0/23/46 (creator's remark — ticks weren't round).
		// Ticks stay integers ("you can't cast half a vote").
		const tickStep = niceIntStep(maxAbs);
		/** @type {number[]} */
		const yTicks = [];
		for (let t = 0; t <= yMax + 1e-9; t += tickStep) yTicks.push(t);
		for (let t = -tickStep; t >= yMin - 1e-9; t -= tickStep) yTicks.push(t);
		yTicks.sort((a, b) => a - b);

		const ROW_H = 80;
		const marginTop = 26;
		const marginBottom = 28;
		const height = shown.length * ROW_H + marginTop + marginBottom;

		const xDomain =
			step === 'annual'
				? [monthToYear(fromMonth), monthToYear(toMonth) + 1]
				: [new Date(monthToYM(fromMonth) + '-01'), new Date(monthToYM(toMonth + 1) + '-01')];

		// Absence bands: contiguous spans where a country was not on the council.
		const monthDate = (/** @type {number} */ m) => new Date(monthToYM(m) + '-01');
		/** @type {{ country: string, x1: any, x2: any }[]} */
		const bands = [];
		if (step === 'annual') {
			const y0 = monthToYear(fromMonth);
			const y1 = monthToYear(toMonth);
			for (const c of shown) {
				const sit = mem.get(c);
				let start = null;
				for (let y = y0; y <= y1; y++) {
					const absent = !sit || !sit.has(String(y));
					if (absent && start === null) start = y;
					if (!absent && start !== null) {
						bands.push({ country: c, x1: start, x2: y });
						start = null;
					}
				}
				if (start !== null) bands.push({ country: c, x1: start, x2: y1 + 1 });
			}
		} else {
			for (const c of shown) {
				const sit = mem.get(c);
				let start = null;
				for (let m = fromMonth; m <= toMonth; m++) {
					const absent = !sit || !sit.has(String(monthToYear(m)));
					if (absent && start === null) start = m;
					if (!absent && start !== null) {
						bands.push({ country: c, x1: monthDate(start), x2: monthDate(m) });
						start = null;
					}
				}
				if (start !== null)
					bands.push({ country: c, x1: monthDate(start), x2: monthDate(toMonth + 1) });
			}
		}

		const tipOptions = {
			channels: {
				Country: { value: (/** @type {any} */ d) => formatCountryName(d.country) },
				Period: { value: fmtPeriod },
				Vote: { value: (/** @type {any} */ d) => VOTE_LABELS[d.category] },
				Votes: { value: (/** @type {any} */ d) => d.count }
			},
			tip: {
				format: {
					x: false,
					x1: false,
					x2: false,
					y: false,
					y1: false,
					y2: false,
					fill: false,
					fy: false
				}
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
			y: { domain: [yMin, yMax], label: null },
			fy: { domain: shown, label: null, axis: null },
			color: VOTE_COLOR_SCALE,
			marks: [
				// Faint grey background over the periods a country did not sit.
				Plot.rect(bands, {
					fy: 'country',
					x1: 'x1',
					x2: 'x2',
					y1: yMin,
					y2: yMax,
					fill: '#f5f5f7',
					pointerEvents: 'none'
				}),
				Plot.gridY({ ticks: yTicks, strokeDasharray: '0.75,2', strokeOpacity: 1, insetLeft: -30 }),
				Plot.axisY({
					anchor: 'left',
					tickSize: 0,
					dy: -3,
					lineAnchor: 'bottom',
					ticks: yTicks,
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
				// lineWidth wraps long names onto a second line (creator's remark #10).
				Plot.text(shown, {
					fy: (/** @type {string} */ c) => c,
					x: xDomain[0],
					y: 0,
					text: (/** @type {string} */ c) => formatCountryName(c),
					textAnchor: 'end',
					lineAnchor: 'bottom',
					lineWidth: 11,
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
				granularity={timeStep === 'annual' ? 'year' : 'month'}
			/>
		</div>

		<div class="sidebar-section">
			<h3 class="section-label">Voting country</h3>
			<CountryMultiSelect
				available={availableCountries}
				bind:selected={selectedCountries}
				defaultSelected={initialSelection}
			/>
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
				{#if search.trim()}
					<br />
					<button type="button" class="inline-link" onclick={revealTable}>see the list below</button
					>
				{/if}
			</p>
		</div>

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
				{#if chronoMode !== 'opposition' || OPPOSITION_KEYS.includes(cat)}
					<div class="legend-item">
						<span class="legend-swatch" style="background:{VOTE_COLORS[cat]}"></span>
						<span class="legend-label">{VOTE_LABELS[cat]}</span>
					</div>
				{/if}
			{/each}
			<div class="legend-item">
				<span class="legend-swatch legend-swatch-absence"></span>
				<span class="legend-label">State not seating</span>
			</div>
		</div>
	</aside>

	<div class="chart-area" bind:this={wrapperEl}>
		<div class="chart-header">
			<h2 class="chart-title">{chartTitle}</h2>
			<ChartExport filename="unsc-compare" getData={exportData} disabled={!canExport} />
		</div>
		{#if plotSvg}
			<div class="chart-scroll">
				<PlotComponent svgElement={plotSvg} />
			</div>
		{:else if selectedCountries.size === 0}
			<p class="empty-msg">Select one or more countries to display the chart.</p>
		{:else}
			<p class="empty-msg">No votes match the current filters.</p>
		{/if}
		<p class="chart-source">{CHART_SOURCE}</p>

		{#if search.trim()}
			<div class="match-table" bind:this={matchTableEl}>
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
		/* Stick the controls in view while the (potentially tall) chart scrolls
		   with the page — keeps "scroll if needed" without an inner overflow
		   container that would clip the Plot tooltips. */
		position: sticky;
		top: calc(var(--header-height) + 3rem);
	}

	.chart-area {
		flex: 1;
		min-width: 0;
	}

	.chart-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.5rem;
	}

	.chart-title {
		font-size: 0.95rem;
		font-weight: 600;
		line-height: 1.3;
		color: var(--text);
		margin: 0;
	}

	/* The chart grows with the number of countries and scrolls with the page.
	   An inline <svg> clips to its bounds by default; let tooltips spill out. */
	.chart-scroll :global(svg) {
		overflow: visible;
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

	.filter-feedback {
		margin: 0.4rem 0 0;
		font-size: 0.72rem;
		color: var(--text-muted);
	}

	.inline-link {
		padding: 0;
		border: none;
		background: none;
		color: var(--accent);
		font-size: inherit;
		font-weight: 600;
		text-decoration: underline;
		cursor: pointer;
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

	.legend-swatch-absence {
		background: #f5f5f7;
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
			position: static;
		}

		.sidebar-section:first-child {
			grid-column: 1 / -1;
		}

		.chart-area {
			width: 100%;
		}
	}
</style>
