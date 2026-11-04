import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run } from './engine.js';
import { markdown } from './report.js';

const brief = {
  name: 'Synthetic example', model: 'b2c', asOf: '2026-11-04',
  offers: [{name: 'Course', problem: 'learn data analysis'}],
  policy: {hosts: ['example.org', 'example.net']},
};

function fixture() {
  const source = {
    url: 'https://example.org/evidence', permission: 'approved', origin: 'document-a',
    publisher: 'issuer-a', kind: 'primary', observed: '2026-10-12',
    text: 'Synthetic excerpt for testing positive evidence.',
  };
  const claims = ['pain', 'fit', 'economics', 'reach', 'timing', 'delivery', 'advantage'].map(angle => ({
    candidate: '1-1-1', angle, direction: 'support', url: source.url, quote: source.text,
    statement: 'Synthetic ' + angle, analyst: 'analyst-a', reviewer: 'reviewer-b', verdict: 'confirmed',
  }));
  const reviews = [{candidate: '1-1-1', critic: 'critic-c',
    challenge: 'Check whether free training already meets the need', disposition: 'cleared'}];
  return {...brief, sources: [source], claims, reviews};
}

test('separates purchase paths and can withhold every recommendation', () => {
  const report = run(brief);
  assert.equal(report.cards.length, 3);
  assert.deepEqual(report.recommendations, []);
  assert.deepEqual(report.cards.map(card => card.motion),
    ['individual paid', 'institution sponsored', 'employer sponsored']);
  assert.equal(report.cards[0].opportunity.high, 100);
  assert.equal(report.cards[0].coveragePct, 0);
  assert.equal(report.cards[0].buyingIntent, 'not_observed');
  assert.match(markdown(report), /No recommendation cleared/);
  assert.deepEqual(run(brief), report);
});

test('traceable positive case remains commercially untested', () => {
  const report = run(fixture());
  assert.deepEqual(report.recommendations, ['1-1-1']);
  assert.equal(report.cards[0].commercialValidation, 'not_tested');
  assert.equal(report.cards[0].claims[0].sourceId, report.evidence[0].id);
});

test('policy, freshness and independent review each block recommendation', () => {
  for (const mutate of [
    input => input.sources[0].permission = 'unapproved',
    input => input.sources[0].observed = '2020-01-01',
    input => input.sources[0].url = 'https://example.org.evil.test/evidence',
    input => input.claims.forEach(claim => claim.reviewer = 'Analyst-A'),
    input => input.reviews[0].critic = 'Analyst-A',
    input => input.claims.forEach(claim => claim.quote = 'invented quote'),
  ]) {
    const input = fixture();
    mutate(input);
    assert.deepEqual(run(input).recommendations, []);
  }
});

test('copied material cannot upgrade source independence', () => {
  const input = fixture();
  const copy = {...input.sources[0], url: 'https://example.net/copy', origin: 'other',
    publisher: 'issuer-b', kind: 'secondary'};
  input.sources.push(copy);
  input.claims.push({...input.claims[0], url: copy.url});
  assert.equal(run(input).cards[0].opportunity.grade, 'B');
});

test('independently verified hard exclusion rejects otherwise strong hypothesis', () => {
  const input = fixture();
  input.claims.push({...input.claims[0], direction: 'exclusion', angle: 'risks'});
  const report = run(input);
  assert.equal(report.cards.find(card => card.id === '1-1-1').status, 'rejected');
  assert.deepEqual(report.recommendations, []);
});
