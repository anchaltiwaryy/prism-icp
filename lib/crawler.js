/**
 * Polite public-web collection (PRD §7 S4, §11). HTTPS only, SSRF-guarded, robots.txt respected,
 * same-site redirects only, bounded size and time. Pages are untrusted data: obvious prompt-injection
 * sentences are stripped and flagged before any model sees them.
 */
import dns from 'node:dns/promises';
import net from 'node:net';
import { load } from 'cheerio';
import robotsParser from 'robots-parser';
import { hostOf, normalizeText, rootDomain, sha } from './util.js';

export const USER_AGENT = 'PRISMResearchBot/0.4 (+local evidence research; respects robots.txt)';

const blockedIp = address => {
  if (net.isIP(address) === 6) {
    const lower = address.toLowerCase();
    if (lower.startsWith('::ffff:')) return blockedIp(lower.slice(7));
    return !(lower.startsWith('2') || lower.startsWith('3'));
  }
  const parts = address.split('.').map(Number);
  return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 || parts[0] >= 224 ||
    (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
    (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19));
};

export async function publicUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') ||
        net.isIP(url.hostname) || /(^|\.)(localhost|local|internal|lan|home|corp)$/i.test(url.hostname)) return null;
    url.hash = '';
    const addresses = await dns.lookup(url.hostname, {all: true});
    return addresses.length && addresses.every(item => !blockedIp(item.address)) ? url : null;
  } catch { return null; }
}

const robotsCache = new Map();
async function robotsAllowed(url) {
  const key = url.origin;
  if (!robotsCache.has(key)) {
    robotsCache.set(key, (async () => {
      try {
        const robotsUrl = new URL('/robots.txt', url);
        const response = await fetch(robotsUrl, {redirect: 'follow', signal: AbortSignal.timeout(8000), headers: {'user-agent': USER_AGENT}});
        if (response.status === 404 || response.status === 410) return null;
        if (!response.ok) return 'deny';
        return robotsParser(robotsUrl.href, (await response.text()).slice(0, 200000));
      } catch { return 'deny'; }
    })());
  }
  const robots = await robotsCache.get(key);
  if (robots === null) return true;
  if (robots === 'deny') return false;
  return robots.isAllowed(url.href, USER_AGENT) !== false;
}

const INJECTION = /(ignore|disregard|forget)\s+(all\s+|any\s+)?(previous|prior|above|earlier)\s+(instructions|prompts|messages)|you are now (an? )?(ai|assistant|chatbot)|system prompt|<\/?(system|assistant)>|act as (an? )?(ai|llm)|respond only with/i;

function sanitize(text) {
  let flagged = false;
  const cleaned = text.split(/(?<=[.!?])\s+/).filter(sentence => {
    if (INJECTION.test(sentence)) { flagged = true; return false; }
    return true;
  }).join(' ');
  return {text: cleaned, flagged};
}

function publishedDate($) {
  const candidates = [
    $('meta[property="article:published_time"]').attr('content'), $('meta[name="date"]').attr('content'),
    $('meta[name="publish-date"]').attr('content'), $('meta[itemprop="datePublished"]').attr('content'),
    $('time[datetime]').first().attr('datetime'),
  ];
  $('script[type="application/ld+json"]').each((_, element) => {
    const match = $(element).text().match(/"datePublished"\s*:\s*"([^"]+)"/);
    if (match) candidates.push(match[1]);
  });
  for (const value of candidates) {
    const time = Date.parse(value ?? '');
    if (Number.isFinite(time) && time < Date.now() + 86400000) return new Date(time).toISOString().slice(0, 10);
  }
  return null;
}

