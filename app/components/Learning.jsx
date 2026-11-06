'use client';
import { useEffect, useState } from 'react';
import { Badge, Empty, fmtDate, humanize, Metric, OUTCOME_TYPES, Panel, ReasonSelect, usePrism } from './ui';

export default function Learning() {
  const {workspace, workspaceAction, withActor, busy, refreshWorkspace} = usePrism();
  useEffect(() => { refreshWorkspace(); }, [refreshWorkspace]);
  if (!workspace) return <Panel><Empty title="Loading workspace…" /></Panel>;
  const {metrics, strategy, proposals, changelog} = workspace.learning;
  const decide = (id, action) => withActor(actor => workspaceAction({type: 'learning', action, id, actor,
    note: action === 'approve' ? 'Approved from dashboard' : 'Rejected from dashboard'}, `Proposal ${action === 'approve' ? 'adopted' : 'rejected'}`));
  return (
    <>
      <section className="metrics">
        <Metric label="Validated Opportunity Yield" value={metrics.voy.rate === null ? '—' : metrics.voy.rate + '%'} detail={`${metrics.voy.validated} of ${metrics.voy.recommended} recommended ICPs validated`} />
        <Metric label="Known answers" value={metrics.labels} detail="Human reviews + real outcomes" />
        <Metric label="Outcomes recorded" value={metrics.outcomes} detail={`${metrics.feedback} feedback events`} />
        <Metric label="Strategy" value={strategy.version} detail={`rubric ${strategy.rubricVersion}`} />
      </section>
      <p className="callout">{metrics.voy.caveat} PRISM can learn how to research without outcomes; it cannot claim to know which customers convert until outcomes exist.</p>

      <div className="grid-even">
        <Panel title="Calibration by cohort" text="Positive-outcome rate by decision band and evidence grade. Small cohorts are not acted on.">
          {metrics.calibration.length ? (
            <table className="data"><thead><tr><th>Cohort</th><th>n</th><th>Positive rate</th></tr></thead>
              <tbody>{metrics.calibration.map(row => <tr key={row.cohort}><td>{humanize(row.cohort)}</td><td>{row.n}</td><td>{row.positiveRate === null ? <span className="muted">{row.note}</span> : row.positiveRate + '%'}</td></tr>)}</tbody></table>
          ) : <p className="muted small">No outcomes linked to ICPs yet.</p>}
          <h4 style={{marginTop: 14}}>Negative reason codes</h4>
          <div className="btn-row">{Object.entries(metrics.reasons ?? {}).map(([code, count]) => <Badge key={code} tone="neutral" label={`${count} × ${humanize(code)}`} />)}{!Object.keys(metrics.reasons ?? {}).length && <span className="muted small">None yet.</span>}</div>
        </Panel>
        <Panel title="Source precision" text="Share of each host's claims the independent verifier supported, plus negative human flags.">
          {metrics.sourceStats.length ? (
            <div className="table-wrap"><table className="data"><thead><tr><th>Host</th><th>Checked</th><th>Supported</th><th>Promotional</th><th>Precision</th><th>Flags</th></tr></thead>
              <tbody>{metrics.sourceStats.slice(0, 15).map(row => <tr key={row.host}><td className="small">{row.host}</td><td>{row.checked}</td><td>{row.supported}</td><td>{row.promotional}</td><td>{row.precision === null ? '—' : row.precision + '%'}</td><td>{row.negativeFeedback}</td></tr>)}</tbody></table></div>
          ) : <p className="muted small">No verified claims yet.</p>}
        </Panel>
      </div>

      <Panel title="Proposed strategy changes" text="Generated from outcomes and feedback, evaluated offline against known answers, and adopted only by a human. Safety, privacy and source policy are never part of a strategy."
        actions={<>
          <button className="btn primary" disabled={busy} onClick={() => workspaceAction({type: 'learning', action: 'propose'}, result => `${result.proposals.length} proposals evaluated`)}>Generate proposals</button>
          <button className="btn" disabled={busy || !changelog.length} onClick={() => withActor(actor => workspaceAction({type: 'learning', action: 'rollback', actor}, 'Rolled back to the previous strategy'))}>Roll back</button>
        </>}>
        {proposals.length ? (
          <div className="stack">{proposals.slice().reverse().map(proposal => (
            <div className="draft-step" key={proposal.id}>
              <div className="panel-head" style={{marginBottom: 0}}>
                <div><h3>{proposal.title}</h3><p className="small muted">{proposal.id} · {humanize(proposal.kind)} · because {proposal.because}</p></div>
                <div className="btn-row"><Badge value={proposal.status} /><Badge value={proposal.evaluation?.verdict} label={'eval: ' + humanize(proposal.evaluation?.verdict)} /></div>
              </div>
              {proposal.evaluation?.before && <p className="small">Precision {proposal.evaluation.before.precision ?? '–'}% → {proposal.evaluation.after.precision ?? '–'}% · recall {proposal.evaluation.before.recall ?? '–'}% → {proposal.evaluation.after.recall ?? '–'}% · rare-segment recall {proposal.evaluation.before.rareRecall ?? '–'}% → {proposal.evaluation.after.rareRecall ?? '–'}% on {proposal.evaluation.after.n ?? 0} known answers</p>}
              <p className="small muted">Known risk: {proposal.risk}</p>
              {['shadow', 'shadow_failed'].includes(proposal.status) && (
                <div className="btn-row"><button className="btn good small" disabled={busy} onClick={() => decide(proposal.id, 'approve')}>Approve</button><button className="btn danger small" disabled={busy} onClick={() => decide(proposal.id, 'reject')}>Reject</button></div>
              )}
            </div>
          ))}</div>
        ) : <p className="muted small">No proposals. They need repeated negative reasons, poor source precision or enough outcomes per cohort.</p>}
      </Panel>

      <div className="grid-even">
        <Panel title={'Active strategy · ' + strategy.version}>
          <table className="data"><thead><tr><th>Dimension</th><th>Weight</th></tr></thead>
            <tbody>{Object.entries(strategy.weights).map(([key, value]) => <tr key={key}><td>{humanize(key)}</td><td>{value}</td></tr>)}</tbody></table>
          <p className="small muted" style={{marginTop: 8}}>Bands: explore ≥ {strategy.bands.exploreMid} (width ≤ {strategy.bands.exploreMaxWidth}), conditional ≥ {strategy.bands.conditionalMid}, reject &lt; {strategy.bands.rejectMid} with grade A/B · {strategy.negativeRules?.length ?? 0} learned disqualifiers · {Object.keys(strategy.sourcePriors ?? {}).length} source priors</p>
          <h4 style={{marginTop: 12}}>Changelog</h4>
          {changelog.length ? <ul className="small">{changelog.map((entry, index) => <li key={index}>{fmtDate(entry.at)} · {entry.version} · {entry.by}: {entry.text}</li>)}</ul> : <p className="muted small">No changes adopted yet.</p>}
        </Panel>
        <OutcomeForm />
      </div>
    </>
  );
}

