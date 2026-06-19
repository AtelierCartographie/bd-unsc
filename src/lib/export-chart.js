// Chart export — turn the on-screen Observable Plot chart(s) into a downloadable
// PNG or SVG, with zero runtime dependencies.
//
// The chart that the reader sees is assembled from several separate pieces:
//   • an adaptive title (HTML <h2>)
//   • the legend (lives in the sidebar, *outside* the chart)
//   • one or several Plot <svg> elements (e.g. the "Own bases" facet stack)
//   • a source line (HTML <p>)
//
// Rather than scrape the DOM or pull in an html-to-image library, we rebuild a
// single self-contained <svg> from the pieces we already hold in JS (title
// string, legend data, the live Plot <svg> nodes, source string), then:
//   • download it as-is for the vector (.svg) export, or
//   • paint it onto a <canvas> at 2× and export a raster (.png).
//
// The site's font (Atkinson Hyperlegible — an accessibility choice) is inlined
// as a base64 @font-face so both exports match the page exactly. A standalone
// SVG, and an SVG rasterised through an <img>, have no access to the page's web
// fonts, so the bytes must travel inside the file. The woff2 is fetched lazily
// on the first export (≈50 KB) — nothing is added to the initial page load.

// Vite resolves these to hashed asset URLs at build time (works in dev and in
// the static build). They are only ever fetched when the user clicks "export".
import latinWoff2Url from '@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2?url';
import latinExtWoff2Url from '@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-ext-wght-normal.woff2?url';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Same stack as the page (`html` in +layout.svelte). The embedded @font-face
// supplies the first family; the rest are fallbacks should embedding ever fail.
const FONT_STACK =
	"'Atkinson Hyperlegible Next Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MEASURE_FAMILY = "'Atkinson Hyperlegible Next Variable', system-ui, sans-serif";

// Mirror the page palette (+layout.svelte :root). The export is light-theme only.
const COLOR_TEXT = '#111827';
const COLOR_MUTED = '#6b7280';
const COLOR_BG = '#ffffff';

const PAD = 24; // outer padding around the whole image

// ── Font embedding (lazy, memoised) ──────────────────────────────────────────

// The unicode-ranges mirror the fontsource index.css so each subset only claims
// the codepoints it actually covers (latin = U+0000–00FF incl. accents; ext =
// the rest). Without them the two faces would fight over overlapping glyphs.
const LATIN_RANGE =
	'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT_RANGE =
	'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

/** @type {Promise<string> | null} */
let fontCssPromise = null;

/**
 * Fetch a binary asset and return its base64 encoding.
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchAsBase64(url) {
	const res = await fetch(url);
	const bytes = new Uint8Array(await res.arrayBuffer());
	let binary = '';
	const CHUNK = 0x8000; // avoid blowing the call-stack on apply()
	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode.apply(null, /** @type {any} */ (bytes.subarray(i, i + CHUNK)));
	}
	return btoa(binary);
}

/**
 * Build (once) the `@font-face` CSS with the Atkinson woff2 files inlined as
 * base64 data URLs. Memoised so repeated exports reuse the same fetch.
 * @returns {Promise<string>}
 */
function getFontFaceCss() {
	if (!fontCssPromise) {
		fontCssPromise = Promise.all([
			fetchAsBase64(latinWoff2Url),
			fetchAsBase64(latinExtWoff2Url)
		]).then(([latin, ext]) => {
			const face = (/** @type {string} */ b64, /** @type {string} */ range) =>
				`@font-face{font-family:'Atkinson Hyperlegible Next Variable';font-style:normal;` +
				`font-weight:200 800;src:url(data:font/woff2;base64,${b64}) format('woff2');` +
				`unicode-range:${range};}`;
			return face(latin, LATIN_RANGE) + face(ext, LATIN_EXT_RANGE);
		});
	}
	return fontCssPromise;
}

// ── Small SVG builders ────────────────────────────────────────────────────────

/**
 * @param {string} content
 * @param {number} x
 * @param {number} y - text baseline
 * @param {{ size: number, weight?: number, fill: string, anchor?: string }} opts
 */
