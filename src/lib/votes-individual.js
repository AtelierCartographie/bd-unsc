// Single source of truth for the six individual-vote categories used on the
// "Compare States' votes" tab.
//
// The raw dataset stores one code per country per resolution
// (Y / A / N / NV / ?). Those codes are mapped to the categories below, which
// add the politically meaningful split between a plain "No" and a P5 "Veto".
//
// Like outcomes.js, everything (order, colours, labels, colour scale) is
// derived from the VOTE_CATEGORIES list so the categories only ever need to be
// edited in one place. The palette mirrors the hand-picked swatches for this
// tab (blue → light pink → magenta → dark magenta → grey), with an extra very
// light grey for the rare "not recorded" entries (council votes of 1947–48).

import { P5 } from './countries.js';

/**
 * @typedef {{
 *   key: string,
 *   label: string,
 *   color: string
 * }} VoteCategory
 */

/**
 * @type {VoteCategory[]} — canonical display/stacking order, matching the
 * "Yes · Abs · No · Veto · ∅" order of the source sketch.
 */
export const VOTE_CATEGORIES = [
	{ key: 'yes', label: 'Yes', color: '#54B3E4' },
	{ key: 'abstention', label: 'Abstention', color: '#ECB2C5' },
	{ key: 'no', label: 'No', color: '#D84D86' },
	{ key: 'veto', label: 'Veto', color: '#8B1A4F' },
	{ key: 'nonParticipation', label: 'Did not participate', color: '#C8C8CC' },
	{ key: 'notRecorded', label: 'Not recorded', color: '#E6E6E6' }
];

/** Category keys in canonical order. */
export const VOTE_ORDER = VOTE_CATEGORIES.map((c) => c.key);

/** key → hex colour. */
export const VOTE_COLORS = /** @type {Record<string, string>} */ (
	Object.fromEntries(VOTE_CATEGORIES.map((c) => [c.key, c.color]))
);

/** key → display label. */
export const VOTE_LABELS = /** @type {Record<string, string>} */ (
	Object.fromEntries(VOTE_CATEGORIES.map((c) => [c.key, c.label]))
);

/** key → short label, for cramped axis headers (the "Yes · Abs · No · Veto · ∅" row). */
export const VOTE_SHORT_LABELS = /** @type {Record<string, string>} */ ({
	yes: 'Yes',
	abstention: 'Abs.',
	no: 'No',
	veto: 'Veto',
	nonParticipation: 'Absent',
	notRecorded: 'N/R'
});

/** Colour scale mapping vote categories → their canonical colours. */
export const VOTE_COLOR_SCALE = {
	domain: VOTE_ORDER,
	range: VOTE_ORDER.map((k) => VOTE_COLORS[k])
};

/**
 * The opposition categories — used by the "opposition only" chrono variant,
 * which drops the dominant "Yes" (and the non-substantive participation
 * categories) to surface dissent.
 */
export const OPPOSITION_KEYS = ['abstention', 'no', 'veto'];

const P5_SET = new Set(P5);

/**
 * Map an individual country vote code to a vote category key.
 *
 * The only non-trivial case is "N": a "No" cast by a permanent member on a
 * resolution whose outcome is "not adopted (veto)" is a veto; every other "No"
 * (elected members, or P5 "No" votes that did not block adoption) stays a
 * plain "No".
 *
 * @param {string} code     raw code: Y | A | N | NV | ?
 * @param {string} country  raw dataset country name
 * @param {string} outcome  the resolution's outcome key
 * @returns {string} a VOTE_ORDER key
 */
export function classifyVote(code, country, outcome) {
	switch (code) {
		case 'Y':
			return 'yes';
		case 'A':
			return 'abstention';
		case 'NV':
			return 'nonParticipation';
		case 'N':
			return P5_SET.has(country) && outcome === 'not adopted (veto)' ? 'veto' : 'no';
		case '?':
		default:
			return 'notRecorded';
	}
}
