'use client';
import { useMemo, useState } from 'react';
import { Building2, Check, ChevronDown, ChevronRight, Microscope, Pencil, X } from 'lucide-react';
import {
  Badge, DECISION_LABELS, Empty, Grade, humanize, List, Panel, Quote, ReasonSelect, ScoreRange, usePrism,
} from './ui';

const FILTERS = [['all', 'All'], ['recommended', 'Recommended'], ['explore_first', 'Explore first'], ['conditional_test', 'Conditional test'],
  ['defer', 'Defer / watch'], ['reject', 'Rejected']];

export default function Icps() {
  const {run} = usePrism();
  const [filter, setFilter] = useState('all');
  const recommended = run?.portfolio?.recommended ?? [];
  const cards = useMemo(() => {
    const list = [...(run?.cards ?? [])];
    const rank = card => recommended.includes(card.id) ? recommended.indexOf(card.id) : 100;
    list.sort((a, b) => rank(a) - rank(b) || (b.score?.mid ?? -1) - (a.score?.mid ?? -1));
    return list.filter(card => filter === 'all' || (filter === 'recommended' ? recommended.includes(card.id) : card.decision === filter));
  }, [run, filter, recommended]);

  if (!run) return <Panel><Empty title="Select a run" /></Panel>;
  if (!run.cards?.length) return <Panel><Empty title="No hypotheses yet" text="ICP cards appear once the run reaches S6. Scores and decisions arrive at S9–S10." /></Panel>;

  const byId = id => run.cards.find(card => card.id === id);
  return (
    <>
      <Panel eyebrow="Portfolio" title={recommended.length ? `${recommended.length} ICP${recommended.length > 1 ? 's' : ''} to test first` : 'No ICP recommended yet'}
        text="Recommended means worth a field test — not validated demand. Buying intent stays “not observed” until real conversations show it.">
        {recommended.length ? (
          <div className="portfolio-summary">
            {recommended.map((id, index) => {
              const card = byId(id);
              return card && (
                <div className="mini-card" key={id}>
                  <span className="rank">#{index + 1} · {card.id}</span>
                  <strong>{card.segment}</strong>
                  <span className="muted small">{card.offer}</span>
                  <div className="btn-row"><Badge value={card.decision} label={DECISION_LABELS[card.decision]} /><Grade grade={card.score?.grade} /><Badge value={card.review?.status} label={'review: ' + humanize(card.review?.status)} /></div>
                  <ScoreRange score={card.score} compact />
                </div>
              );
            })}
          </div>
        ) : run.portfolio?.noRecommendation ? (
          <div className="stack">
            <p>{run.portfolio.noRecommendation.reason}</p>
            <div><h4>Gap-closure plan</h4><List items={run.portfolio.noRecommendation.gapClosure} /></div>
          </div>
        ) : <p className="muted small">The portfolio is chosen at S10.</p>}
        {run.portfolio?.watchlist?.length > 0 && (
          <p className="small muted" style={{marginTop: 12}}>Watchlist: {run.portfolio.watchlist.map(id => `${id} (${byId(id)?.segment ?? ''})`).join(' · ')}</p>
        )}
        {run.portfolio?.whyNot?.length > 0 && (
          <div style={{marginTop: 12}}>
            <h4>Why not the others</h4>
            <List items={run.portfolio.whyNot.map(item => <><strong>{item.offer}</strong> — {item.summary}</>)} />
          </div>
        )}
      </Panel>

      <div className="filters" role="group" aria-label="Filter hypotheses">
        <div className="segmented">
          {FILTERS.map(([key, label]) => <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)} aria-pressed={filter === key}>{label}</button>)}
        </div>
        <span className="muted small">{cards.length} shown</span>
      </div>

      <div className="stack">
        {cards.map(card => <IcpCard key={card.id} card={card} rank={recommended.indexOf(card.id)} />)}
        {!cards.length && <Panel><Empty title="Nothing matches this filter" /></Panel>}
      </div>
    </>
  );
}

