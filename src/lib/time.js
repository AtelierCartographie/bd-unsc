// Time helpers for the app's month-index model.
//
// The whole UI represents time as an integer month index where
// month 0 = January 1946 and month 959 = December 2025.

export const BASE_YEAR = 1946;

/** First selectable month index (Jan 1946). */
export const MONTH_MIN = 0;

/** Last selectable month index (Dec 2025). */
export const MONTH_MAX = 959;

export const MONTHS = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec'
];

/**
 * Month index → `YYYY-MM` string.
 * @param {number} n
 */
export function monthToYM(n) {
	const year = BASE_YEAR + Math.floor(n / 12);
	const month = String((n % 12) + 1).padStart(2, '0');
	return `${year}-${month}`;
}

/**
 * Month index → human label, e.g. `Mar 1998`.
 * @param {number} n
 */
export function monthLabel(n) {
	return `${MONTHS[n % 12]} ${BASE_YEAR + Math.floor(n / 12)}`;
}

/**
 * Month index → calendar year.
 * @param {number} n
 */
export function monthToYear(n) {
	return BASE_YEAR + Math.floor(n / 12);
}
