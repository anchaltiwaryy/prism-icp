'use client';
import { useState } from 'react';
import { Pause, Play, RefreshCw, Square } from 'lucide-react';
import {
  ANGLE_LABELS, Badge, DECISION_LABELS, Empty, fmtDate, humanize, Meter, Metric, money, Panel, STAGE_LABELS, STAGE_ORDER, usePrism,
} from './ui';

const CELL = {
  searched: ['S', 'Searched, evidence retained'], searched_no_evidence: ['∅', 'Searched, nothing retained'],
  planned: ['P', 'Planned'], deferred: ['–', 'Deferred (depth or budget)'],
};

export default function Cockpit() {
  const {run, runAction, busy, selectRun, setView} = usePrism();
  const [showAll, setShowAll] = useState(false);
  if (!run) return <Panel><Empty title="Select a run" text="Choose a research run from the picker above, or start a new one." /></Panel>;

  const limits = run.policy?.limits ?? {};
  const spend = run.spend ?? {};
  const order = STAGE_ORDER[run.kind === 'refresh' ? 'refresh' : 'research'];
  const status = run.status;
  const canPause = status === 'running' && run.active;
  const canCancel = ['running', 'queued', 'paused', 'interrupted', 'failed'].includes(status);
  const canResume = ['paused', 'failed', 'interrupted'].includes(status);
  const canRefresh = ['awaiting_review', 'complete'].includes(status) && run.sources?.length > 0;
  const decisions = (run.cards ?? []).reduce((acc, card) => ({...acc, [card.decision ?? 'pending']: (acc[card.decision ?? 'pending'] ?? 0) + 1}), {});
  const events = [...(run.events ?? [])].reverse();
  const failedCalls = (run.modelCalls ?? []).filter(call => !call.ok);

  async function refresh() {
    const result = await runAction({type: 'refresh'}, 'Refresh run started');
    if (result?.id) selectRun(result.id);
  }

  return (
    <>
      <Panel>
        <div className="run-header">
          <div>
            <div className="eyebrow">{run.kind === 'refresh' ? 'Refresh / delta run' : 'Research run'} · {run.id.slice(0, 8)}</div>
            <h2>{run.brief?.name} — {run.brief?.offer}</h2>
            <div className="meta">
              <Badge value={status} />
              <Badge tone="outline" label={run.policy?.modeLabel ?? humanize(run.policy?.mode)} />
              <Badge tone="outline" label={'Model: ' + (run.llm ? `${run.llm.provider}${run.llm.model ? ' · ' + run.llm.model : ''}` : 'not yet started')} />
              <Badge tone="outline" label={run.brief?.geography ?? 'Global'} />
              {run.strategyVersion && <Badge tone="outline" label={run.strategyVersion} />}
              {run.parentRunId && <button className="btn link small" onClick={() => selectRun(run.parentRunId)}>Parent run ↗</button>}
              <span className="muted small">Started {fmtDate(run.createdAt)}</span>
            </div>
            {run.error && <p className="notice error" style={{marginTop: 10}}>{run.error}</p>}
            {status === 'interrupted' && (
              <p className="callout" style={{marginTop: 10}}>This run stopped updating — the server may have restarted, or it is running in another process (for example the CLI pilot). Resume only if no other process is working on it.</p>
            )}
          </div>
          <div className="btn-row">
            {canPause && <button className="btn" disabled={busy} onClick={() => runAction({type: 'control', action: 'pause'}, 'Pausing after the current step')}><Pause size={14} /> Pause</button>}
            {canResume && <button className="btn primary" disabled={busy} onClick={() => runAction({type: 'control', action: 'resume'}, 'Resumed from the last checkpoint')}><Play size={14} /> Resume</button>}
            {canCancel && <button className="btn danger" disabled={busy} onClick={() => runAction({type: 'control', action: 'cancel'}, 'Cancelling')}><Square size={13} /> Cancel</button>}
            {canRefresh && <button className="btn" disabled={busy} onClick={refresh} title="Re-check sources, re-extract changed pages and report the delta"><RefreshCw size={14} /> Refresh run</button>}
          </div>
        </div>
      </Panel>

      <section className="metrics">
        <Meter label="Pages fetched" used={spend.pages ?? 0} limit={limits.maxPages} />
        <Meter label="Searches" used={spend.searches ?? 0} limit={limits.maxSearches} />
        <Meter label="Model calls" used={spend.modelCalls ?? 0} limit={limits.maxModelCalls} />
        <Meter label="Model spend" used={spend.usd ?? 0} limit={limits.maxUsd} format={money} />
        <Metric label="Sources retained" value={run.sources?.length ?? 0}
          detail={`${new Set((run.sources ?? []).map(source => source.family)).size} independent families · ${run.sourceGaps?.length ?? 0} skipped`} />
        <Metric label="Claims in ledger" value={run.claims?.length ?? 0} detail={`${run.rejectedExtractions?.length ?? 0} extractions rejected`} />
      </section>

      <div className="grid-2">
        <div className="stack">
          <Panel eyebrow="Pipeline" title="Stage timeline" text="Each stage writes a checkpoint; resume continues from the first unfinished stage.">
            <div className="timeline">
              {order.map(id => {
                const stage = id === 'S11'
                  ? {status: ['awaiting_review', 'complete'].includes(status) ? (status === 'complete' ? 'done' : 'running') : 'pending'}
                  : run.stages?.[id];
                const state = stage?.status ?? 'pending';
                return (
                  <div className="stage-row" key={id}>
                    <span className={'stage-dot ' + state} aria-hidden="true" />
                    <div>
                      <strong>{id} · {STAGE_LABELS[id]}</strong>
                      <small>
                        {id === 'S11' ? (status === 'complete' ? 'All hypotheses reviewed' : status === 'awaiting_review' ? 'Waiting for your accept / reject decisions' : 'After research completes')
                          : stage ? `${stage.finishedAt ? 'Finished ' + fmtDate(stage.finishedAt) : stage.startedAt ? 'Started ' + fmtDate(stage.startedAt) : ''}${stage.attempt > 1 ? ` · attempt ${stage.attempt}` : ''}${stage.cost ? ` · ${stage.cost.pages} pages, ${stage.cost.searches} searches, ${stage.cost.modelCalls} model calls, ${money(stage.cost.usd)}` : ''}` : 'Not started'}
                      </small>
                    </div>
                    <Badge value={state === 'running' && id === 'S11' ? 'awaiting_review' : state} label={id === 'S11' && state === 'running' ? 'awaiting you' : undefined} />
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel eyebrow="Coverage" title="Segment × research angle" text="Coverage means an angle was searched, not that it was confirmed.">
            {run.coverage?.length ? <Heatmap run={run} /> : <p className="muted small">Coverage matrix appears after the source plan (S3).</p>}
          </Panel>
        </div>

        <div className="stack">
          <Panel eyebrow="Decisions" title="Where the portfolio stands" actions={<button className="btn small" onClick={() => setView('icps')}>Open ICPs</button>}>
            {run.cards?.length ? (
              <div className="stack">
                <div className="btn-row">
                  {Object.entries(decisions).map(([decision, count]) => <Badge key={decision} value={decision} label={`${count} ${DECISION_LABELS[decision] ?? humanize(decision)}`} />)}
                </div>
                <p className="small">
                  {run.portfolio?.recommended?.length
                    ? `${run.portfolio.recommended.length} recommended for field testing: ${run.portfolio.recommended.join(', ')}.`
                    : run.portfolio?.noRecommendation ? run.portfolio.noRecommendation.reason : 'Portfolio is decided at S10.'}
                </p>
                {run.delta && (
                  <div className="callout">
                    Delta vs parent: {run.delta.claims.new} new claims, {run.delta.claims.unchanged} unchanged, {run.delta.claims.stale} stale ·
                    {' '}{run.delta.cardChanges.length} hypotheses changed · recommendations +{run.delta.recommendations.added.length} / −{run.delta.recommendations.removed.length}
                  </div>
                )}
              </div>
            ) : <p className="muted small">Hypotheses appear after S6.</p>}
          </Panel>

          <Panel eyebrow="Live log" title="Activity" text={`${events.length} events${failedCalls.length ? ` · ${failedCalls.length} model calls failed (recorded as gaps)` : ''}`}>
            <div className="events" aria-live="polite">
              {(showAll ? events : events.slice(0, 25)).map((event, index) => (
                <div className="event" key={index}>
                  <span className="tag">{event.stage}</span>
                  <div>{event.detail}<small>{fmtDate(event.at)}</small></div>
                </div>
              ))}
              {!events.length && <p className="muted small">No activity yet.</p>}
            </div>
            {events.length > 25 && <button className="btn link small" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show recent only' : `Show all ${events.length}`}</button>}
          </Panel>

          <Panel eyebrow="Scope" title="Cross-cuts and limits">
            <div className="stack small">
              <div className="btn-row">
                {(run.crossCuts ?? []).map(item => <Badge key={item.cut} value={item.status === 'not_assessed' ? 'unknown' : 'done'} label={`${item.cut}: ${humanize(item.status)}`} />)}
                {!run.crossCuts?.length && <span className="muted">Recorded at S3.</span>}
              </div>
              <p className="muted">{run.policy?.jurisdictionNote}</p>
              <p className="muted">{run.policy?.forbiddenDomains?.length ?? 0} forbidden domains (social networks, contact-data brokers) · personal data: {humanize(run.policy?.personalData)} · outreach: {humanize(run.policy?.outreach)}</p>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Heatmap({run}) {
  const angles = [...new Set(run.coverage.map(cell => cell.angle))];
  const segments = run.segments ?? [];
  const lookup = new Map(run.coverage.map(cell => [cell.segmentId + '|' + cell.angle, cell]));
  const searched = run.coverage.filter(cell => cell.status === 'searched').length;
  return (
    <>
      <p className="small muted" style={{marginBottom: 8}}>{searched} of {run.coverage.length} cells searched with evidence retained.</p>
      <div className="heatmap-wrap">
        <table className="heatmap">
          <thead>
            <tr><th>Segment</th>{angles.map(angle => <th key={angle} className="rot" scope="col">{ANGLE_LABELS[angle] ?? angle}</th>)}</tr>
          </thead>
          <tbody>
            {segments.map(segment => (
              <tr key={segment.id}>
                <td className="seg" title={`${segment.offer} · ${segment.name}`}>{segment.id} · {segment.name}</td>
                {angles.map(angle => {
                  const cell = lookup.get(segment.id + '|' + angle);
                  const [symbol, meaning] = CELL[cell?.status] ?? ['?', 'Unknown'];
                  return <td key={angle} className={'cell ' + (cell?.status ?? '')} title={`${ANGLE_LABELS[angle] ?? angle}: ${meaning}${cell?.reason ? ' — ' + cell.reason : ''}`} aria-label={`${segment.name}, ${angle}: ${meaning}`}>{symbol}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="legend">
        {Object.entries(CELL).map(([key, [symbol, meaning]]) => <span key={key}><i className={'cell ' + key}>{symbol}</i>{meaning}</span>)}
      </div>
    </>
  );
}