function IcpCard({card, rank}) {
  const {run, runAction, withActor, reasonCodes, busy, selectRun, setView} = usePrism();
  const [open, setOpen] = useState(rank === 0);
  const [mode, setMode] = useState(null);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [edits, setEdits] = useState({});
  const claims = id => run.claims?.find(claim => claim.id === id);
  const supporting = (card.supportingClaimIds ?? []).map(claims).filter(Boolean);
  const counter = (card.counterClaimIds ?? []).map(claims).filter(Boolean);
  const alternatives = (run.alternatives ?? []).filter(item => item.offerId === card.offerId);
  const reviewStatus = card.review?.status ?? 'pending';
  const running = ['running', 'queued'].includes(run.status);

  function review(action, extra = {}) {
    withActor(async actor => {
      const result = await runAction({type: 'review', icpId: card.id, action, actor, note, reasonCode: reason || undefined, ...extra},
        action === 'accept' ? `${card.id} accepted` : action === 'reject' ? `${card.id} rejected` : `${card.id} updated`);
      if (result) { setMode(null); setNote(''); setReason(''); }
    });
  }
  function startEdit() {
    setEdits({definition: card.definition, structuralFit: (card.structuralFit ?? []).join('\n'), disqualifiers: (card.disqualifiers ?? []).join('\n')});
    setMode('edit');
  }
  async function deepen() {
    const result = await runAction({type: 'deepen', icpId: card.id}, `Deep verification run started for ${card.id}`);
    if (result?.id) { selectRun(result.id); setView('cockpit'); }
  }
  function findAccounts() {
    runAction({type: 'findAccounts', icpId: card.id, limit: 6}, 'Account discovery started — results appear in Accounts').then(result => { if (result) setView('accounts'); });
  }

  return (
    <article className={'icp-card ' + (rank >= 0 ? 'recommended' : '')}>
      <button className="icp-summary" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="id">{rank >= 0 ? `#${rank + 1}` : ''}<br />{card.id}</span>
        <span>
          <strong>{card.segment}</strong>
          <span className="sub">{card.offer} · {humanize(card.archetype)} · {card.motion} · buyer: {card.buyer}</span>
        </span>
        <ScoreRange score={card.score ?? card.preliminary} compact />
        <span className="badges">
          {card.decision && <Badge value={card.decision} label={DECISION_LABELS[card.decision]} />}
          <Grade grade={(card.score ?? card.preliminary)?.grade} />
          <Badge value={reviewStatus} label={'review: ' + humanize(reviewStatus)} />
          {open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
        </span>
      </button>

      {open && (
        <div className="icp-body">
          {card.decisionReason && <p className="callout"><strong>{DECISION_LABELS[card.decision]}:</strong> {card.decisionReason}</p>}
          <div className="fields">
            <div><small>Definition</small><p>{card.definition}</p></div>
            <div><small>Falsifiable hypothesis</small><p>{card.hypothesis}</p></div>
            <div><small>Pain / job to be done</small><p>{card.job || 'unknown'}</p></div>
            <div><small>Trigger</small><p>{card.trigger || 'unknown'}</p></div>
            <div><small>User · champion · economic buyer</small><p>{card.buyingGroup?.user ?? card.user} · {card.buyingGroup?.champion ?? 'to verify'} · {card.buyingGroup?.economicBuyer ?? card.buyer}</p></div>
            <div><small>Influencers and gates</small><p>{[...(card.buyingGroup?.influencers ?? []), ...(card.buyingGroup?.gates ?? [])].join(', ') || 'unknown'}</p></div>
            <div><small>Economics</small><p>{card.economics}</p></div>
            <div><small>Acquisition paths</small><p>{card.channels?.join(', ') || 'to research'}</p></div>
            <div><small>Buying intent</small><p><Badge value={card.buyingIntent === 'not_observed' ? 'unknown' : 'neutral'} label={humanize(card.buyingIntent)} /> {card.timingSignals?.length ? <span className="small muted">{card.timingSignals.length} weak timing signals (not intent)</span> : null}</p></div>
            <div><small>Commercial validation · maturity</small><p><Badge value={card.commercialValidation === 'validated' ? 'validated' : 'unknown'} label={humanize(card.commercialValidation)} /> <Badge value={card.maturity} /></p></div>
            <div><small>Coverage · fit confidence</small><p>{card.coveragePct ?? card.preliminary?.coveragePct ?? 0}% of scored dimensions · {card.fitConfidence ?? 'low'}</p></div>
            <div><small>Next best test</small><p>{humanize(card.nextBestTest)}{card.costToValidate ? ` · cost ${card.costToValidate}` : ''}</p></div>
          </div>

          <div className="cols-3">
            <div><h4>Structural-fit criteria</h4><List items={card.structuralFit} /></div>
            <div><h4>Disqualifiers</h4><List items={card.disqualifiers} /></div>
            <div><h4>Boundary examples</h4><List items={card.boundaryExamples} /></div>
          </div>

          {card.score && (
            <div>
              <h4>Score breakdown (each dimension is a range; missing evidence widens, it never scores zero)</h4>
              <div className="table-wrap">
                <table className="dims">
                  <thead><tr><th>Dimension</th><th>Weight</th><th>Range (0–5)</th><th>Basis</th><th>Claims</th></tr></thead>
                  <tbody>
                    {card.score.dimensions.map(item => (
                      <tr key={item.dimension}><td>{item.label}</td><td>{item.weight}</td><td>{item.range[0]}–{item.range[1]}</td><td>{item.basis}</td><td className="mono">{item.claimIds?.join(', ')}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid-even">
            <div>
              <h4>Supporting claims ({supporting.length})</h4>
              {supporting.length ? supporting.slice(0, 6).map(claim => (
                <div className="claim" key={claim.id}>
                  <span className="mono">{claim.id}</span> <Badge value={claim.epistemic} /> {claim.interestedParty && <Badge tone="warn" label="interested party" />} {claim.statement}<br />
                  <Quote text={claim.quote} url={claim.sourceUrl} />
                </div>
              )) : <p className="muted small">No verified supporting claims.</p>}
            </div>
            <div>
              <h4>Counter-evidence and red team</h4>
              <p className="small"><Badge value={card.redTeam?.status} label={'red team: ' + humanize(card.redTeam?.status)} /> {card.redTeam?.strongestAgainst}</p>
              {counter.slice(0, 4).map(claim => (
                <div className="claim" key={claim.id}><span className="mono">{claim.id}</span> <Badge value={claim.direction === 'exclusion' ? 'reject' : 'concern'} label={claim.direction} /> {claim.statement}<br /><Quote text={claim.quote} url={claim.sourceUrl} /></div>
              ))}
              {card.hardExclusion && <p className="notice error" style={{marginTop: 8}}>Hard exclusion: {card.hardExclusion}</p>}
            </div>
          </div>

          <div className="grid-even">
            <div>
              <h4>Gates</h4>
              <div className="gates">
                {(card.gates ?? []).map(gate => <Badge key={gate.gate} value={gate.pass ? 'pass' : 'fail'} label={`${gate.pass ? '✓' : '✗'} ${gate.gate}`} title={gate.detail} />)}
                {(card.gateIssues ?? []).map(issue => <Badge key={issue} value="concern" label={issue} />)}
                {!card.gates?.length && !card.gateIssues?.length && <span className="muted small">Gates are evaluated at S9.</span>}
              </div>
            </div>
            <div>
              <h4>Alternatives for {card.offer}</h4>
              <List items={alternatives.map(item => <><strong>{item.name}</strong> <span className="muted">({humanize(item.type)})</span> — {item.note}</>)} />
            </div>
          </div>

          {card.review?.status && card.review.status !== 'pending' && (
            <p className="small muted">Review: {humanize(card.review.status)} by {card.review.by?.replace('human:', '')} {card.review.note ? `— “${card.review.note}”` : ''}{card.review.reasonCode ? ` (${humanize(card.review.reasonCode)})` : ''}</p>
          )}

          <div className="review-bar">
            <button className="btn good" disabled={busy || running} onClick={() => setMode(mode === 'accept' ? null : 'accept')}><Check size={14} /> Accept</button>
            <button className="btn danger" disabled={busy || running} onClick={() => setMode(mode === 'reject' ? null : 'reject')}><X size={14} /> Reject</button>
            <button className="btn" disabled={busy || running} onClick={() => (mode === 'edit' ? setMode(null) : startEdit())}><Pencil size={14} /> Edit</button>
            <button className="btn" disabled={busy || running} onClick={deepen} title="Start a deep-verification run on this segment and its boundary"><Microscope size={14} /> Deepen research</button>
            {card.review?.status === 'accepted' && (
              <button className="btn" disabled={busy} onClick={findAccounts} title="Search public sources for sample organizations that match the criteria"><Building2 size={14} /> Find sample accounts</button>
            )}
            {running && <span className="muted small">Review opens when research finishes.</span>}
          </div>

          {mode === 'accept' && (
            <div className="inline-form">
              <label className="field">Note {card.decision === 'reject' ? <span className="hint">(required — this overrides a hard exclusion)</span> : <span className="hint">(optional)</span>}
                <textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Why this is worth a field test" />
              </label>
              <div className="btn-row"><button className="btn primary" disabled={busy} onClick={() => review('accept')}>Confirm accept</button></div>
            </div>
          )}
          {mode === 'reject' && (
            <div className="inline-form">
              <div className="form-grid">
                <label className="field">Reason<ReasonSelect value={reason} onChange={setReason} codes={reasonCodes} /></label>
                <label className="field">Note<input value={note} onChange={event => setNote(event.target.value)} placeholder="What makes this a poor fit" /></label>
              </div>
              <div className="btn-row"><button className="btn danger" disabled={busy || !reason} onClick={() => review('reject')}>Confirm reject</button></div>
            </div>
          )}
          {mode === 'edit' && (
            <div className="inline-form">
              <label className="field">Definition<textarea value={edits.definition} onChange={event => setEdits({...edits, definition: event.target.value})} /></label>
              <div className="form-grid">
                <label className="field">Structural-fit criteria <span className="hint">(one per line)</span><textarea value={edits.structuralFit} onChange={event => setEdits({...edits, structuralFit: event.target.value})} /></label>
                <label className="field">Disqualifiers <span className="hint">(one per line)</span><textarea value={edits.disqualifiers} onChange={event => setEdits({...edits, disqualifiers: event.target.value})} /></label>
              </div>
              <div className="btn-row">
                <button className="btn primary" disabled={busy} onClick={() => review('edit', {edits: {
                  definition: edits.definition, structuralFit: edits.structuralFit.split('\n').map(line => line.trim()).filter(Boolean),
                  disqualifiers: edits.disqualifiers.split('\n').map(line => line.trim()).filter(Boolean),
                }})}>Save edits</button>
                <span className="muted small">Edits keep the previous version in the card history.</span>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
