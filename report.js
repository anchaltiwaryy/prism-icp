const escape = value => String(value).replace(/[&<>]/g, character =>
  ({'&': '&amp;', '<': '&lt;', '>': '&gt;'})[character])
  .replace(/[\\`*_[\]|]/g, '\\$&').replace(/[\r\n]+/g, ' ');

export function markdown(report) {
  const sources = new Map(report.evidence.map(source => [source.id, source]));
  const lines = [
    '# PRISM research report', '',
    '**Business** ' + escape(report.business.name),
    '**As of** ' + report.asOf,
    '**Run** ' + report.runId, '',
    '## Decision', '',
    report.recommendations.length ? 'Explore first · ' + report.recommendations.join(', ') :
      'No recommendation cleared the evidence and review gates.', '',
    'Public evidence supports market hypotheses. Commercial validation requires field outcomes.',
  ];
  for (const card of report.cards) {
    lines.push('', '## ' + card.id + ' · ' + escape(card.offer), '',
      '**Segment** ' + escape(card.segment),
      '**Status** ' + card.status,
      '**Merit range** ' + card.opportunity.low + '–' + card.opportunity.high,
      '**Evidence grade** ' + card.opportunity.grade,
      '**Checked coverage** ' + card.coveragePct + '%',
      '**Motion and geography** ' + escape(card.motion) + ' · ' + escape(card.geography),
      '**User / buyer** ' + escape(card.user) + ' / ' + escape(card.buyer),
      '**Buying intent / market size / commercial validation** ' +
        [card.buyingIntent, card.marketSize, card.commercialValidation].join(' / '),
      '**Red team** ' + escape(card.redTeam.challenge) + ' (' + card.redTeam.disposition + ')',
      '**Exclude** ' + card.exclusions.map(escape).join(' · '), '',
      '### Evidence and challenges', '');
    if (!card.claims.length) lines.push('No reviewed claims supplied.');
    for (const claim of card.claims) {
      const source = sources.get(claim.sourceId);
      lines.push('- ' + claim.direction + ' · ' + claim.status + ' · ' + escape(claim.statement) +
        (claim.quote ? ' · “' + escape(claim.quote) + '” (' + source.observed + ') <' + source.url + '>' : ''));
    }
    lines.push('', '### Next test', '', ...Object.values(card.nextTest).map(escape),
      '', 'Deferred angles · ' + card.coverage.filter(item => item.status === 'deferred')
        .map(item => item.angle).join(', '));
  }
  return lines.join('\n\n') + '\n';
}