function svgText(content, x, y, { size, weight, fill, anchor }) {
	const t = document.createElementNS(SVG_NS, 'text');
	t.setAttribute('x', String(x));
	t.setAttribute('y', String(y));
	t.setAttribute('font-size', String(size));
	if (weight) t.setAttribute('font-weight', String(weight));
	t.setAttribute('fill', fill);
	if (anchor) t.setAttribute('text-anchor', anchor);
	t.textContent = content;
	return t;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {string} fill
 * @param {number} [rx]
 * @param {string} [stroke]
 */
function svgRect(x, y, w, h, fill, rx, stroke) {
	const r = document.createElementNS(SVG_NS, 'rect');
	r.setAttribute('x', String(x));
	r.setAttribute('y', String(y));
	r.setAttribute('width', String(w));
	r.setAttribute('height', String(h));
	r.setAttribute('fill', fill);
	if (rx) r.setAttribute('rx', String(rx));
	if (stroke) r.setAttribute('stroke', stroke);
	return r;
}

// ── Text measurement & wrapping ────────────────────────────────────────────────

let measureCtx = /** @type {CanvasRenderingContext2D | null} */ (null);
function getMeasureCtx() {
	if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
	return /** @type {CanvasRenderingContext2D} */ (measureCtx);
}

/**
 * Greedy word-wrap against a pixel width, measured with the real page font.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} maxWidth
 * @returns {string[]}
 */
function wrapText(ctx, text, maxWidth) {
	const words = String(text).split(/\s+/).filter(Boolean);
	/** @type {string[]} */
	const lines = [];
	let line = '';
	for (const word of words) {
		const test = line ? `${line} ${word}` : word;
		if (line && ctx.measureText(test).width > maxWidth) {
			lines.push(line);
			line = word;
		} else {
			line = test;
		}
	}
	if (line) lines.push(line);
	return lines.length ? lines : [''];
}

// ── Chart <svg> preparation ─────────────────────────────────────────────────────

/**
 * Natural pixel size of a Plot-produced <svg>. Plot sets numeric width/height
 * attributes; fall back to the rendered box if they're ever missing.
 * @param {SVGSVGElement} svg
 */
function readDims(svg) {
	const box = svg.getBoundingClientRect();
	const w = Number(svg.getAttribute('width')) || box.width || 600;
	const h = Number(svg.getAttribute('height')) || box.height || 400;
	return { w, h };
}

/**
 * Clone a live Plot <svg> and pin it to an exact position/size so it nests
 * deterministically inside the master SVG (and rasterises cleanly).
 * @param {SVGSVGElement} src
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 */
function prepareChartClone(src, x, y, w, h) {
	const clone = /** @type {SVGSVGElement} */ (src.cloneNode(true));
	// Drop the (invisible-at-rest) hover tooltip layer so an export taken
	// mid-hover never captures a stray tip.
	for (const tip of clone.querySelectorAll('[aria-label="tip"]')) tip.remove();
	clone.setAttribute('x', String(x));
	clone.setAttribute('y', String(y));
	clone.setAttribute('width', String(w));
	clone.setAttribute('height', String(h));
	clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
	// Plot's root style is responsive (max-width:100%; height:auto) — fine in the
	// page, but it defeats fixed-size nesting and rasterisation. Pin it instead.
	clone.style.removeProperty('max-width');
	clone.style.removeProperty('height');
	clone.style.overflow = 'visible';
	return clone;
}

// ── Master SVG composition ──────────────────────────────────────────────────────

/**
 * @typedef {Object} ChartPiece
 * @property {SVGSVGElement} svg - a live Plot <svg> (will be cloned)
 * @property {string} [label] - optional heading above this chart (facet name)
 * @property {string} [labelColor] - colour for that heading
 * @property {number} [labelIndent] - left indent so the heading sits over the plot area
 */

/**
 * @typedef {Object} ExportData
 * @property {string} title
 * @property {string} [subtitle] - optional line under the title (e.g. active topic filter)
 * @property {{ color: string, label: string }[]} legend
 * @property {ChartPiece[]} charts
 * @property {string} source
 */

/**
 * Compose every piece into one standalone <svg>, with the font embedded.
 * @param {ExportData} data
 * @returns {Promise<{ svg: SVGSVGElement, width: number, height: number }>}
 */
async function buildMasterSvg(data) {
	// Measure with the real font; on a cold load it may not be ready yet.
	if (document.fonts?.ready) await document.fonts.ready;
	const ctx = getMeasureCtx();

	const dims = data.charts.map((c) => readDims(c.svg));
	const contentW = Math.max(360, ...dims.map((d) => d.w));
	const width = contentW + PAD * 2;

	/** @type {SVGElement[]} */
	const nodes = [];
	let y = PAD; // running top of the next block

	// Title — wrapped, 15px / 600.
	ctx.font = `600 15px ${MEASURE_FAMILY}`;
	for (const line of wrapText(ctx, data.title, contentW)) {
		nodes.push(svgText(line, PAD, y + 15 * 0.8, { size: 15, weight: 600, fill: COLOR_TEXT }));
		y += 20;
	}
	y += 4;

	// Subtitle — e.g. the active topic filter. 13px / muted.
	if (data.subtitle) {
		ctx.font = `400 13px ${MEASURE_FAMILY}`;
		for (const line of wrapText(ctx, data.subtitle, contentW)) {
			nodes.push(svgText(line, PAD, y + 13 * 0.8, { size: 13, fill: COLOR_MUTED }));
			y += 18;
		}
	}
	y += 6;

	// Legend — horizontal swatches that wrap to new rows when they run past the width.
	if (data.legend.length) {
		ctx.font = `400 13px ${MEASURE_FAMILY}`;
		const ROW_H = 18;
		const SW = 12; // swatch side
		const GAP_SL = 7; // swatch → label
		const GAP_ITEM = 20; // item → next item
		let x = PAD;
		let rowTop = y;
		for (const item of data.legend) {
			const labelW = ctx.measureText(item.label).width;
			const itemW = SW + GAP_SL + labelW;
			if (x > PAD && x + itemW > PAD + contentW) {
				x = PAD;
				rowTop += ROW_H;
			}
			nodes.push(svgRect(x, rowTop + (ROW_H - SW) / 2, SW, SW, item.color, 3, 'rgba(0,0,0,0.08)'));
			nodes.push(svgText(item.label, x + SW + GAP_SL, rowTop + 13, { size: 13, fill: COLOR_TEXT }));
			x += itemW + GAP_ITEM;
		}
		y = rowTop + ROW_H + 14;
	}

	// Charts — each optionally preceded by a coloured heading (facet name).
	data.charts.forEach((c, i) => {
		const { w, h } = dims[i];
		if (c.label) {
			ctx.font = `700 13px ${MEASURE_FAMILY}`;
			nodes.push(
				svgText(c.label, PAD + (c.labelIndent ?? 0), y + 13 * 0.8, {
					size: 13,
					weight: 700,
					fill: c.labelColor ?? COLOR_TEXT
				})
			);
			y += 18;
		}
		nodes.push(prepareChartClone(c.svg, PAD, y, w, h));
		y += h + 16;
	});
	y -= 16; // remove the trailing inter-chart gap

	// Source — small, muted.
	y += 14;
	ctx.font = `400 11px ${MEASURE_FAMILY}`;
	for (const line of wrapText(ctx, data.source, contentW)) {
		nodes.push(svgText(line, PAD, y + 11 * 0.8, { size: 11, fill: COLOR_MUTED }));
		y += 15;
	}

	const height = Math.ceil(y + PAD - 6);

	const svg = document.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('xmlns', SVG_NS);
	svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
	svg.setAttribute('width', String(width));
	svg.setAttribute('height', String(height));
	svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
	// font-family cascades into the nested Plot <svg>s, whose text uses `inherit`.
	svg.setAttribute('font-family', FONT_STACK);

	// Embedded font first, then a white backdrop, then the content.
	const style = document.createElementNS(SVG_NS, 'style');
	style.textContent = await getFontFaceCss();
	svg.appendChild(style);
	svg.appendChild(svgRect(0, 0, width, height, COLOR_BG));
	for (const n of nodes) svg.appendChild(n);

	return { svg, width, height };
}

// ── Output ───────────────────────────────────────────────────────────────────────

/**
 * @param {SVGSVGElement} svg
 * @returns {string}
 */
function serialize(svg) {
	return new XMLSerializer().serializeToString(svg);
}

/**
 * @param {Blob} blob
 * @param {string} filename
 */
function downloadBlob(blob, filename) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Paint a serialised SVG onto a canvas and return a PNG blob. Everything inside
 * the SVG is inlined (font + styles), so the canvas is never tainted.
 * @param {string} xml
 * @param {number} width
 * @param {number} height
 * @param {number} scale
 * @returns {Promise<Blob>}
 */
function rasterize(xml, width, height, scale) {
	const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(xml)))}`;
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = Math.round(width * scale);
			canvas.height = Math.round(height * scale);
			const ctx = canvas.getContext('2d');
			if (!ctx) return reject(new Error('2D canvas context unavailable'));
			ctx.fillStyle = COLOR_BG;
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.setTransform(scale, 0, 0, scale, 0, 0);
			ctx.drawImage(img, 0, 0);
			canvas.toBlob(
				(blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
				'image/png'
			);
		};
		img.onerror = () => reject(new Error('Failed to render SVG for rasterisation'));
		img.src = dataUrl;
	});
}

/**
 * Build the composite chart image and trigger a download.
 * @param {ExportData & { filename: string, format: 'png' | 'svg', scale?: number }} opts
 */
export async function exportChart({
	title,
	subtitle,
	legend,
	charts,
	source,
	filename,
	format,
	scale = 2
}) {
	if (!charts?.length) return; // nothing rendered yet
	const { svg, width, height } = await buildMasterSvg({ title, subtitle, legend, charts, source });
	const xml = serialize(svg);

	if (format === 'svg') {
		downloadBlob(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }), `${filename}.svg`);
		return;
	}

	// Keep the raster within canvas limits for very tall charts (e.g. all states).
	const safeScale = Math.min(scale, 16000 / Math.max(width, height));
	const blob = await rasterize(xml, width, height, Math.max(1, safeScale));
	downloadBlob(blob, `${filename}.png`);
}
