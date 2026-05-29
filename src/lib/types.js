// Shared JSDoc typedefs for the UNSC votes app.
// Import in components with:
//   /** @typedef {import('$lib/types.js').Vote} Vote */

/**
 * A single UN Security Council vote, as stored in static/data/votes.json.
 * @typedef {{
 *   id: number,
 *   ref: string,
 *   resNum: string,
 *   date: string,
 *   year: number,
 *   title: string,
 *   outcome: string,
 *   yes: number,
 *   no: number,
 *   abstentions: number,
 *   nonVoting: number,
 *   veto: number,
 *   countries: Record<string, string>
 * }} Vote
 */

/**
 * One aggregated row used by the Trends charts: a (period, outcome) bucket.
 * @typedef {{
 *   period: string,
 *   x: number | Date,
 *   outcome: string,
 *   count: number,
 *   pct: number
 * }} AggRow
 */

export {};
