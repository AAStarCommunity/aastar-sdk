#!/usr/bin/env node
// Make TypeDoc / SDK markdown safe for VitePress's Vue compiler.
//
// TypeDoc and hand-written doc comments emit angle-bracket placeholders in prose
// — e.g. "Authorization: Bearer <jwt>", "<email>", "Promise<void>", "<T>",
// "<string, number>". VitePress runs Markdown through Vue's template compiler,
// which reads those as (unclosed / invalid) HTML tags and fails the build.
//
// This pass escapes angle brackets that look like tags but are NOT real HTML
// elements, leaving genuine HTML (badges, layout) and all code (fenced blocks +
// inline `code`) untouched. Idempotent: already-escaped &lt;/&gt; won't re-match.
//
// Usage: node sanitize-typedoc-md.cjs <dir> [<dir> ...]
const fs = require('fs'), path = require('path');

const HTML = new Set([
  'a','abbr','b','blockquote','br','center','code','details','div','em','font',
  'h1','h2','h3','h4','h5','h6','hr','i','img','kbd','li','mark','ol','p',
  'picture','pre','s','source','span','strong','sub','summary','sup','table',
  'tbody','td','th','thead','tr','u','ul','video',
]);

let count = 0;
function walk(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.md')) fix(p);
  }
}
function fix(p) {
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  let inFence = false, changed = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) { inFence = !inFence; continue; }
    if (inFence) continue;
    const parts = lines[i].split(/(`[^`]*`)/); // keep inline code spans intact
    for (let j = 0; j < parts.length; j++) {
      if (parts[j].startsWith('`')) continue;
      const ne = parts[j].replace(
        /<(\/?)([A-Za-z][\w-]*)([^>]*)>/g,
        (m, slash, name, rest) =>
          HTML.has(name.toLowerCase()) ? m : `&lt;${slash}${name}${rest}&gt;`
      );
      if (ne !== parts[j]) { parts[j] = ne; changed = true; }
    }
    lines[i] = parts.join('');
  }
  if (changed) { fs.writeFileSync(p, lines.join('\n')); count++; }
}

const dirs = process.argv.slice(2);
if (dirs.length === 0) { console.error('usage: sanitize-typedoc-md.cjs <dir> ...'); process.exit(1); }
for (const d of dirs) walk(d);
console.log(`🧼 sanitized ${count} markdown file(s) for VitePress`);
