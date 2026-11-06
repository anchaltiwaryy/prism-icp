'use client';
import { useMemo, useState } from 'react';
import { Flag } from 'lucide-react';
import { ANGLE_LABELS, Badge, Empty, fmtDay, humanize, Panel, Quote, usePrism } from './ui';

const TABS = [['claims', 'Claims'], ['sources', 'Sources'], ['rejected', 'Rejected extractions'], ['entities', 'Organizations'], ['gaps', 'Skipped sources']];

export default function Evidence() {
  const {run} = usePrism();
  const [tab, setTab] = useState('claims');
  if (!run) return <Panel><Empty title="Select a run" /></Panel>;
  const counts = {claims: run.claims?.length, sources: run.sources?.length, rejected: run.rejectedExtractions?.length,
    entities: run.organizations?.length, gaps: run.sourceGaps?.length};
  return (
    <>
      <div className="segmented" role="tablist" aria-label="Evidence views">
        {TABS.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {label} ({counts[key] ?? 0})
          </button>
        ))}
      </div>
      {tab === 'claims' && <Claims run={run} />}
      {tab === 'sources' && <Sources run={run} />}
      {tab === 'rejected' && <Rejected run={run} />}
      {tab === 'entities' && <Entities run={run} />}
      {tab === 'gaps' && <Gaps run={run} />}
    </>
  );
}

