'use client';
import { Badge, Empty, humanize, List, Panel, Quote, RED_TEAM_LABELS, usePrism } from './ui';

export default function RedTeam() {
  const {run} = usePrism();
  if (!run) return <Panel><Empty title="Select a run" /></Panel>;
  const reviewed = (run.cards ?? []).filter(card => card.redTeam && card.redTeam.status !== 'not_reviewed');
  const skipped = (run.cards ?? []).filter(card => card.redTeam?.status === 'not_reviewed');
  if (!reviewed.length) {
    return <Panel><Empty title="No red-team reviews yet" text={run.cards?.length ? 'Only hypotheses with some evidence are shortlisted for adversarial review (S8). Cards with no evidence are deferred, not attacked.' : 'Red-team review runs at S8.'} /></Panel>;
  }
  return (
    <>
      {reviewed.map(card => {
        const rt = card.redTeam;
        const counts = rt.tests.reduce((acc, test) => ({...acc, [test.result]: (acc[test.result] ?? 0) + 1}), {});
        return (
          <Panel key={card.id} eyebrow={`${card.id} · ${card.offer}`} title={card.segment}
            text={`Reviewer: ${rt.reviewer ?? 'unknown'} · ${Object.entries(counts).map(([key, value]) => `${value} ${humanize(key)}`).join(', ')}`}
            actions={<Badge value={rt.status} label={'status: ' + humanize(rt.status)} />}>
            <div className="stack">
              <div className="grid-even">
                <div className="callout"><h4>Strongest argument for</h4>{rt.strongestFor || '—'}</div>
                <div className="callout"><h4>Strongest argument against</h4>{rt.strongestAgainst || '—'}</div>
              </div>
              {rt.killSwitch?.fired && (
                <p className={'notice ' + (rt.killSwitch.verified ? 'error' : 'info')}>
                  Kill switch {rt.killSwitch.verified ? 'fired with a verified quote' : 'claimed but its quote was not found — not applied'}: {rt.killSwitch.reason}
                  {rt.killSwitch.quote && <> — <Quote text={rt.killSwitch.quote} /></>}
                </p>
              )}
              <div className="tests">
                {rt.tests.map(test => (
                  <div className={'test ' + test.result} key={test.id}>
                    <div className="head"><strong>{RED_TEAM_LABELS[test.id] ?? test.id}</strong><Badge value={test.result} /></div>
                    <span>{test.note}</span>
                    {test.quote && <Quote text={test.quote} max={160} />}
                    {test.claimIds?.length > 0 && <span className="mono muted">{test.claimIds.join(', ')}</span>}
                  </div>
                ))}
              </div>
              <div className="cols-3">
                <div><h4>Falsifiable assumptions</h4><List items={rt.assumptions} /></div>
                <div><h4>False-positive causes</h4><List items={rt.falsePositiveCauses} /></div>
                <div><h4>What would change the decision</h4><p className="small">{rt.wouldChangeDecision || '—'}</p></div>
              </div>
            </div>
          </Panel>
        );
      })}
      {skipped.length > 0 && (
        <Panel title="Not shortlisted for red team" text="These had no usable evidence or ranked below the red-team cut-off, so they cannot be recommended in this run.">
          <List items={skipped.map(card => `${card.id} · ${card.segment} (${card.offer})`)} />
        </Panel>
      )}
    </>
  );
}
