/**
 * Outreach QA — runs before anything can be queued and tries to break every line (ported from the Vyve
 * pipeline's qa.py). Every ACCOUNT line must cite a literally verified account claim, every OFFER line an
 * owner-declared or publicly observed offer fact, and GENERATED lines may not carry numbers or claims.
 */
const BANNED = [
  'hope this finds you', "hope you're well", 'hope you are well', 'just following up', 'just checking in', 'circle back',
  'touch base', 'bump this', 'revolutionize', 'game-changer', 'game changer', 'cutting-edge', 'cutting edge', 'synergy',
  'seamless', 'unlock', 'supercharge', 'best-in-class', 'world-class', 'as we discussed', 'great chatting', 'loved your post',
  "i'm sure you", 'congrats on the', 'guarantee', '10x', 'skyrocket', 'looking for a', 'in the market for', 'noticed you need',
  'you are struggling', "you're struggling", 'quick question',
];
const NUMBERISH = /(\d[\d,.]*\s?%|[$€£₹]\s?\d|\b\d{2,}[\d,]*\b(?!\s?-?\s?(?:minutes?|mins?)\b)|\b\d+x\b)/i;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
const LIMITS = {1: 90, 2: 70, 3: 70};

const words = text => new Set((text.toLowerCase().match(/[a-z']{4,}/g) ?? []));

export function runQa(steps, {accountClaims, offerFacts}) {
  const checks = [];
  const check = (name, ok, detail = '') => checks.push({check: name, pass: Boolean(ok), detail});
  const claimOk = new Map(accountClaims.map(claim => [claim.id, claim.verified]));
  const factOk = new Set(offerFacts.map(fact => fact.id));
  for (const step of steps) {
    const lines = step.lines ?? [];
    const body = lines.map(line => line.text).join(' ');
    const lower = (body + ' ' + (step.subject ?? '')).toLowerCase();
    const badAccount = lines.filter(line => line.tag === 'ACCOUNT' && (!line.claimIds?.length || line.claimIds.some(id => !claimOk.get(id))));
    check(`Step ${step.step}: account lines cite verified account claims`, !badAccount.length,
      badAccount.map(line => `"${line.text.slice(0, 40)}…"`).join('; ') || 'all cited');
    const badOffer = lines.filter(line => line.tag === 'OFFER' && (!line.claimIds?.length || line.claimIds.some(id => !factOk.has(id))));
    check(`Step ${step.step}: offer lines cite offer facts`, !badOffer.length, badOffer.map(line => `"${line.text.slice(0, 40)}…"`).join('; ') || 'all cited');
    const numbers = lines.filter(line => line.tag === 'GENERATED' && NUMBERISH.test(line.text));
    check(`Step ${step.step}: no unsupported numbers`, !numbers.length, numbers.map(line => line.text.slice(0, 50)).join('; ') || 'numbers only in cited lines');
    const hits = BANNED.filter(phrase => lower.includes(phrase));
    check(`Step ${step.step}: no filler, hype or implied intent`, !hits.length, hits.join(', ') || 'clean');
    const count = body.split(/\s+/).filter(Boolean).length;
    check(`Step ${step.step}: ≤ ${LIMITS[step.step] ?? 70} words`, count <= (LIMITS[step.step] ?? 70), `${count} words`);
    check(`Step ${step.step}: ends on one low-friction question`, body.trim().endsWith('?'), body.slice(-70));
    check(`Step ${step.step}: no personal contact data`, !EMAIL.test(body), EMAIL.test(body) ? 'email address in copy' : 'none');
  }
  const first = steps.find(step => step.step === 1);
  check('Step 1 opens with a verified account-specific observation', first?.lines?.some(line => line.tag === 'ACCOUNT'), '');
  const subjects = steps.map(step => (step.subject ?? '').toLowerCase());
  check('Subjects distinct', new Set(subjects).size === subjects.length, subjects.join(' | '));
  let worst = 0;
  for (let i = 0; i < steps.length; i++) for (let j = i + 1; j < steps.length; j++) {
    const a = words(steps[i].lines.map(line => line.text).join(' '));
    const b = words(steps[j].lines.map(line => line.text).join(' '));
    if (a.size && b.size) worst = Math.max(worst, [...a].filter(word => b.has(word)).length / new Set([...a, ...b]).size);
  }
  check('Follow-ups not repetitive', worst < 0.35, `max word overlap ${Math.round(worst * 100)}%`);
  return {pass: checks.every(item => item.pass), checks, summary: `${checks.filter(item => item.pass).length}/${checks.length} checks pass`};
}