function Claims({run}) {
  const {runAction, withActor, busy} = usePrism();
  const [segment, setSegment] = useState('');
  const [direction, setDirection] = useState('');
  const [epistemic, setEpistemic] = useState('');
  const [search, setSearch] = useState('');
  const claims = useMemo(() => (run.claims ?? []).filter(claim =>
    (!segment || claim.segmentId === segment) && (!direction || claim.direction === direction) && (!epistemic || claim.epistemic === epistemic) &&
    (!search || (claim.statement + ' ' + claim.quote).toLowerCase().includes(search.toLowerCase()))), [run, segment, direction, epistemic, search]);
  const segmentName = id => id === 'general' ? 'General (offer-level)' : run.segments?.find(item => item.id === id)?.name ?? id;
  function flag(claim) {
    withActor(actor => runAction({type: 'flag', targetType: 'claim', targetId: claim.id, verdict: 'negative', reasonCode: 'bad_claim', actor,
      note: 'Flagged from evidence ledger'}, `${claim.id} flagged — it no longer counts toward scores on re-scoring and feeds source learning`));
  }
  return (
    <Panel title="Claim ledger" text="A claim is admitted only when its quote appears verbatim in a retained page. Verification is a separate, independent check.">
      <div className="filters">
        <select value={segment} onChange={event => setSegment(event.target.value)} aria-label="Segment">
          <option value="">All segments</option><option value="general">General (offer-level)</option>
          {(run.segments ?? []).map(item => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}
        </select>
        <select value={direction} onChange={event => setDirection(event.target.value)} aria-label="Direction">
          <option value="">All directions</option><option value="support">Support</option><option value="challenge">Challenge</option><option value="exclusion">Exclusion</option>
        </select>
        <select value={epistemic} onChange={event => setEpistemic(event.target.value)} aria-label="Epistemic label">
          <option value="">All labels</option>
          {['verified', 'corroborated', 'observed', 'inferred', 'contradicted', 'unresolved'].map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search statement or quote" aria-label="Search claims" />
        <span className="muted small">{claims.length} of {run.claims?.length ?? 0}</span>
      </div>
      {claims.length ? (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>ID</th><th>Segment · angle</th><th>Direction</th><th>Label</th><th>Verifier</th><th>Statement and quote</th><th>Source</th><th /></tr></thead>
            <tbody>
              {claims.map(claim => {
                const source = run.sources?.find(item => item.id === claim.sourceId);
                return (
                  <tr key={claim.id}>
                    <td className="mono">{claim.id}</td>
                    <td className="small">{claim.segmentId}<br /><span className="muted">{ANGLE_LABELS[claim.angle] ?? claim.angle}</span></td>
                    <td><Badge value={claim.direction === 'support' ? 'pass' : claim.direction === 'exclusion' ? 'reject' : 'concern'} label={claim.direction} /></td>
                    <td>
                      <Badge value={claim.epistemic} />
                      {claim.interestedParty && <div><Badge tone="warn" label="interested party" /></div>}
                      {claim.stale && <div><Badge tone="warn" label="stale" /></div>}
                      {claim.signalType && claim.signalType !== 'none' && <div><Badge tone="outline" label={humanize(claim.signalType)} /></div>}
                    </td>
                    <td className="small">{claim.verification ? <><Badge value={claim.verification.verdict} /><br /><span className="muted">{claim.verification.reason}</span></> : <span className="muted">{claim.analyst === 'keyword-heuristic' ? 'not verifiable (keyword match)' : 'unchecked'}</span>}</td>
                    <td style={{minWidth: 280}}>{claim.statement}<br /><Quote text={claim.quote} max={260} /><br /><span className="muted small">{segmentName(claim.segmentId)}</span></td>
                    <td className="small" style={{minWidth: 150}}>
                      <a href={claim.sourceUrl} target="_blank" rel="noreferrer">{source?.title?.slice(0, 50) ?? claim.sourceUrl}</a><br />
                      <span className="muted">tier {claim.tier} · family {claim.family}{claim.published ? ' · ' + claim.published : ''}</span>
                    </td>
                    <td>
                      {claim.humanChallenged ? <Badge tone="bad" label="flagged" /> :
                        <button className="btn small" disabled={busy} onClick={() => flag(claim)} title="Flag: the quote does not support this statement"><Flag size={12} /> Flag</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <Empty title="No claims match" text="Claims appear after extraction (S5)." />}
    </Panel>
  );
}

function Sources({run}) {
  const [tier, setTier] = useState('');
  const sources = (run.sources ?? []).filter(source => !tier || String(source.tier) === tier);
  return (
    <Panel title="Retained sources" text="Syndicated or mirrored copies share an origin family and count once. Business-owned pages are interested parties.">
      <div className="filters">
        <select value={tier} onChange={event => setTier(event.target.value)} aria-label="Source tier">
          <option value="">All tiers</option>
          <option value="1">Tier 1 · first-party / registry</option><option value="2">Tier 2 · standards / institutions</option>
          <option value="3">Tier 3 · journalism / reviews</option><option value="4">Tier 4 · forums / jobs / events</option>
        </select>
        <span className="muted small">{sources.length} sources · {new Set(sources.map(source => source.family)).size} families</span>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>ID</th><th>Page</th><th>Tier · kind</th><th>Family</th><th>Found by</th><th>Dates</th><th>Flags</th></tr></thead>
          <tbody>
            {sources.map(source => (
              <tr key={source.id}>
                <td className="mono">{source.id}</td>
                <td style={{minWidth: 260}}><a href={source.url} target="_blank" rel="noreferrer">{source.title || source.url}</a><br /><span className="muted small">{source.domain}</span><br /><span className="small muted">{source.excerpt?.slice(0, 160)}…</span></td>
                <td className="small">Tier {source.tier}<br /><span className="muted">{humanize(source.kind)}</span></td>
                <td className="small mono">{source.family}{source.syndicated && <div><Badge tone="warn" label="syndicated copy" /></div>}</td>
                <td className="small">{humanize(source.adapter)}{source.query && <><br /><span className="muted">“{source.query}”</span></>}{source.segmentId && <><br /><span className="muted">{source.segmentId} · {source.angle} · {source.direction}</span></>}</td>
                <td className="small">{source.published ? 'Published ' + source.published : 'No publish date'}<br /><span className="muted">Observed {fmtDay(source.observed)}</span></td>
                <td>
                  {source.interestedParty && <Badge tone="warn" label="interested party" />}
                  {source.injectionSuspected && <div><Badge tone="bad" label="prompt-injection text stripped" /></div>}
                  {source.refresh && <div><Badge value={source.refresh === 'unchanged' ? 'done' : 'concern'} label={source.refresh} /></div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!sources.length && <Empty title="No sources retained" text="Add a reachable website, or configure SearXNG for broader search." />}
    </Panel>
  );
}

function Rejected({run}) {
  const rows = run.rejectedExtractions ?? [];
  return (
    <Panel title="Rejected extractions" text="Model-drafted claims that failed the literal quote gate or referenced an unknown segment. Kept for audit, never scored.">
      {rows.length ? (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Source</th><th>Segment</th><th>Statement</th><th>Quote offered</th><th>Reason</th></tr></thead>
            <tbody>{rows.map((row, index) => (
              <tr key={index}><td className="mono">{row.sourceId}</td><td className="small">{row.segmentId}</td><td>{row.statement}</td><td><Quote text={row.quote} /></td><td><Badge tone="bad" label={row.reason} /></td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : <Empty title="Nothing rejected" text="Every extracted quote was found in its source." />}
    </Panel>
  );
}

function Entities({run}) {
  const orgs = run.organizations ?? [];
  return (
    <div className="grid-even">
      <Panel title="Organizations" text="Merged only on a shared registrable domain — never on a similar name.">
        {orgs.length ? (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Name</th><th>Domain</th><th>Roles</th><th>Sources</th></tr></thead>
              <tbody>{orgs.map(org => (
                <tr key={org.id}><td>{org.name}{org.aliases?.length > 1 && <div className="muted small">aka {org.aliases.slice(1).join(', ')}</div>}{org.isBusinessItself && <div><Badge tone="outline" label="the business itself" /></div>}</td>
                  <td className="small">{org.domain ?? <span className="muted">no identifier</span>}</td><td className="small">{org.roles?.map(humanize).join(', ')}</td><td className="mono">{org.sourceIds?.join(', ')}</td></tr>
              ))}</tbody>
            </table>
          </div>
        ) : <Empty title="No organizations extracted" />}
      </Panel>
      <Panel title="Ambiguity queue" text="Similar names held back for a human instead of being merged.">
        {run.ambiguities?.length ? (
          <ul>{run.ambiguities.map((item, index) => <li key={index}><strong>{item.name}</strong>{item.domain ? ` (${item.domain})` : ''} — {item.reason} <span className="mono muted">{item.sourceId}</span></li>)}</ul>
        ) : <p className="muted small">No ambiguous names.</p>}
      </Panel>
    </div>
  );
}

function Gaps({run}) {
  const gaps = run.sourceGaps ?? [];
  const reasons = gaps.reduce((acc, gap) => ({...acc, [gap.reason]: (acc[gap.reason] ?? 0) + 1}), {});
  return (
    <Panel title="Skipped and blocked sources" text="Every source PRISM did not use, and why. Lower coverage is shown, never filled in.">
      <div className="btn-row" style={{marginBottom: 12}}>{Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => <Badge key={reason} tone="neutral" label={`${count} × ${reason}`} />)}</div>
      {gaps.length ? (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>URL</th><th>Reason</th></tr></thead>
            <tbody>{gaps.slice(0, 300).map((gap, index) => <tr key={index}><td className="small" style={{wordBreak: 'break-all'}}>{gap.url}</td><td className="small">{gap.reason}</td></tr>)}</tbody>
          </table>
        </div>
      ) : <Empty title="No skipped sources" />}
    </Panel>
  );
}