export function extractPage(html, url, adapter) {
  const $ = load(html);
  const published = publishedDate($);
  const description = normalizeText($('meta[name="description"]').attr('content') ?? $('meta[property="og:description"]').attr('content') ?? '');
  const lang = ($('html').attr('lang') ?? '').slice(0, 8) || null;
  $('script,style,noscript,nav,footer,svg,form,iframe,header [role="navigation"]').remove();
  const title = normalizeText($('title').first().text() || $('h1').first().text() || url.hostname);
  const main = $('main').first().text() || $('article').first().text() || $('body').text();
  const {text, flagged} = sanitize(normalizeText(main));
  const links = [...new Set($('a[href]').map((_, element) => {
    try { const link = new URL($(element).attr('href'), url); link.hash = ''; return link.href; } catch { return null; }
  }).get().filter(href => href?.startsWith('https://')))].slice(0, 400);
  const excerpt = (description && !text.includes(description) ? description + ' ' : '') + text;
  return {
    url: url.href, title: title.slice(0, 220), description: description.slice(0, 400), excerpt: excerpt.slice(0, 16000),
    links, adapter, host: hostOf(url.href), domain: rootDomain(url.href), lang, published,
    observed: new Date().toISOString(), contentHash: sha(normalizeText(text).toLowerCase()).slice(0, 32),
    injectionSuspected: flagged,
  };
}

const sameSite = (a, b) => rootDomain(a) === rootDomain(b);

async function fetchHtml(url) {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    const response = await fetch(current, {redirect: 'manual', signal: AbortSignal.timeout(15000),
      headers: {'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml'}});
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = await publicUrl(new URL(response.headers.get('location') ?? '', current).href);
      if (!next || !sameSite(next.href, url.href)) return {error: 'Cross-site or unsafe redirect'};
      if (!await robotsAllowed(next)) return {error: 'robots.txt disallows redirect target'};
      current = next;
      continue;
    }
    if (!response.ok) return {error: 'HTTP ' + response.status};
    const type = response.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml/.test(type)) return {error: 'Not HTML (' + type.split(';')[0] + ')'};
    const reader = response.body.getReader();
    const chunks = []; let size = 0;
    while (size < 1500000) {
      const {done, value} = await reader.read();
      if (done) break;
      chunks.push(value); size += value.length;
    }
    reader.cancel().catch(() => {});
    return {html: Buffer.concat(chunks).toString('utf8'), url: current};
  }
  return {error: 'Too many redirects'};
}

let browserPromise = null;
async function renderWithBrowser(url) {
  const {chromium} = await import('playwright');
  browserPromise ??= chromium.launch({headless: true}).catch(error => { browserPromise = null; throw error; });
  const browser = await browserPromise;
  const context = await browser.newContext({userAgent: USER_AGENT});
  try {
    await context.route('**/*', route => ['image', 'media', 'font', 'websocket'].includes(route.request().resourceType())
      ? route.abort() : route.continue());
    const tab = await context.newPage();
    await tab.goto(url.href, {waitUntil: 'domcontentloaded', timeout: 20000});
    await tab.waitForTimeout(800);
    if (!sameSite(tab.url(), url.href)) return {error: 'Cross-site redirect'};
    return {html: await tab.content(), url: new URL(tab.url())};
  } finally { await context.close(); }
}
export async function closeBrowser() {
  if (!browserPromise) return;
  try { await (await browserPromise).close(); } catch { /* already closed */ }
  browserPromise = null;
}

/** Fetch one public page. Returns {status:'collected', page} or {status:'skipped', reason}. */
export async function crawlPage(value, {browser = false} = {}) {
  const url = await publicUrl(value);
  if (!url) return {status: 'skipped', reason: 'Blocked URL (non-HTTPS, private or unresolvable)', url: value};
  if (!await robotsAllowed(url)) return {status: 'skipped', reason: 'robots.txt disallows', url: url.href};
  let fetched;
  try { fetched = await fetchHtml(url); } catch (error) { fetched = {error: error.name === 'TimeoutError' ? 'Timed out' : error.message}; }
  if (fetched.html) {
    const page = extractPage(fetched.html, fetched.url, 'http+cheerio');
    if (page.excerpt.length > 400 || !browser) {
      return page.excerpt.length > 80 ? {status: 'collected', page} : {status: 'skipped', reason: 'No readable text', url: url.href};
    }
  }
  if (!browser) return {status: 'skipped', reason: fetched.error ?? 'Thin HTML', url: url.href};
  try {
    const rendered = await renderWithBrowser(url);
    if (rendered.error) return {status: 'skipped', reason: rendered.error, url: url.href};
    const page = extractPage(rendered.html, rendered.url, 'playwright+cheerio');
    return page.excerpt.length > 80 ? {status: 'collected', page} : {status: 'skipped', reason: 'Empty rendered page', url: url.href};
  } catch (error) {
    return {status: 'skipped', reason: 'Browser unavailable: ' + String(error.message).slice(0, 120), url: url.href};
  }
}

