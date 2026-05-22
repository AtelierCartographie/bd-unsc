<script>
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	/** @type {number} */
	const MIN = 0;
	/** @type {number} */
	const MAX = 959;

	let { from = $bindable(MIN), to = $bindable(MAX) } = $props();

	/** @param {number} n */
	function monthLabel(n) {
		return `${MONTHS[n % 12]} ${1946 + Math.floor(n / 12)}`;
	}

	const fromPct = $derived(((from - MIN) / (MAX - MIN)) * 100);
	const toPct = $derived(((to - MIN) / (MAX - MIN)) * 100);
	// When "from" is past 70% of the range, give it higher z-index so user can still drag it leftward
	const fromZ = $derived(from > MIN + (MAX - MIN) * 0.7 ? 4 : 2);
	const toZ = $derived(fromZ === 4 ? 3 : 4);
</script>

<div class="slider-outer">
	<div class="track-area">
		<div class="track-bg"></div>
		<div class="track-fill" style="left:{fromPct.toFixed(2)}%; right:{(100 - toPct).toFixed(2)}%"></div>
		<input
			type="range"
			min={MIN}
			max={MAX}
			step="1"
			value={from}
			class="thumb"
			style="z-index:{fromZ}"
			aria-label="Start month"
			oninput={(e) => {
				from = Math.min(+/** @type {HTMLInputElement} */ (e.currentTarget).value, to - 1);
			}}
		/>
		<input
			type="range"
			min={MIN}
			max={MAX}
			step="1"
			value={to}
			class="thumb"
			style="z-index:{toZ}"
			aria-label="End month"
			oninput={(e) => {
				to = Math.max(+/** @type {HTMLInputElement} */ (e.currentTarget).value, from + 1);
			}}
		/>
	</div>
	<div class="labels">
		<span>{monthLabel(from)}</span>
		<span>{monthLabel(to)}</span>
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
