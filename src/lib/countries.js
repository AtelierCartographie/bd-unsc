// Country helpers shared across tabs.

/** The five permanent members of the Security Council. */
export const P5 = [
	'CHINA',
	'FRANCE',
	'RUSSIAN FEDERATION/USSR',
	'UNITED KINGDOM',
	'UNITED STATES'
];

/** Overrides for names that shouldn't be derived from the raw dataset value. */
export const COUNTRY_DISPLAY_NAMES = /** @type {Record<string, string>} */ ({
	'RUSSIAN FEDERATION/USSR': 'Russia /USSR',
	"CÔTE D'IVOIRE": "Côte d'Ivoire",
	"COTE D'IVOIRE": "Côte d'Ivoire",
	'EGYPT / UNITED ARAB REPUBLIC': 'Egypt /UAR',
	'GERMANY, FEDERAL REPUBLIC OF': 'Germany, Fed. Rep. of',
	'IRAN (ISLAMIC REPUBLIC OF)': 'Iran',
	'LIBYAN ARAB JAMAHIRIYA': 'Libya',
	'SAINT VINCENT AND THE GRENADINES': 'St. Vincent and the Grenadines',
	'SRI LANKA/CEYLAN': 'Sri Lanka /Ceylan',
	'SYRIAN ARAB REPUBLIC': 'Syria',
	'TRINIDAD AND TOBAGO': 'Trinidad and Tobago',
	'UNITED ARAB EMIRATES': 'Emirates (UAE)',
	'UNITED REPUBLIC OF TANZANIA': 'Tanzania'
});

/**
 * Turn a raw dataset country name into a display label.
 * Uses an explicit override when available, otherwise title-cases the value.
 * @param {string} name
 */
export function formatCountryName(name) {
	if (name in COUNTRY_DISPLAY_NAMES) return COUNTRY_DISPLAY_NAMES[name];
	// Capitalise first letter after start-of-string, whitespace, slash, open-paren or hyphen
	return name.toLowerCase().replace(/(?:^|[\s/(-])(\w)/g, (match, c) => {
		return match.slice(0, -1) + c.toUpperCase();
	});
}
