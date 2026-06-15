/**
 * Post-build patch: makes the compiled index.html work when opened
 * directly via file:// protocol (no server needed).
 *
 * Problem: SvelteKit's router uses window.location.href to determine the
 * current route. With file://, that URL contains the full filesystem path
 * (e.g. /Users/foo/build/index.html), which doesn't match any defined route.
 *
 * Fix: inject a small script that runs before SvelteKit and overrides the
 * URL constructor so .pathname always returns '/' on file:// protocol.
 *
 * Also inlines the favicon as a data URI: the fallback page references it with
 * an absolute /favicon.svg path that doesn't resolve under file://, so without
 * this the page is the only file the user needs to keep.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

// Path defaults to the offline build output; override with `node patch-html.js <path>`.
const htmlPath = process.argv[2] || 'build-offline/index.html';
let html = readFileSync(htmlPath, 'utf-8');

const patch = `<script>
(function () {
  if (location.protocol !== 'file:') return;
  var _URL = globalThis.URL;
  function FileURL(url, base) {
    var u = new _URL(url, base);
    if (u.protocol === 'file:') {
      try { Object.defineProperty(u, 'pathname', { get: function () { return '/'; }, configurable: true }); } catch (e) {}
      try { Object.defineProperty(u, 'search',   { get: function () { return ''; },  configurable: true }); } catch (e) {}
    }
    return u;
  }
  FileURL.prototype = _URL.prototype;
  Object.setPrototypeOf(FileURL, _URL);
  ['canParse', 'createObjectURL', 'revokeObjectURL'].forEach(function (m) {
    if (_URL[m]) FileURL[m] = _URL[m].bind(_URL);
  });
  globalThis.URL = FileURL;
})();
</script>`;

// Inject just before the first <script tag so it runs before SvelteKit
const firstScript = html.indexOf('<script');
if (firstScript === -1) {
	console.error('Could not find <script> tag in index.html');
	process.exit(1);
}

html = html.slice(0, firstScript) + patch + '\n' + html.slice(firstScript);

// Inline the favicon as a data URI so no external file is needed.
const faviconPath = join(dirname(htmlPath), 'favicon.svg');
if (existsSync(faviconPath)) {
	const dataUri = 'data:image/svg+xml;base64,' + readFileSync(faviconPath).toString('base64');
	html = html.replace(/href="[^"]*favicon\.svg"/g, `href="${dataUri}"`);
}

writeFileSync(htmlPath, html);
console.log(`${htmlPath} patched for file:// protocol`);
