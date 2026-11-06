import { createHash, randomUUID } from 'node:crypto';

export const sha = value => createHash('sha256').update(String(value)).digest('hex');
export const shortHash = value => sha(value).slice(0, 12);
export const uuid = () => randomUUID();
export const nowIso = () => new Date().toISOString();
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** Collapse whitespace and unify quotes so literal quote checks survive HTML formatting noise. */
export function normalizeText(value) {
  return String(value ?? '')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when `quote` appears verbatim (after whitespace/quote normalisation) inside `text`. */
export function quoteIn(text, quote) {
  const q = normalizeText(quote).toLowerCase();
  if (q.length < 12) return false;
  return normalizeText(text).toLowerCase().includes(q);
}

export function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
}

/** Registrable-ish domain: last two labels, or three for common second-level suffixes (co.uk, com.au, co.in…). */
export function rootDomain(url) {
  const host = hostOf(url) ?? String(url ?? '').toLowerCase().replace(/^www\./, '');
  if (!host) return null;
  const parts = host.split('.');
  const twoLevel = /^(co|com|org|net|gov|edu|ac)$/.test(parts.at(-2) ?? '') && (parts.at(-1) ?? '').length === 2;
  return parts.slice(twoLevel ? -3 : -2).join('.');
}

export function slug(value, max = 40) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, max) || 'item';
}

/** Word shingles for near-duplicate (syndication) detection. */
export function shingles(text, size = 5) {
  const words = normalizeText(text).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(Boolean);
  const out = new Set();
  for (let i = 0; i + size <= words.length && out.size < 4000; i++) out.add(words.slice(i, i + size).join(' '));
  return out;
}

export function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  for (const item of small) if (large.has(item)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Tiny keyed async mutex so concurrent writers never interleave a read-modify-write on one file. */
const locks = new Map();
export async function withLock(key, fn) {
  const previous = locks.get(key) ?? Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  locks.set(key, previous.then(() => current));
  await previous;
  try { return await fn(); } finally {
    release();
    if (locks.get(key) === current) locks.delete(key);
  }
}

export function csv(rows, columns) {
  const cell = value => {
    const text = value === null || value === undefined ? '' : Array.isArray(value) ? value.join(' | ') :
      typeof value === 'object' ? JSON.stringify(value) : String(value);
    // Neutralise spreadsheet formula injection from scraped text.
    const safe = /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
    return /[",\n\r]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
  };
  return [columns.join(','), ...rows.map(row => columns.map(column => cell(row[column])).join(','))].join('\n') + '\n';
}

export const daysBetween = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;
