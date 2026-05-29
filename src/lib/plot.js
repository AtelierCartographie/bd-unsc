// Shared Observable Plot configuration for the chart tabs.

import * as Plot from '@observablehq/plot';
import { OUTCOME_ORDER, OUTCOME_COLORS } from './outcomes.js';

/** Common typography passed to every `Plot.plot({ style })`. */
export const PLOT_STYLE = { fontFamily: 'inherit', fontSize: '12px' };

/** Left margin shared by all charts (room for the y-axis labels). */
export const PLOT_MARGIN_LEFT = 50;

/** Colour scale mapping outcomes → their canonical colours. */
export const OUTCOME_COLOR_SCALE = {
	domain: OUTCOME_ORDER,
	range: OUTCOME_ORDER.map((o) => OUTCOME_COLORS[o])
};

/**
 * Build the adaptive x-axis marks for a time chart.
 *
 * The density of ticks adapts to the time step and the span of the domain:
 *   annual, ≤ 10 yrs  → label ×1 year
 *   annual, > 10 yrs  → auto ticks (d3 nice) + minor ×1 year
 *   monthly, ≤ 5 yrs  → label ×1 year + minor ×1 month
 *   monthly, > 5 yrs  → auto ticks (d3 nice) + minor ×1 year
 *
 * @param {'annual' | 'monthly'} step
 * @param {number} fromMonth
 * @param {number} toMonth
 */
export function buildXMarks(step, fromMonth, toMonth) {
	const domainYears = (toMonth - fromMonth) / 12;
	if (step === 'annual') {
		return domainYears <= 10
			? [Plot.axisX({ interval: 1, tickSize: 10, tickPadding: 5, tickFormat: 'd' })]
			: [
					Plot.axisX({
						ticks: Math.max(4, Math.round(domainYears / 8)),
						tickSize: 10,
						tickPadding: 5,
						tickFormat: 'd'
					}),
					Plot.axisX({ interval: 1, tickSize: 5, tickFormat: () => '' })
				];
	}
	return domainYears <= 5
		? [
				Plot.axisX({ interval: 'year', tickSize: 10, tickPadding: 5, tickFormat: '%Y' }),
				Plot.axisX({ interval: 'month', tickSize: 5, tickFormat: () => '' })
			]
		: [
				Plot.axisX({
					ticks: Math.max(4, Math.round(domainYears / 8)),
					tickSize: 10,
					tickPadding: 5,
					tickFormat: '%Y'
				}),
				Plot.axisX({ interval: 'year', tickSize: 5, tickFormat: () => '' })
			];
}