// ---------------------------------------------------------------- discovery adapters (pointers only, never evidence)
async function searxng(query, endpoint) {
  const url = new URL('/search', endpoint);
  url.searchParams.set('q', query); url.searchParams.set('format', 'json');
  const response = await fetch(url, {signal: AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error('SearXNG ' + response.status);
  return (await response.json()).results.slice(0, 8).map(item => ({url: item.url, title: item.title, snippet: item.content}));
}
async function duckduckgo(query) {
  const url = new URL('https://html.duckduckgo.com/html/');
  url.searchParams.set('q', query);
  const response = await fetch(url, {signal: AbortSignal.timeout(12000), headers: {'user-agent': USER_AGENT}});
  if (!response.ok) throw new Error('DuckDuckGo ' + response.status);
  const $ = load(await response.text());
  return $('.result').slice(0, 8).map((_, element) => {
    const anchor = $(element).find('.result__a');
    try {
      const link = new URL(anchor.attr('href'), url);
      const target = link.hostname.endsWith('duckduckgo.com') ? link.searchParams.get('uddg') : link.href;
      return target ? {url: target, title: anchor.text().trim(), snippet: $(element).find('.result__snippet').text().trim()} : null;
    } catch { return null; }
  }).get().filter(Boolean);
}
async function bing(query) {
  const url = new URL('https://www.bing.com/search');
  url.searchParams.set('q', query);
  const response = await fetch(url, {signal: AbortSignal.timeout(12000), headers: {'user-agent': 'Mozilla/5.0 (compatible; PRISMResearchBot)'}});
  if (!response.ok) throw new Error('Bing ' + response.status);
  const $ = load(await response.text());
  return $('.b_algo').slice(0, 8).map((_, element) => {
    const anchor = $(element).find('h2 a');
    try {
      const link = new URL(anchor.attr('href'));
      const encoded = link.searchParams.get('u');
      const target = encoded?.startsWith('a1') ? Buffer.from(encoded.slice(2), 'base64url').toString('utf8') : link.href;
      return {url: target, title: anchor.text().trim(), snippet: $(element).find('.b_caption p').text().trim()};
    } catch { return null; }
  }).get().filter(Boolean);
}
/** Google News RSS: headline-level pointers with dates (Vyve pattern). Used for timing signals, never as evidence. */
export async function newsSearch(query) {
  const url = new URL('https://news.google.com/rss/search');
  url.searchParams.set('q', query); url.searchParams.set('hl', 'en-US'); url.searchParams.set('gl', 'US'); url.searchParams.set('ceid', 'US:en');
  const response = await fetch(url, {signal: AbortSignal.timeout(12000), headers: {'user-agent': USER_AGENT}});
  if (!response.ok) throw new Error('News RSS ' + response.status);
  const $ = load(await response.text(), {xmlMode: true});
  return $('item').slice(0, 10).map((_, item) => ({
    title: $(item).find('title').text().trim(), link: $(item).find('link').text().trim(),
    date: (() => { const t = Date.parse($(item).find('pubDate').text()); return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null; })(),
    publisher: $(item).find('source').text().trim(),
  })).get();
}

/** Ordered fallback across permitted search adapters. Returns {adapter, results[], errors[]}. */
export async function discover(query, {adapters = {}, endpoint = process.env.SEARXNG_URL} = {}) {
  const chain = [
    ['searxng', endpoint ? () => searxng(query, endpoint) : null],
    ['duckduckgo-html', () => duckduckgo(query)],
    ['bing-html', () => bing(query)],
  ];
  const errors = [];
  for (const [id, run] of chain) {
    if (!run || (adapters[id] && adapters[id] !== 'approved')) continue;
    try {
      const results = (await run()).filter(item => item.url?.startsWith('https://'));
      if (results.length) return {adapter: id, results, errors};
      errors.push(id + ': no results');
    } catch (error) { errors.push(id + ': ' + String(error.message).slice(0, 80)); }
  }
  return {adapter: null, results: [], errors};
}
