<script>
	import * as Plot from '@observablehq/plot';
	import RangeSlider from './RangeSlider.svelte';
	import PlotComponent from './PlotComponent.svelte';
	import { MONTHS, MONTH_MIN, MONTH_MAX, monthToYM, monthLabel, monthToYear } from '$lib/time.js';
	import {
		OUTCOME_ORDER,
		OUTCOME_COLORS,
		OUTCOME_LABELS,
		ADOPTED_KEYS
	} from '$lib/outcomes.js';
	import { PLOT_STYLE, PLOT_MARGIN_LEFT, OUTCOME_COLOR_SCALE, buildXMarks } from '$lib/plot.js';

	/** @typedef {import('$lib/types.js').Vote} Vote */
	/** @typedef {import('$lib/types.js').AggRow} AggRow */

	/** @type {{ votes: Vote[] }} */
	let { votes } = $props();

	let fromMonth = $state(MONTH_MIN);
	let toMonth = $state(MONTH_MAX);
	let timeStep = $state('annual');

	/** @param {'annual' | 'monthly'} step */
	function setTimeStep(step) {
		if (step === 'annual') {
			fromMonth = Math.floor(fromMonth / 12) * 12;
			toMonth = Math.floor(toMonth / 12) * 12 + 11;
		}
		timeStep = step;
	}
	let unit = $state('count');
	let chartType = $state('stacked');

	/** @type {HTMLDivElement | null} */
	let wrapperEl = $state(null);
	let containerWidth = $state(0);
	/** @type {Element | null} */
	let plotSvg = $state(null);
	/** @type {Element[] | null} */
	let facetSvgs = $state(null);

	const chartTitle = $derived.by(() => {
		let range;
		if (timeStep === 'monthly') {
			const start = monthLabel(fromMonth);
			const end = monthLabel(toMonth);
			range = start === end ? start : `${start}–${end}`;
		} else {
			const startYear = monthToYear(fromMonth);
			const endYear = monthToYear(toMonth);
			range = startYear === endYear ? String(startYear) : `${startYear}–${endYear}`;
		}
		const unitLabel = unit === 'count' ? 'Number' : 'Share (%)';
		const stepLabel = timeStep === 'annual' ? 'annual' : 'monthly';
		const typeLabel = chartType === 'separated' ? ', own baselines' : '';
		return `${unitLabel} of UNSC votes by outcome, ${range} (${stepLabel}${typeLabel})`;
	});

	const aggregated = $derived.by(() => {
		const fyM = monthToYM(fromMonth);
		const tyM = monthToYM(toMonth);
		const step = timeStep;

		const filtered = votes.filter((v) => {
			const ym = v.date.slice(0, 7);
			return ym >= fyM && ym <= tyM;
		});

		/** @type {Map<string, Map<string, number>>} */
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local aggregation map, not reactive state
		const groups = new Map();
		for (const v of filtered) {
			const year = parseInt(v.date.slice(0, 4));
			const month = parseInt(v.date.slice(5, 7));
			const key = step === 'annual' ? String(year) : `${year}-${String(month).padStart(2, '0')}`;
			if (!groups.has(key)) groups.set(key, new Map());
			const g = /** @type {Map<string, number>} */ (groups.get(key));
			g.set(v.outcome, (g.get(v.outcome) ?? 0) + 1);
		}

		/** @type {AggRow[]} */
		const rows = [];
		for (const [period, outcomeMap] of [...groups.entries()].sort()) {
			const total = [...outcomeMap.values()].reduce((a, b) => a + b, 0);
			const x = step === 'annual' ? parseInt(period) : new Date(period + '-15');
			for (const outcome of OUTCOME_ORDER) {
				const count = outcomeMap.get(outcome) ?? 0;
				rows.push({ period, x, outcome, count, pct: total > 0 ? (count / total) * 100 : 0 });
			}
		}
		return rows;
	});

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
		const data = aggregated;
		if (!w || data.length === 0) {
			plotSvg = null;
			facetSvgs = null;
			return;
		}

		const step = timeStep;
		const u = unit;
		const ct = chartType;
		const xFn = (/** @type {AggRow} */ d) => d.x;
		const xType = step === 'annual' ? 'linear' : 'utc';
		const xInterval = step === 'annual' ? 1 : 'month';

		// Shared y-axis marks — adapted for annual (numeric) vs monthly (Date/utc)
		const gridY = Plot.gridY({ strokeDasharray: '0.75,2', strokeOpacity: 1, insetLeft: -30 });
		const axisY = Plot.axisY({ tickSize: 0, dy: -3, lineAnchor: 'bottom' });

		// Adaptive x-axis marks (see buildXMarks in $lib/plot.js)
		const xMarks = buildXMarks(/** @type {'annual' | 'monthly'} */ (step), fromMonth, toMonth);

		// Reader-facing tooltip — explicit, named channels (Period / Outcome / Votes /
		// Share) instead of the raw x1/x2/y stacking channels. Spread into each mark.
		const fmtPeriod = (/** @type {AggRow} */ d) =>
			step === 'annual'
				? d.period
				: `${MONTHS[Number(d.period.slice(5, 7)) - 1]} ${d.period.slice(0, 4)}`;
		const tipOptions = {
			channels: {
				Period: { value: fmtPeriod },
				Outcome: { value: (/** @type {AggRow} */ d) => OUTCOME_LABELS[d.outcome] },
				Votes: { value: (/** @type {AggRow} */ d) => d.count },
				Share: { value: (/** @type {AggRow} */ d) => `${d.pct.toFixed(1)} %` }
			},
			tip: {
				format: {
					x: false,
					x1: false,
					x2: false,
					y: false,
					y1: false,
					y2: false,
					fill: false
				}
			}
		};

		if (ct === 'stacked' && u === 'count') {
			// Bidirectional bars: adopted → positive (up), non-adopted → negative (down)
			// rectY + interval donne une échelle quantitative → xMarks adaptatifs disponibles
			facetSvgs = null;
			const adopted = new Set(ADOPTED_KEYS);
			const barData = data.map((d) => ({ ...d, v: adopted.has(d.outcome) ? d.count : -d.count }));

			// Y labels en valeur absolue : les barres négatives restent un repère visuel,
			// mais le signe n'a pas de sens métier ici (pas de "nombre négatif de votes").
			const axisYAbs = Plot.axisY({
				tickSize: 0,
				dy: -3,
				lineAnchor: 'bottom',
				tickFormat: (/** @type {number} */ d) => String(Math.abs(d))
			});

			plotSvg = Plot.plot({
				width: w,
				height: 500,
				marginLeft: PLOT_MARGIN_LEFT,
				marginBottom: 36,
				style: PLOT_STYLE,
				x: { type: xType, label: null },
				y: { label: null },
				color: OUTCOME_COLOR_SCALE,
				marks: [
					gridY,
					axisYAbs,
					...xMarks,
					Plot.rectY(
						barData,
						Plot.stackY({
							order: [
								'adopted (majority)',
								'adopted (unanimity)',
								'not adopted (lack of majority)',
								'not adopted (veto)'
							],
							x: xFn,
							y: 'v',
							fill: 'outcome',
							interval: xInterval,
							inset: 0,
							...tipOptions
						})
					),
					Plot.ruleY([0], { insetLeft: -30 })
				]
			});
		} else if (ct === 'stacked') {
			// Stacked bars — percent mode (normalized via offset: 'expand').
			// rectY + interval donne des barres ancrées sur chaque période entière,
			// ce qui évite le problème de demi-barres aux extrémités du curve: 'step'.
			facetSvgs = null;
			plotSvg = Plot.plot({
				width: w,
				height: 500,
				marginLeft: PLOT_MARGIN_LEFT,
				marginBottom: 36,
				style: PLOT_STYLE,
				x: { type: xType, label: null },
				y: { label: null },
				color: OUTCOME_COLOR_SCALE,
				marks: [
					gridY,
					Plot.axisY({
						tickSize: 0,
						dy: -3,
						lineAnchor: 'bottom',
						tickFormat: (/** @type {number} */ d) =>
							d >= 0.9999 ? `${(d * 100).toFixed(0)} %` : `${(d * 100).toFixed(0)}`
					}),
					...xMarks,
					Plot.rectY(
						data,
						Plot.stackY({
							order: OUTCOME_ORDER,
							offset: 'expand',
							x: xFn,
							y: 'count',
							fill: 'outcome',
							interval: xInterval,
							inset: 0,
							...tipOptions
						})
					),
					Plot.ruleY([0], { insetLeft: -30 })
				]
			});
		} else {
			// Separated: un Plot par outcome, hauteur proportionnelle au max local
			// → même pixels/unité sur tous les facets (échelle commune), mais chaque
			//   facet n'affiche que la plage dont il a besoin
			const yKey = u === 'count' ? 'count' : 'pct';

			const MARGIN_TOP = 20;
			const MARGIN_BOTTOM_SMALL = 4;
			const MARGIN_BOTTOM_AXIS = 36;
			const BASE_HEIGHT = 200; // hauteur de référence pour le facet au max global
			const scaleHeight = BASE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM_SMALL;

			const localMaxMap = new Map(
				OUTCOME_ORDER.map((o) => [
					o,
					Math.max(0, ...data.filter((d) => d.outcome === o).map((d) => d[yKey]))
				])
			);
			const globalMax = Math.max(...localMaxMap.values());

			plotSvg = null;
			if (globalMax === 0) {
				facetSvgs = null;
				return;
			}

			facetSvgs = OUTCOME_ORDER.map((outcome, i) => {
				const isLast = i === OUTCOME_ORDER.length - 1;
				const mb = isLast ? MARGIN_BOTTOM_AXIS : MARGIN_BOTTOM_SMALL;
				const lmax = localMaxMap.get(outcome) ?? 0;
				const h = Math.max(
					MARGIN_TOP + mb + 20,
					Math.round((lmax / globalMax) * scaleHeight) + MARGIN_TOP + mb
				);
				const outcomeData = data.filter((d) => d.outcome === outcome);
				const facetAxisY =
					u === 'percent'
						? Plot.axisY({
								tickSize: 0,
								dy: -3,
								lineAnchor: 'bottom',
								tickFormat: (/** @type {number} */ d) => (d === 100 ? '100 %' : `${d.toFixed(0)}`)
							})
						: axisY;

				return Plot.plot({
					width: w,
					height: h,
					marginLeft: PLOT_MARGIN_LEFT,
					marginBottom: mb,
					marginTop: MARGIN_TOP,
					style: PLOT_STYLE,
					x: { type: xType, label: null },
					y: {
						label: null,
						...(u !== 'percent' && { tickFormat: ',' })
					},
					color: OUTCOME_COLOR_SCALE,
					marks: [
						gridY,
						facetAxisY,
						...(isLast ? xMarks : []),
						Plot.rectY(outcomeData, {
							x: xFn,
							y: yKey,
							fill: 'outcome',
							interval: xInterval,
							inset: 0,
							...tipOptions
						}),
						Plot.ruleY([0], { insetLeft: -30 })
					]
				});
			});
		}
	});