function OutcomeForm() {
  const {runs, run, workspaceAction, withActor, busy, reasonCodes} = usePrism();
  const [form, setForm] = useState({runId: run?.id ?? '', icpId: '', type: 'interview', result: 'positive', reasonCode: '', note: ''});
  const set = (key, value) => setForm(current => ({...current, [key]: value}));
  const cards = form.runId === run?.id ? run?.cards ?? [] : [];
  return (
    <Panel title="Record an outcome" text="Delayed real-world evidence: interviews, meetings, opportunities, wins and losses. “No response” is stored as neutral, not negative.">
      <div className="stack">
        <div className="form-grid">
          <label className="field">Run<select value={form.runId} onChange={event => set('runId', event.target.value)}><option value="">Choose…</option>{runs.map(item => <option key={item.id} value={item.id}>{item.name} · {item.id.slice(0, 8)}</option>)}</select></label>
          <label className="field">ICP{cards.length ? <select value={form.icpId} onChange={event => set('icpId', event.target.value)}><option value="">Choose…</option>{cards.map(card => <option key={card.id} value={card.id}>{card.id} · {card.segment.slice(0, 40)}</option>)}</select>
            : <input value={form.icpId} onChange={event => set('icpId', event.target.value)} placeholder="ICP-G01" />}</label>
          <label className="field">Outcome<select value={form.type} onChange={event => set('type', event.target.value)}>{OUTCOME_TYPES.map(type => <option key={type} value={type}>{humanize(type)}</option>)}</select></label>
          <label className="field">Result<select value={form.result} onChange={event => set('result', event.target.value)}><option value="positive">Positive</option><option value="negative">Negative</option><option value="neutral">Neutral</option></select></label>
          <label className="field">Reason <span className="hint">(optional)</span><ReasonSelect value={form.reasonCode} onChange={value => set('reasonCode', value)} codes={reasonCodes} /></label>
          <label className="field">Note<input value={form.note} onChange={event => set('note', event.target.value)} /></label>
        </div>
        <div className="btn-row">
          <button className="btn primary" disabled={busy || !form.runId || !form.icpId}
            onClick={() => withActor(actor => workspaceAction({type: 'outcome', ...form, reasonCode: form.reasonCode || undefined, actor}, 'Outcome recorded').then(result => { if (result) set('note', ''); }))}>Record outcome</button>
        </div>
      </div>
    </Panel>
  );
}
