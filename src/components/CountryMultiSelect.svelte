<script>
	import { P5, formatCountryName } from '$lib/countries.js';

	/**
	 * @type {{
	 *   available: Set<string>,
	 *   selected?: Set<string>,
	 *   defaultSelected?: Set<string> | null
	 * }}
	 */
	let { available, selected = $bindable(new Set()), defaultSelected = null } = $props();

	let open = $state(false);
	let search = $state('');
	/** @type {HTMLElement | null} */
	let rootEl = $state(null);

	// Close dropdown on outside click.
	// Intentional side-effect: DOM event listener that mutates `open`.
	$effect(() => {
		if (!open) return;
		/** @param {MouseEvent} e */
		function onDown(e) {
			if (rootEl && !rootEl.contains(/** @type {Node} */ (e.target))) {
				open = false;
			}
		}
		document.addEventListener('mousedown', onDown);
		return () => document.removeEventListener('mousedown', onDown);
	});

	const groups = $derived.by(() => {
		const q = search.trim().toLowerCase();
		const avail = [...available].filter((c) =>
			q ? formatCountryName(c).toLowerCase().includes(q) : true
		);
		const p5 = P5.filter((c) => avail.includes(c));
		const others = avail.filter((c) => !P5.includes(c)).sort();
		return { p5, others };
	});

	/** @param {string} name */
	function toggle(name) {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local copy, reassigned to `selected`
		const next = new Set(selected);
		if (next.has(name)) {
			next.delete(name);
		} else {
			next.add(name);
		}
		selected = next;
	}

	function selectAll() {
		selected = new Set(available);
	}

	// "Reset" restores the caller's default selection when one is provided
	// (Compare tab); otherwise it clears to an empty set (Browse tab).
	function reset() {
		selected = defaultSelected ? new Set(defaultSelected) : new Set();
	}

	// Empty the selection. On the Compare tab this is distinct from "Reset":
	// it lets the user start from scratch rather than from the default ten
	// countries (creator's remark #5).
	function clearAll() {
		selected = new Set();
	}
</script>

<div class="country-filter" bind:this={rootEl}>
	<button
		class="country-trigger"
		class:has-selection={selected.size > 0}
		onclick={() => (open = !open)}
		aria-expanded={open}
		aria-haspopup="listbox"
	>
		{selected.size === 0 ? 'All countries' : `${selected.size} selected`}
		<span class="chevron" class:open>&#x25BE;</span>
	</button>

	{#if open}
		<div class="country-dropdown" role="dialog" aria-label="Select countries">
			<div class="dropdown-search">
				<input
					type="search"
					placeholder="Search countries…"
					bind:value={search}
					autocomplete="off"
				/>
			</div>
			<div class="dropdown-actions">
				<button onclick={selectAll}>Select all</button>
				<button onclick={reset}>{defaultSelected ? 'Reset' : 'Clear'}</button>
				{#if defaultSelected}
					<button onclick={clearAll}>Clear all</button>
				{/if}
			</div>
			<div class="country-list" role="listbox" aria-multiselectable="true">
				{#if groups.p5.length > 0}
					<div class="group-label">Permanent members (P5)</div>
					{#each groups.p5 as country (country)}
						<label class="country-item p5-item">
							<input
								type="checkbox"
								checked={selected.has(country)}
								onchange={() => toggle(country)}
							/>
							<span class="p5-dot" title="Permanent member"></span>
							{formatCountryName(country)}
						</label>
					{/each}
				{/if}
				{#if groups.others.length > 0}
					<div class="group-label">Elected members</div>
					{#each groups.others as country (country)}
						<label class="country-item">
							<input
								type="checkbox"
								checked={selected.has(country)}
								onchange={() => toggle(country)}
							/>
							{formatCountryName(country)}
						</label>
					{/each}
				{/if}
				{#if groups.p5.length === 0 && groups.others.length === 0}
					<div class="no-results">No countries found</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
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

	.p5-dot {
		display: inline-block;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #b45309;
		flex-shrink: 0;
	}
</style>
