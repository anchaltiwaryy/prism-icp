'use client';
import { useState } from 'react';
import { BadgeCheck, Play } from 'lucide-react';
import { Badge, Empty, fmtDate, humanize, List, Panel, ReasonSelect, usePrism } from './ui';

export default function Validation() {
  const {run} = usePrism();
  if (!run) return <Panel><Empty title="Select a run" /></Panel>;
  const experiments = run.experiments ?? [];
  if (!experiments.length) return <Panel><Empty title="No experiments yet" text="The validation sprint is designed at S10 for recommended ICPs (or as gap-closure research when none pass)." /></Panel>;
  const groups = [...new Set(experiments.map(item => item.icpId))];
  return (
    <>
      <p className="callout">Pass and kill criteria were registered before any data was gathered. Commercial validation is a human judgement against a passed experiment — PRISM never sets it from desk research.</p>
      {groups.map(icpId => <IcpGroup key={icpId} icpId={icpId} experiments={experiments.filter(item => item.icpId === icpId)} />)}
    </>
  );
}

function IcpGroup({icpId, experiments}) {
  const {run, runAction, withActor, busy} = usePrism();
  const [note, setNote] = useState('');
  const card = run.cards?.find(item => item.id === icpId);
  const passed = experiments.some(item => item.verdict?.verdict === 'passed');
  const validated = card?.maturity === 'commercially_validated';
  return (
    <Panel eyebrow={`${icpId} · ${card?.offer ?? ''}`} title={card?.segment ?? icpId}
      text={`Review: ${humanize(card?.review?.status)} · maturity: ${humanize(card?.maturity)} · commercial validation: ${humanize(card?.commercialValidation)}`}
      actions={validated ? <Badge value="validated" label="Commercially validated" /> : null}>
      <div className="stack">
        {card?.review?.status !== 'accepted' && <p className="notice info">Accept this ICP in the ICPs view before starting its field test.</p>}
        {experiments.map(experiment => <Experiment key={experiment.id} experiment={experiment} />)}
        {!validated && (
          <div className="inline-form">
            <strong className="small">Mark as commercially validated</strong>
            <p className="small muted">{passed ? 'An experiment passed. Describe the real-world evidence (interviews, qualified opportunity, pilot).' : 'Available only after an experiment is closed with verdict “passed”.'}</p>
            <textarea value={note} onChange={event => setNote(event.target.value)} disabled={!passed} placeholder="e.g. 4 of 6 interviews met the pass criterion; one paid pilot agreed" />
            <div className="btn-row">
              <button className="btn primary" disabled={!passed || busy || !note.trim()}
                onClick={() => withActor(actor => runAction({type: 'validate', icpId, actor, note}, `${icpId} marked commercially validated`).then(result => { if (result) setNote(''); }))}>
                <BadgeCheck size={14} /> Validate ICP
              </button>
            </div>
          </div>
        )}
        {validated && card.validation && <p className="small">Validated by {card.validation.by?.replace('human:', '')} on {fmtDate(card.validation.at)}: {card.validation.note}</p>}
      </div>
    </Panel>
  );
}

