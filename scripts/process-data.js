import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const csvPath = join(__dirname, '../src/lib/data/Clean BD pour export – UNSC votes 1946-2025.csv');
const outDir = join(__dirname, '../static/data');
const outPath = join(outDir, 'votes.json');

function parseCSVRow(line) {
	const result = [];
	let field = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQuotes) {
			if (ch === '"') {
				if (line[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += ch;
			}
		} else {
			if (ch === '"') {
				inQuotes = true;
			} else if (ch === ',') {
				result.push(field);
				field = '';
			} else {
				field += ch;
			}
		}
	}
	result.push(field);
	return result;
}

const content = readFileSync(csvPath, 'utf-8');
const lines = content
	.split('\n')
	.map((l) => l.replace(/\r$/, ''))
	.filter((l) => l.trim());

const headers = parseCSVRow(lines[0]);

const idx = (name) => headers.indexOf(name);
const IDX = {
	id: idx('Vote in the DB'),
	ref: idx('UN classification'),
	resNum: idx('Resolution number'),
	date: idx('Date'),
	title: idx('Title-Observable'),
	outcome: idx('Vote outcome typology-Observable'),
	yes: idx('Yes'),
	no: idx('No'),
	abstentions: idx('Abstentions'),
	nonVoting: idx('Non-Voting'),
	veto: idx('(of which veto)')
};

// Country columns start after the numeric vote columns (index 14 onward)
const COUNTRY_START = 14;
const countryNames = headers.slice(COUNTRY_START);

const votes = lines
	.slice(1)
	.map((line) => {
		const row = parseCSVRow(line);
		const s = (i) => (row[i] ?? '').trim();
		const n = (i) => parseInt(s(i)) || 0;

		const date = s(IDX.date);
		const year = parseInt(date.slice(0, 4)) || 0;

		const rawTitle = s(IDX.title);
		const title = rawTitle.replace(/\]+$/, '').trimEnd();

		// Build sparse countries map (only non-empty entries)
		/** @type {Record<string, string>} */
		const countries = {};
		for (let ci = 0; ci < countryNames.length; ci++) {
			const v = (row[COUNTRY_START + ci] ?? '').trim();
			if (v) countries[countryNames[ci]] = v;
		}

		return {
			id: n(IDX.id),
			ref: s(IDX.ref),
			resNum: s(IDX.resNum),
			date,
			year,
			title,
			outcome: s(IDX.outcome),
			yes: n(IDX.yes),
			no: n(IDX.no),
			abstentions: n(IDX.abstentions),
			nonVoting: n(IDX.nonVoting),
			veto: n(IDX.veto),
			countries
		};
	})
	.filter((v) => v.id > 0);

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, JSON.stringify(votes));
writeFileSync(join(outDir, 'country-list.json'), JSON.stringify(countryNames));
console.log(`✓ ${votes.length} votes processed → ${outPath}`);
console.log(`✓ ${countryNames.length} countries → ${join(outDir, 'country-list.json')}`);
