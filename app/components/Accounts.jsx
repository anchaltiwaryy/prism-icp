'use client';
import { useEffect, useMemo, useState } from 'react';
import { Ban, Check, Mail, PenLine, X } from 'lucide-react';
import { Badge, Empty, fmtDate, humanize, List, Panel, Quote, ReasonSelect, usePrism } from './ui';

const LANES = ['HUMAN_REVIEW', 'QUALIFIED', 'NEEDS_RESEARCH', 'APPROVED', 'DRAFTED', 'QUEUED', 'DISQUALIFIED', 'REJECTED', 'SUPPRESSED'];

export default function Accounts() {
  const {workspace, run, refreshWorkspace} = usePrism();
  const [scope, setScope] = useState('all');
  const [selected, setSelected] = useState('');
  useEffect(() => { refreshWorkspace(); }, [refreshWorkspace]);
  const accounts = useMemo(() => (workspace?.accounts ?? []).filter(account => scope === 'all' || account.runId === run?.id), [workspace, scope, run]);
  const active = accounts.find(account => account.id === selected) ?? null;
  const jobs = workspace?.jobs ?? [];

  if (!workspace) return <Panel><Empty title="Loading workspace…" /></Panel>;
  return (
    <>
      <p className="callout"><strong>Nothing is ever sent.</strong> Accounts are organizations, buyers are roles, and PRISM collects no personal contact data. Queued drafts are dry-run <code>.eml</code> files in <code>data/workspace/outbox</code>{workspace.health?.ownInbox ? ', addressed to your own inbox' : ', addressed to a non-routable placeholder'}.</p>
      {jobs.length > 0 && (
        <Panel title="Background jobs">
          <ul className="small">{jobs.map(job => (
            <li key={job.id}><Badge value={job.status === 'done' ? 'done' : job.status === 'failed' ? 'failed' : 'running'} label={job.status} /> {job.label}
              {job.result?.created && ` — ${job.result.created.length} accounts from ${job.result.candidates} candidates`}
              {job.error && <span className="muted"> — {job.error}</span>} <span className="muted">{fmtDate(job.startedAt)}</span></li>
          ))}</ul>
        </Panel>
      )}
      <div className="filters">
        <div className="segmented">
          <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')} aria-pressed={scope === 'all'}>All runs ({workspace.accounts.length})</button>
          <button className={scope === 'run' ? 'active' : ''} onClick={() => setScope('run')} aria-pressed={scope === 'run'} disabled={!run}>Selected run</button>
        </div>
        <span className="muted small">Find sample accounts from an accepted ICP in the ICPs view.</span>
      </div>
      {accounts.length ? (
        <div className="pipeline">
          {LANES.map(state => {
            const lane = accounts.filter(account => account.state === state);
            return (
              <div className="lane" key={state}>
                <div className="lane-head"><span>{humanize(state)}</span><span>{lane.length}</span></div>
                {lane.map(account => (
                  <button key={account.id} className={'account-chip ' + (selected === account.id ? 'active' : '')} onClick={() => setSelected(account.id)} aria-pressed={selected === account.id}>
                    <strong>{account.name}</strong>
                    <small>{account.domain} · fit {account.fit?.structuralFit}</small>
                    <small>{account.icpId} · {account.segment?.slice(0, 40)}</small>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ) : <Panel><Empty title="No accounts yet" text="Accept an ICP, then use “Find sample accounts” to qualify a handful of real organizations against its criteria." /></Panel>}
      {active && <AccountDetail account={active} />}
      <Outbox />
    </>
  );
}

function AccountDetail({account}) {
  const {workspaceAction, withActor, busy, reasonCodes, workspace} = usePrism();
  const [mode, setMode] = useState(null);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const fit = account.fit ?? {};
  const draftJob = workspace?.jobs?.find(job => job.kind === 'draft' && job.status === 'running');
  const decide = (action, message) => withActor(actor => workspaceAction({type: 'account', accountId: account.id, action, actor, note, reasonCode: reason || undefined}, message)
    .then(result => { if (result) { setMode(null); setNote(''); setReason(''); } }));

  return (
    <Panel eyebrow={`${account.id} · ${account.icpId} · ${account.offer}`} title={account.name}
      text={`${account.domain} · buyer role: ${account.buyerRole} (a role, not a person) · found via “${account.discovery?.query}”`}
      actions={<Badge value={account.state} label={humanize(account.state)} />}>
      <div className="stack">
        <p className="small">{account.whatTheyDo}</p>
        <div className="btn-row">
          <Badge value={fit.structuralFit} label={'structural fit: ' + humanize(fit.structuralFit)} />
          <Badge value={fit.buyingIntent === 'not_observed' ? 'unknown' : 'concern'} label={'buying intent: ' + humanize(fit.buyingIntent)} />
          {fit.fitScore && <Badge tone="outline" label={`criteria score ${fit.fitScore.low}–${fit.fitScore.high}`} />}
          <a className="btn link small" href={account.url} target="_blank" rel="noreferrer">Open site ↗</a>
        </div>

        <div className="grid-even">
          <div>
            <h4>Fit criteria (quoted from their own page)</h4>
            {fit.criteria?.length ? fit.criteria.map((item, index) => (
              <div className="claim" key={index}><Badge value={item.status} /> {item.criterion}{item.quote && <><br /><Quote text={item.quote} /></>}{item.note && <span className="muted small"> ({item.note})</span>}</div>
            )) : <p className="muted small">No model assessment.</p>}
          </div>
          <div>
            <h4>Disqualifiers</h4>
            {fit.disqualifiers?.length ? fit.disqualifiers.map((item, index) => (
              <div className="claim" key={index}><Badge value={item.status} /> {item.disqualifier}{item.quote && <><br /><Quote text={item.quote} /></>}</div>
            )) : <p className="muted small">None assessed.</p>}
            <h4 style={{marginTop: 12}}>Signals</h4>
            {fit.signals?.length ? fit.signals.map((signal, index) => (
              <div className="claim" key={index}>
                <Badge value={signal.strength} label={signal.strength === 'weak_timing' ? 'weak timing — not intent' : 'strong — confirm in conversation'} /> {humanize(signal.type)}: {signal.statement}
                <br /><Quote text={signal.quote} />
              </div>
            )) : <p className="muted small">No dated signals found.</p>}
          </div>
        </div>

        <div>
          <h4>Gates</h4>
          <div className="gates">{(fit.gates ?? []).map(gate => <Badge key={gate.gate} value={gate.pass ? 'pass' : 'fail'} label={`${gate.pass ? '✓' : '✗'} ${gate.gate}`} title={gate.detail} />)}</div>
          {fit.learnedRules?.length > 0 && <p className="small muted" style={{marginTop: 6}}>Learned rules applied: {fit.learnedRules.join('; ')}</p>}
        </div>

        <div className="review-bar">
          {account.state === 'HUMAN_REVIEW' && <button className="btn good" disabled={busy} onClick={() => setMode(mode === 'approve' ? null : 'approve')}><Check size={14} /> Approve</button>}
          {['HUMAN_REVIEW', 'APPROVED', 'DRAFTED'].includes(account.state) && <button className="btn danger" disabled={busy} onClick={() => setMode(mode === 'reject' ? null : 'reject')}><X size={14} /> Reject</button>}
          {['DISQUALIFIED', 'NEEDS_RESEARCH'].includes(account.state) && <button className="btn" disabled={busy} onClick={() => decide('review', 'Sent to human review')}>Send to review anyway</button>}
          {account.state === 'APPROVED' && <button className="btn primary" disabled={busy || Boolean(draftJob)} onClick={() => workspaceAction({type: 'account', accountId: account.id, action: 'draft'}, 'Drafting started — the draft appears here when QA has run')}><PenLine size={14} /> {draftJob ? 'Drafting…' : 'Draft outreach'}</button>}
          {account.state === 'DRAFTED' && account.draft?.qa?.pass && <button className="btn primary" disabled={busy} onClick={() => withActor(actor => workspaceAction({type: 'account', accountId: account.id, action: 'queue', actor}, result => `${result.files} dry-run drafts written to the local outbox`))}><Mail size={14} /> Queue to local outbox</button>}
          {!['SUPPRESSED', 'REJECTED'].includes(account.state) && <button className="btn" disabled={busy} onClick={() => decide('suppress', `${account.domain} suppressed`)}><Ban size={14} /> Suppress domain</button>}
        </div>
        {mode === 'approve' && (
          <div className="inline-form">
            <label className="field">Note <span className="hint">(optional)</span><input value={note} onChange={event => setNote(event.target.value)} placeholder="Why this account is worth contacting" /></label>
            <div className="btn-row"><button className="btn primary" disabled={busy} onClick={() => decide('approve', `${account.name} approved for drafting`)}>Confirm approval</button></div>
          </div>
        )}
        {mode === 'reject' && (
          <div className="inline-form">
            <div className="form-grid">
              <label className="field">Reason<ReasonSelect value={reason} onChange={setReason} codes={reasonCodes} /></label>
              <label className="field">Note<input value={note} onChange={event => setNote(event.target.value)} /></label>
            </div>
            <div className="btn-row"><button className="btn danger" disabled={busy || !reason} onClick={() => decide('reject', `${account.name} rejected`)}>Confirm reject</button></div>
          </div>
        )}

        {account.draft && <Draft draft={account.draft} />}

        <div>
          <h4>History</h4>
          <ul className="small">{account.events.map((event, index) => (
            <li key={index}>{fmtDate(event.at)} · {event.from ? humanize(event.from) + ' → ' : ''}<strong>{humanize(event.to)}</strong> · {event.actor}{event.note ? ` — ${event.note}` : ''}</li>
          ))}</ul>
        </div>
      </div>
    </Panel>
  );
}

function Draft({draft}) {
  return (
    <div className="stack">
      <div className="panel-head" style={{marginBottom: 0}}>
        <div><h3>Draft sequence</h3><p className="muted small">By {draft.by} · {fmtDate(draft.draftedAt)}{draft.qa?.note ? ` · ${draft.qa.note}` : ''}</p></div>
        <Badge value={draft.qa?.pass ? 'pass' : 'fail'} label={'QA ' + draft.qa?.summary} />
      </div>
      <div className="grid-even">
        <div className="stack">
          {draft.steps.map(step => (
            <div className="draft-step" key={step.step}>
              <strong className="small">Step {step.step} · {step.subject}</strong>
              {step.lines.map((line, index) => (
                <div className="draft-line" key={index}>
                  <span className={'line-tag ' + line.tag}>{line.tag}{line.claimIds?.length ? ' ' + line.claimIds.join(',') : ''}</span>{line.text}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div>
          <h4>QA checklist</h4>
          <div className="qa-list">
            {draft.qa?.checks?.map((check, index) => (
              <div key={index}><Badge value={check.pass ? 'pass' : 'fail'} label={check.pass ? 'pass' : 'fail'} /><span>{check.check}{check.detail ? <span className="muted"> — {check.detail}</span> : null}</span></div>
            ))}
          </div>
          <h4 style={{marginTop: 12}}>Offer facts available to the drafter</h4>
          <List items={(draft.offerFacts ?? []).map(fact => `${fact.id} (${humanize(fact.origin)}): ${fact.text}`)} />
        </div>
      </div>
    </div>
  );
}

function Outbox() {
  const {workspace, workspaceAction, withActor, busy} = usePrism();
  const [domain, setDomain] = useState('');
  return (
    <div className="grid-even">
      <Panel title="Dry-run outbox" text="Every queued draft, as files on this computer. PRISM has no send capability.">
        {workspace.outbox?.length ? (
          <ul className="small">{workspace.outbox.slice().reverse().map((item, index) => (
            <li key={index}>{fmtDate(item.at)} · {item.accountId} · {item.files.length} files · {item.by}<br /><span className="mono muted">{item.files.join(', ')}</span></li>
          ))}</ul>
        ) : <p className="muted small">Nothing queued.</p>}
      </Panel>
      <Panel title="Suppression list" text="Suppressed domains are blocked from queueing and from future account discovery.">
        <div className="filters">
          <input value={domain} onChange={event => setDomain(event.target.value)} placeholder="example.com" aria-label="Domain to suppress" />
          <button className="btn small" disabled={busy || !domain.trim()} onClick={() => withActor(actor => workspaceAction({type: 'suppress', domain, actor}, `${domain} suppressed`).then(result => { if (result) setDomain(''); }))}>Suppress</button>
        </div>
        <List items={(workspace.suppression ?? []).map(item => `${item.domain} · ${item.by ?? ''} · ${fmtDate(item.at)}`)} empty="No suppressed domains." />
      </Panel>
    </div>
  );
}