function Experiment({experiment}) {
  const {runAction, withActor, busy, reasonCodes} = usePrism();
  const [form, setForm] = useState(null);
  const [result, setResult] = useState('positive');
  const [reason, setReason] = useState('');
  const [verdict, setVerdict] = useState('passed');
  const [note, setNote] = useState('');
  const send = (payload, message) => withActor(actor => runAction({type: 'experiment', experimentId: experiment.id, actor, ...payload}, message)
    .then(response => { if (response) { setForm(null); setNote(''); setReason(''); } }));
  const tally = experiment.results.reduce((acc, item) => ({...acc, [item.result]: (acc[item.result] ?? 0) + 1}), {});
  return (
    <div className="draft-step">
      <div className="panel-head" style={{marginBottom: 0}}>
        <div>
          <h3>{humanize(experiment.type)} <span className="muted small mono">{experiment.id}</span></h3>
          <div className="btn-row" style={{marginTop: 6}}>
            <Badge value={experiment.status === 'closed' ? (experiment.verdict?.verdict ?? 'done') : experiment.status === 'running' ? 'running' : 'planned'}
              label={experiment.status === 'closed' ? 'closed · ' + experiment.verdict?.verdict : experiment.status} />
            {experiment.preRegistered && <Badge tone="info" label="pre-registered" title={'Registered ' + fmtDate(experiment.registeredAt)} />}
            <Badge tone="outline" label={experiment.purpose === 'validation' ? 'validation' : 'gap-closure research'} />
          </div>
        </div>
        <div className="btn-row">
          {experiment.status === 'planned' && <button className="btn primary small" disabled={busy} onClick={() => send({action: 'start'}, 'Experiment started — the ICP is now field testing')}><Play size={13} /> Start</button>}
          {experiment.status === 'running' && <button className="btn small" disabled={busy} onClick={() => setForm(form === 'log' ? null : 'log')}>Log result</button>}
          {experiment.status === 'running' && <button className="btn small" disabled={busy} onClick={() => setForm(form === 'close' ? null : 'close')}>Close</button>}
        </div>
      </div>
      <p className="small"><strong>Hypothesis:</strong> {experiment.hypothesis}</p>
      <p className="small"><strong>Sample:</strong> {experiment.sample}</p>
      <div className="grid-even small">
        <div><h4>Recruiting criteria</h4><List items={experiment.recruitingCriteria} /></div>
        <div><h4>Interview script</h4><List items={experiment.script} /></div>
      </div>
      <div className="grid-even small">
        <div className="callout"><strong>Pass:</strong> {experiment.passCriterion}</div>
        <div className="callout"><strong>Kill:</strong> {experiment.killCriterion}</div>
      </div>
      <p className="small muted">Minimum evidence: {experiment.minimumEvidence}</p>

      {experiment.results.length > 0 && (
        <div>
          <h4>Results ({Object.entries(tally).map(([key, value]) => `${value} ${key}`).join(', ')})</h4>
          <ul className="small">{experiment.results.map((item, index) => (
            <li key={index}><Badge value={item.result} /> {item.reasonCode ? `(${humanize(item.reasonCode)}) ` : ''}{item.note} <span className="muted">— {item.actor?.replace('human:', '')}, {fmtDate(item.at)}</span></li>
          ))}</ul>
        </div>
      )}
      {experiment.verdict && <p className="small"><strong>Verdict:</strong> {experiment.verdict.verdict} by {experiment.verdict.by?.replace('human:', '')} — {experiment.verdict.note}</p>}

      {form === 'log' && (
        <div className="inline-form">
          <div className="form-grid three">
            <label className="field">Result<select value={result} onChange={event => setResult(event.target.value)}><option value="positive">Positive</option><option value="negative">Negative</option><option value="neutral">Neutral / unclear</option></select></label>
            <label className="field">Reason <span className="hint">(optional)</span><ReasonSelect value={reason} onChange={setReason} codes={reasonCodes} /></label>
            <label className="field">Note<input value={note} onChange={event => setNote(event.target.value)} placeholder="What you heard" /></label>
          </div>
          <div className="btn-row"><button className="btn primary" disabled={busy} onClick={() => send({action: 'log', result, reasonCode: reason || undefined, note}, 'Result logged — also recorded as an outcome for learning')}>Save result</button></div>
        </div>
      )}
      {form === 'close' && (
        <div className="inline-form">
          <div className="form-grid">
            <label className="field">Verdict against the pre-registered criteria<select value={verdict} onChange={event => setVerdict(event.target.value)}><option value="passed">Passed</option><option value="failed">Failed</option><option value="inconclusive">Inconclusive</option></select></label>
            <label className="field">Note<input value={note} onChange={event => setNote(event.target.value)} placeholder="How the results compare with the pass / kill criteria" /></label>
          </div>
          <div className="btn-row"><button className="btn primary" disabled={busy} onClick={() => send({action: 'close', verdict, note}, 'Experiment closed')}>Close experiment</button></div>
        </div>
      )}
    </div>
  );
}
