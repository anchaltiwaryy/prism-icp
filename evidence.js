import { createHash } from 'node:crypto';
import { angles } from './planner.js';

export const hash = value => createHash('sha256').update(value).digest('hex');

export function collect(items, policy, asOf) {
  const evidence = [];
  const audit = [];
  const seen = new Set();
  let consumed = 0;
  for (const item of items) {
    let url;
    try { url = new URL(item.url); } catch { /* Invalid references are logged below. */ }
    let reason;
    if (!url || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
        !policy.hosts.includes(url.hostname)) reason = 'reference outside allowlist or URL policy';
    else if (item.permission !== 'approved') reason = 'source permission missing';
    else if (!['primary', 'secondary'].includes(item.kind) || !item.publisher?.trim() || !item.origin?.trim() ||
        !item.text?.trim() || item.text.length > 8000) reason = 'invalid source metadata or excerpt';
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(item.observed) ||
        !Number.isFinite(Date.parse(item.observed)) ||
        new Date(item.observed).toISOString().slice(0, 10) !== item.observed ||
        item.observed > asOf) reason = 'invalid observation date';
    else if (consumed >= policy.maxSources) reason = 'source budget exhausted';
    if (reason) {
      audit.push({status: 'skipped', reason});
      continue;
    }
    const digest = hash(item.text.trim().toLowerCase().replace(/\s+/g, ' '));
    const id = hash(JSON.stringify([url.href, item.observed, digest]));
    if (seen.has(id)) {
      audit.push({status: 'duplicate', id});
      continue;
    }
    seen.add(id);
    consumed++;
    evidence.push({
      id, url: url.href, host: url.hostname, origin: item.origin.trim().toLowerCase(),
      publisher: item.publisher.trim().toLowerCase(), observed: item.observed, digest,
      text: item.text, kind: item.kind, adapter: 'approved-snapshot',
      stale: Date.parse(asOf) - Date.parse(item.observed) > policy.maxAgeDays * 86400000,
    });
    audit.push({status: 'retained', id});
  }
  return {evidence, audit, consumed};
}

export function verifyClaims(candidate, records, evidence) {
  const sources = new Map(evidence.map(source => [source.url, source]));
  return records.filter(record => record.candidate === candidate.id).map((record, index) => {
    const source = sources.get(record.url);
    const verified = Boolean(source && !source.stale && record.quote?.trim() &&
      source.text.includes(record.quote) && record.reviewer?.trim() && record.analyst?.trim() &&
      record.reviewer.trim().toLowerCase() !== record.analyst.trim().toLowerCase() &&
      record.verdict === 'confirmed');
    if (!Object.hasOwn(angles, record.angle) || !['support', 'challenge', 'exclusion'].includes(record.direction) ||
        typeof record.statement !== 'string' || !record.statement.trim()) {
      throw new Error('Invalid claim classification for ' + candidate.id);
    }
    return {
      id: candidate.id + '/claim/' + (index + 1), statement: record.statement,
      angle: record.angle, direction: record.direction, analyst: record.analyst ?? null,
      reviewer: record.reviewer ?? null, sourceId: source?.id ?? null,
      quote: verified ? record.quote : null, status: verified ? 'verified' : 'unresolved',
    };
  });
}