</script>

<div class="trends-layout">
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
			<h3 class="section-label">Unit</h3>
			<div class="toggle-group">
				<button class="toggle-btn" class:active={unit === 'count'} onclick={() => (unit = 'count')}
					>Count</button
				>
				<button
					class="toggle-btn"
					class:active={unit === 'percent'}
					onclick={() => (unit = 'percent')}>Share (%)</button
				>
			</div>
		</div>

		<div class="sidebar-section">
			<h3 class="section-label">Chart type</h3>
			<div class="toggle-group">
				<button
					class="toggle-btn"
					class:active={chartType === 'stacked'}
					onclick={() => (chartType = 'stacked')}>Stacked bars</button
				>
				<button
					class="toggle-btn"
					class:active={chartType === 'separated'}
					onclick={() => (chartType = 'separated')}>Own bases</button
				>
			</div>
		</div>

		<div class="sidebar-section">
			<h3 class="section-label">Legend</h3>
			{#each OUTCOME_ORDER as outcome (outcome)}
				<div class="legend-item">
					<span class="legend-swatch" style="background:{OUTCOME_COLORS[outcome]}"></span>
					<span class="legend-label">{OUTCOME_LABELS[outcome]}</span>
				</div>
			{/each}
		</div>
	</aside>

	<div class="chart-area" bind:this={wrapperEl}>
		<h2 class="chart-title">{chartTitle}</h2>
		{#if plotSvg}
			<PlotComponent svgElement={plotSvg} />
		{:else if facetSvgs}
			<div class="facet-stack">
				{#each OUTCOME_ORDER as outcome, i (outcome)}
					<div class="facet-item">
						<div class="facet-label" style="color: {OUTCOME_COLORS[outcome]}">
							{OUTCOME_LABELS[outcome]}
						</div>
						<PlotComponent svgElement={facetSvgs[i]} />
					</div>
				{/each}
			</div>
		{/if}
		<p class="chart-source">Source : UNSC Votes Since 1946 Database, v.1 (2026)</p>
	</div>
</div>

<style>
	.chart-title {
		font-size: 0.95rem;
		font-weight: 600;
		line-height: 1.3;
		color: var(--text);
		margin: 0;
	}

	.chart-source {
		font-size: 0.68rem;
		color: var(--text-muted);
		margin: 0;
	}

	.trends-layout {
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

	.facet-stack {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 0.75rem;
	}

	.facet-label {
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		line-height: 1.2;
		padding-left: 50px;
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
	}

	.toggle-group {
		display: flex;
		border: 1px solid var(--border-strong);
		border-radius: 6px;
		overflow: hidden;
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

	.toggle-btn:last-child {
		border-right: none;
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
	}

	@media (max-width: 768px) {
		.trends-layout {
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
