'use client';
import { useState } from 'react';
import { api, Badge, DECISION_LABELS, Empty, fmtDate, humanize, money, Panel, usePrism } from './ui';

const EXPORTS = [['memo', 'Decision memo (Markdown)'], ['json', 'Full run (JSON)'], ['icps', 'ICPs (CSV)'], ['claims', 'Claims ledger (CSV)'],
  ['sources', 'Sources (CSV)'], ['lead-brief', 'Lead-intelligence brief (Markdown)']];

export default function Runs() {
  const {runs, run, selectRun, setView} = usePrism();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [comparison, setComparison] = useState(null);
  const [error, setError] = useState('');
  async function compare() {
    setError('');
    try { setComparison(await api(`/api/compare?a=${a}&b=${b}`)); } catch (cause) { setError(cause.message); }
  }
  return (
    <>
      <Panel title="All runs" text={`${runs.length} saved locally under data/`}>
        {runs.length ? (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Business</th><th>Status</th><th>Mode</th><th>Created</th><th>Sources</th><th>Claims</th><th>ICPs</th><th>Recommended</th><th>Spend</th></tr></thead>
              <tbody>{runs.map(item => (
                <tr key={item.id} className={'clickable ' + (run?.id === item.id ? 'active' : '')} onClick={() => { selectRun(item.id); setView('cockpit'); }}
                  tabIndex={0} onKeyDown={event => { if (event.key === 'Enter') { selectRun(item.id); setView('cockpit'); } }}>
                  <td><strong>{item.name}</strong><div className="muted small">{item.offer}{item.parentRunId ? ` · from ${item.parentRunId.slice(0, 8)}` : ''}</div></td>
                  <td><Badge value={item.status} /></td><td className="small">{humanize(item.mode)}</td><td className="small">{fmtDate(item.createdAt)}</td>
                  <td>{item.sources}</td><td>{item.claims}</td><td>{item.cards}</td><td>{item.recommended}</td><td className="small">{money(item.spend?.usd)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <Empty title="No runs yet" />}
      </Panel>

      <div className="grid-even">
        <Panel title="Exports" text={run ? `${run.brief?.name} · ${run.id.slice(0, 8)}` : 'Select a run'}>
          {run ? <ul>{EXPORTS.map(([format, label]) => <li key={format}><a href={`/api/runs/${run.id}/export?format=${format}`}>{label}</a></li>)}</ul> : <p className="muted small">Select a run first.</p>}
        </Panel>
        <Panel title="Compare two runs" text="Matched by offer and segment: decisions, score ranges and grades side by side.">
          <div className="form-grid">
            <label className="field">Run A<select value={a} onChange={event => setA(event.target.value)}><option value="">Choose…</option>{runs.map(item => <option key={item.id} value={item.id}>{item.name} · {item.id.slice(0, 8)}</option>)}</select></label>
            <label className="field">Run B<select value={b} onChange={event => setB(event.target.value)}><option value="">Choose…</option>{runs.map(item => <option key={item.id} value={item.id}>{item.name} · {item.id.slice(0, 8)}</option>)}</select></label>
          </div>
          <div className="btn-row" style={{marginTop: 10}}><button className="btn primary" disabled={!a || !b || a === b} onClick={compare}>Compare</button></div>
          {error && <p className="notice error" style={{marginTop: 10}}>{error}</p>}
        </Panel>
      </div>

      {comparison && (
        <Panel title={`${comparison.a.name} (${comparison.a.id.slice(0, 8)}) vs ${comparison.b.name} (${comparison.b.id.slice(0, 8)})`}
          text={`A: ${comparison.a.sources} sources, ${comparison.a.claims} claims, ${comparison.a.recommended} recommended · B: ${comparison.b.sources} sources, ${comparison.b.claims} claims, ${comparison.b.recommended} recommended`}>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Offer · segment</th><th>A decision</th><th>A score</th><th>B decision</th><th>B score</th></tr></thead>
              <tbody>{comparison.rows.map((row, index) => (
                <tr key={index}>
                  <td><strong>{row.offer}</strong><div className="small">{row.segment}</div></td>
                  {[row.a, row.b].map((side, i) => <Cells key={i} side={side} />)}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}

function Cells({side}) {
  if (!side) return <><td className="muted">—</td><td /></>;
  return (
    <>
      <td>{side.decision ? <Badge value={side.decision} label={DECISION_LABELS[side.decision]} /> : '—'}{side.recommended && <div><Badge tone="good" label="recommended" /></div>}</td>
      <td className="small">{side.low ?? '–'}–{side.high ?? '–'} · {side.grade ?? 'U'}</td>
    </>
  );
}
