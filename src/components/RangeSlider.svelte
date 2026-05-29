<script>
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	/** @type {{ from?: number, to?: number, granularity?: 'month' | 'year' }} */
	let { from = $bindable(0), to = $bindable(959), granularity = 'month' } = $props();

	const positionMax = $derived(granularity === 'year' ? 79 : 959);

	const fromPos = $derived(granularity === 'year' ? Math.floor(from / 12) : from);
	const toPos = $derived(granularity === 'year' ? Math.floor(to / 12) : to);

	/** @param {number} p */
	function label(p) {
		if (granularity === 'year') return String(1946 + p);
		return `${MONTHS[p % 12]} ${1946 + Math.floor(p / 12)}`;
	}

	const fromPct = $derived((fromPos / positionMax) * 100);
	const toPct = $derived((toPos / positionMax) * 100);
	const fromZ = $derived(fromPos > positionMax * 0.7 ? 4 : 2);
	const toZ = $derived(fromZ === 4 ? 3 : 4);

	/** @param {number} p */
	function applyFrom(p) {
		// In year mode, allow single-year selection (from == to); in month mode keep ≥1-month gap.
		const clamped = Math.min(p, granularity === 'year' ? toPos : toPos - 1);
		from = granularity === 'year' ? clamped * 12 : clamped;
	}

	/** @param {number} p */
	function applyTo(p) {
		const clamped = Math.max(p, granularity === 'year' ? fromPos : fromPos + 1);
		to = granularity === 'year' ? clamped * 12 + 11 : clamped;
	}
</script>

<div class="slider-outer">
	<div class="track-area">
		<div class="track-bg"></div>
		<div
			class="track-fill"
			style="left:{fromPct.toFixed(2)}%; right:{(100 - toPct).toFixed(2)}%"
		></div>
		<input
			type="range"
			min="0"
			max={positionMax}
			step="1"
			value={fromPos}
			class="thumb"
			style="z-index:{fromZ}"
			aria-label={granularity === 'year' ? 'Start year' : 'Start month'}
			oninput={(e) => applyFrom(+(/** @type {HTMLInputElement} */ (e.currentTarget)).value)}
		/>
		<input
			type="range"
			min="0"
			max={positionMax}
			step="1"
			value={toPos}
			class="thumb"
			style="z-index:{toZ}"
			aria-label={granularity === 'year' ? 'End year' : 'End month'}
			oninput={(e) => applyTo(+(/** @type {HTMLInputElement} */ (e.currentTarget)).value)}
		/>
	</div>
	<div class="labels">
		<span>{label(fromPos)}</span>
		<span>{label(toPos)}</span>
	</div>
</div>

<style>
	.slider-outer {
		width: 100%;
		padding-bottom: 0.25rem;
	}

	.track-area {
		position: relative;
		height: 1.5rem;
	}

	.track-bg,
	.track-fill {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		height: 4px;
		border-radius: 2px;
		pointer-events: none;
	}

	.track-bg {
		left: 0;
		right: 0;
		background: var(--border-strong);
	}

	.track-fill {
		background: var(--accent);
	}

	.thumb {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		padding: 0;
		background: transparent;
		pointer-events: none;
		appearance: none;
		-webkit-appearance: none;
		outline: none;
	}

	.thumb::-webkit-slider-runnable-track {
		background: transparent;
		height: 4px;
	}

	.thumb::-moz-range-track {
		background: transparent;
		height: 4px;
	}

	.thumb::-webkit-slider-thumb {
		appearance: none;
		-webkit-appearance: none;
		pointer-events: auto;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--accent);
		border: 2.5px solid white;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
		cursor: grab;
		margin-top: -7px;
	}

	.thumb::-webkit-slider-thumb:active {
		cursor: grabbing;
	}

	.thumb::-moz-range-thumb {
		pointer-events: auto;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--accent);
		border: 2.5px solid white;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
		cursor: grab;
	}

	.labels {
		display: flex;
		justify-content: space-between;
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-top: 0.35rem;
	}
</style>
