'use client';
import { Badge, Empty, humanize, List, Panel, Quote, usePrism } from './ui';

const ORIGINS = [['user_declared', 'Declared by the owner'], ['publicly_observed', 'Observed on the public site (quoted)'], ['agent_inferred', 'Inferred by the model — confirm']];

export default function Business() {
  const {run} = usePrism();
  if (!run) return <Panel><Empty title="Select a run" /></Panel>;
  const profile = run.profile;
  const policy = run.policy ?? {};
  return (
    <>
      <Panel eyebrow="Business Understanding Card" title={run.brief?.name} text={profile?.summary ?? 'Built at S1.'}
        actions={<a className="btn small" href={`/api/runs/${run.id}/export?format=json`}>Export JSON</a>}>
        {profile ? (
          <div className="stack">
            <div className="btn-row">
              <Badge tone="outline" label={'Model: ' + humanize(profile.businessModel)} />
              <Badge tone="outline" label={'Geography: ' + (profile.geographies ?? []).join(', ')} />
              <Badge tone="outline" label={'Understood by: ' + profile.understoodBy} />
              {profile.domain && <Badge tone="outline" label={profile.domain} />}
            </div>
            <div className="cols-3">
              {ORIGINS.map(([origin, label]) => {
                const facts = (profile.facts ?? []).filter(fact => fact.origin === origin);
                return (
                  <div key={origin}>
                    <h4>{label} ({facts.length})</h4>
                    {facts.length ? facts.map((fact, index) => (
                      <div className="claim" key={index}>{fact.statement}{fact.quote && <><br /><Quote text={fact.quote} url={fact.sourceUrl} /></>}{fact.note && <div className="muted small">{fact.note}</div>}</div>
                    )) : <p className="muted small">None.</p>}
                  </div>
                );
              })}
            </div>
          </div>
        ) : <p className="muted small">The business profile is built at S1.</p>}
      </Panel>

      {profile?.offers?.length > 0 && (
        <Panel title="Offers" text="Each offer gets its own segment tree. Outcomes are labelled by where they came from, or unknown.">
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Offer</th><th>Problem / outcome</th><th>User job</th><th>Buyer job</th><th>Origin</th><th>Public observation</th></tr></thead>
              <tbody>{profile.offers.map(offer => (
                <tr key={offer.id}>
                  <td><strong>{offer.name}</strong><div className="muted small">{offer.category}</div></td>
                  <td>{offer.promisedOutcome ?? offer.problem}<div><Badge value={offer.outcomeStatus} label={'outcome: ' + humanize(offer.outcomeStatus)} /></div></td>
                  <td className="small">{offer.userJob}</td><td className="small">{offer.buyerJob}</td>
                  <td><Badge value={offer.origin} /></td>
                  <td>{offer.observation ? <Quote text={offer.observation.quote} url={offer.observation.sourceUrl} /> : <span className="muted small">none</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Panel>
      )}

      <div className="grid-even">
        <Panel title="Assumptions and unknowns" text="Nothing here is silently filled in. Confirm or correct before investing.">
          <h4>Assumptions</h4>
          <List items={(profile?.assumptions ?? []).map(item => `${item.id}: ${item.text} (${item.status})`)} />
          <h4 style={{marginTop: 12}}>Unknowns</h4>
          <List items={profile?.unknowns} />
        </Panel>
        <Panel title="Run policy" text={`${policy.version} · hash ${policy.hash}`}>
          <div className="stack small">
            <p><strong>{policy.modeLabel}</strong> · {policy.limits?.maxPages} pages · {policy.limits?.maxSearches} searches · {policy.limits?.maxModelCalls} model calls · ${policy.limits?.maxUsd} · {policy.limits?.deadlineMin} min</p>
            <p>Robots: {policy.robots} · personal data: {humanize(policy.personalData)} · outreach: {humanize(policy.outreach)} · retention {policy.retentionDays} days</p>
            <p>{policy.forbiddenDomains?.length ?? 0} forbidden domains: <span className="muted">{policy.forbiddenDomains?.join(', ')}</span></p>
            <div className="btn-row">{Object.entries(policy.adapters ?? {}).map(([id, status]) => <Badge key={id} value={status} label={`${id}: ${status}`} />)}</div>
          </div>
        </Panel>
      </div>

      <Panel title="Brief as submitted">
        <div className="fields">
          {Object.entries(run.brief ?? {}).filter(([key]) => key !== 'offers').map(([key, value]) => (
            <div key={key}><small>{humanize(key)}</small><p>{Array.isArray(value) ? value.join(', ') || '—' : String(value ?? '—')}</p></div>
          ))}
          <div><small>Offers</small><p>{(run.brief?.offers ?? []).map(offer => offer.name).join(', ') || run.brief?.offer}</p></div>
        </div>
      </Panel>
    </>
  );
}
