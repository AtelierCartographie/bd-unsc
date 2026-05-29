// Single source of truth for the four vote outcomes.
//
// Everything else (display order, colours, labels, sort ranking, badge
// classes, filter options) is derived from the OUTCOMES list below so the
// categories only ever need to be edited in one place.
//
// NOTE: the colours here mirror the --adopted-*/--rejected-* CSS variables in
// +layout.svelte. Observable Plot needs the raw values in JS, while the badges
// use the CSS variables; keep the two palettes in sync.

/**
 * @typedef {{
 *   key: string,
 *   label: string,
 *   color: string,
 *   badgeClass: string,
 *   adopted: boolean
 * }} Outcome
 */

/** @type {Outcome[]} — also defines the canonical display/stacking order. */
export const OUTCOMES = [
	{
		key: 'adopted (unanimity)',
		label: 'Adopted (unanimity)',
		color: '#6abf89',
		badgeClass: 'badge-adopted-unanimity',
		adopted: true
	},
	{
		key: 'adopted (majority)',
		label: 'Adopted (majority)',
		color: '#b5cc6a',
		badgeClass: 'badge-adopted-majority',
		adopted: true
	},
	{
		key: 'not adopted (lack of majority)',
		label: 'Not adopted',
		color: '#e89050',
		badgeClass: 'badge-rejected-majority',
		adopted: false
	},
	{
		key: 'not adopted (veto)',
		label: 'Vetoed',
		color: '#d94f3d',
		badgeClass: 'badge-rejected-veto',
		adopted: false
	}
];

/** Outcome keys in canonical order. */
export const OUTCOME_ORDER = OUTCOMES.map((o) => o.key);

/** key → hex colour. */
export const OUTCOME_COLORS = /** @type {Record<string, string>} */ (
	Object.fromEntries(OUTCOMES.map((o) => [o.key, o.color]))
);

/** key → display label. */
export const OUTCOME_LABELS = /** @type {Record<string, string>} */ (
	Object.fromEntries(OUTCOMES.map((o) => [o.key, o.label]))
);

/** key → sort rank (position in OUTCOMES). */
export const OUTCOME_RANK = /** @type {Record<string, number>} */ (
	Object.fromEntries(OUTCOMES.map((o, i) => [o.key, i]))
);

/** key → badge CSS class. */
export const OUTCOME_BADGE_CLASS = /** @type {Record<string, string>} */ (
	Object.fromEntries(OUTCOMES.map((o) => [o.key, o.badgeClass]))
);

/** Keys of the outcomes that count as "adopted". */
export const ADOPTED_KEYS = OUTCOMES.filter((o) => o.adopted).map((o) => o.key);

/** Options for the outcome `<select>` filter (with an "all" entry first). */
export const OUTCOME_FILTER_OPTIONS = [
	{ value: 'all', label: 'All outcomes' },
	...OUTCOMES.map((o) => ({ value: o.key, label: o.label }))
];
