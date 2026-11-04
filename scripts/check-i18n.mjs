// Run with: npm run check:i18n
// 1) every locale must have exactly the same keys as English
// 2) every t('some.key') used in src/ must exist in English
// Catches missing/typo'd translations before users do.
import fs from 'node:fs';
import path from 'node:path';
import en from '../src/i18n/locales/en.js';
import ar from '../src/i18n/locales/ar.js';
import prs from '../src/i18n/locales/prs.js';
import ps from '../src/i18n/locales/ps.js';

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => (typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
const flatMap = (obj) => Object.fromEntries(Object.entries(obj).flatMap(([k, v]) => (typeof v === 'object' ? Object.entries(flatMap(v)).map(([k2, v2]) => [`${k}.${k2}`, v2]) : [[k, v]])));
const enFlat = flatMap(en);

const base = new Set(flatten(en));
let problems = 0;

for (const [name, dict] of Object.entries({ ar, prs, ps })) {
  const keys = new Set(flatten(dict));
  for (const k of base) if (!keys.has(k)) { console.log(`[${name}] missing: ${k}`); problems++; }
  for (const k of keys) if (!base.has(k)) { console.log(`[${name}] extra:   ${k}`); problems++; }
  // placeholders must match ({count}, {name}...) or the sentence breaks
  const flat = flatMap(dict);
  for (const k of base) {
    const a = (enFlat[k].match(/\{\w+\}/g) || []).sort().join();
    const b = ((flat[k] || '').match(/\{\w+\}/g) || []).sort().join();
    if (a !== b) { console.log(`[${name}] placeholder mismatch in ${k}: en(${a}) vs (${b})`); problems++; }
  }
}

// Scan source for static t('...') calls. Dynamic keys (template strings) are skipped.
const used = new Map();
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { if (f.name !== 'locales') walk(p); continue; }
    if (!/\.(jsx?|mjs)$/.test(f.name)) continue;
    const src = fs.readFileSync(p, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'([\w.]+)'/g)) used.set(m[1], p);
    for (const m of src.matchAll(/\bkey:\s*'([\w.]+)'/g)) if (/^[a-z]+\.[\w.]+$/.test(m[1])) used.set(m[1], p);
  }
})('src');
for (const [k, file] of used) {
  if (!base.has(k)) { console.log(`unknown key ${k}  (${file})`); problems++; }
}

console.log(problems ? `\n${problems} i18n problem(s)` : `i18n OK — ${base.size} keys × 4 languages, ${used.size} static keys used in code`);
process.exit(problems ? 1 : 0);
