<script>
	import { exportChart } from '$lib/export-chart.js';

	/**
	 * @typedef {import('$lib/export-chart.js').ExportData} ExportData
	 * @typedef {{
	 *   filename: string,
	 *   getData: () => ExportData,
	 *   disabled?: boolean
	 * }} Props
	 */

	/** @type {Props} */
	let { filename, getData, disabled = false } = $props();

	let busy = $state(false);

	/** @param {'png' | 'svg'} format */
	async function run(format) {
		if (busy || disabled) return;
		busy = true;
		try {
			await exportChart({ ...getData(), filename, format });
		} catch (err) {
			console.error('Chart export failed', err);
		} finally {
			busy = false;
		}
	}
</script>

<div class="export-group" role="group" aria-label="Download this chart">
	<span class="export-icon" aria-hidden="true">
		<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6">
			<path d="M8 1.5v8.5M4.5 6.5 8 10l3.5-3.5" stroke-linecap="round" stroke-linejoin="round" />
			<path d="M2.5 11.5v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-1.5" stroke-linecap="round" />
		</svg>
	</span>
	<button type="button" onclick={() => run('png')} disabled={busy || disabled}>PNG</button>
	<button type="button" onclick={() => run('svg')} disabled={busy || disabled}>SVG</button>
</div>

<style>
	.export-group {
		display: inline-flex;
		align-items: stretch;
		border: 1px solid var(--border-strong);
		border-radius: 6px;
		overflow: hidden;
		flex-shrink: 0;
	}

	.export-icon {
		display: flex;
		align-items: center;
		padding: 0 0.45rem;
		color: var(--text-muted);
		background: var(--surface);
		border-right: 1px solid var(--border-strong);
	}

	button {
		padding: 0.35rem 0.6rem;
		background: none;
		border: none;
		border-right: 1px solid var(--border-strong);
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text-muted);
		transition:
			background 0.1s,
			color 0.1s;
	}

	button:last-child {
		border-right: none;
	}

	button:hover:not(:disabled) {
		background: #e6edfb;
		color: var(--accent);
	}

	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>
