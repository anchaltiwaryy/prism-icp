'use client';
import { createContext, useContext } from 'react';

/** Shared dashboard context: selected run, workspace, and action helpers. */
export const PrismContext = createContext(null);
export const usePrism = () => useContext(PrismContext);

export async function api(url, payload) {
  const response = await fetch(url, payload === undefined ? {cache: 'no-store'} : {
    method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export const STAGE_LABELS = {
  S0: 'Policy & budgets', S1: 'Business understanding', S2: 'Market universe', S3: 'Source plan', S4: 'Collection',
  S5: 'Extraction & entities', S6: 'Hypotheses', S7: 'Competition & economics', S8: 'Red team',
  S9: 'Verification & scoring', S10: 'Portfolio & validation sprint', S11: 'Human review',
  R1: 'Re-check sources', R2: 'Carry hypotheses', R3: 'Delta report',
};
export const STAGE_ORDER = {
  research: ['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11'],
  refresh: ['S0', 'R1', 'S5', 'R2', 'S9', 'S10', 'R3', 'S11'],
};
export const ANGLE_LABELS = {
  pain: 'Pain', roles: 'Users vs buyers', economics: 'Willingness to pay', competition: 'Substitutes', risks: 'Risks',
  timing: 'Timing', reach: 'Reach', friction: 'Friction', identity: 'Identity', fit: 'Strategic fit',
  technographic: 'Technographic', structure: 'Structure', macro: 'Macro', adjacency: 'Adjacency',
};
export const RED_TEAM_LABELS = {
  no_pain: 'No-pain', no_budget: 'No-budget', false_signal: 'False signal', substitution: 'Substitution',
  inaccessibility: 'Inaccessibility', economics: 'Economics', product_mismatch: 'Product mismatch', evidence_bias: 'Evidence bias',
  selection_bias: 'Selection bias', category_error: 'Category error', timing: 'Timing', regulation_trust: 'Regulation & trust',
  competitor_response: 'Competitor response', counterfactual: 'Counterfactual', boundary: 'Boundary',
};
export const DECISION_LABELS = {explore_first: 'Explore first', conditional_test: 'Conditional test', defer: 'Defer / watch', reject: 'Reject'};
export const OUTCOME_TYPES = ['interview', 'qualified_discovery', 'qualified_opportunity', 'meeting', 'reply', 'no_response', 'pilot', 'won', 'lost', 'churned'];

const TONES = {
  good: ['explore_first', 'verified', 'corroborated', 'pass', 'survive', 'complete', 'done', 'A', 'APPROVED', 'QUEUED', 'accepted',
    'supported', 'met', 'absent', 'passed', 'adopted', 'commercially_validated', 'validated', 'positive', 'better', 'searched', 'approved', 'likely'],
  info: ['conditional_test', 'inferred', 'revise', 'running', 'queued', 'B', 'DRAFTED', 'QUALIFIED', 'evidence_supported', 'field_testing',
    'overstated', 'planned', 'shadow', 'researched', 'possible', 'publicly_observed', 'user_declared'],
  warn: ['defer', 'unresolved', 'concern', 'awaiting_review', 'paused', 'interrupted', 'C', 'HUMAN_REVIEW', 'NEEDS_RESEARCH', 'pending',
    'promotional', 'revisit_later', 'inconclusive', 'neutral', 'searched_no_evidence', 'unknown', 'insufficient_labels', 'no_change',
    'weak_timing', 'restricted', 'agent_inferred', 'no_results'],
  bad: ['reject', 'contradicted', 'fail', 'failed', 'D', 'DISQUALIFIED', 'REJECTED', 'rejected', 'not_supported', 'mismatch', 'not_met',
    'present', 'negative', 'regression', 'shadow_failed', 'unlikely', 'disabled', 'cancelled'],
};
export function toneFor(value) {
  for (const [tone, values] of Object.entries(TONES)) if (values.includes(value)) return tone;
  return 'neutral';
}
export const humanize = value => String(value ?? '—').replace(/_/g, ' ');

export function Badge({value, label, tone, title}) {
  return <span className={'badge ' + (tone ?? toneFor(value))} title={title}>{label ?? humanize(value)}</span>;
}
export function Grade({grade}) {
  const meaning = {A: 'Strong documentary evidence, independently corroborated', B: 'Credible primary evidence, corroboration incomplete',
    C: 'Plausible secondary evidence or inference', D: 'Weak, promotional or contradictory evidence', U: 'Unknown or unassessed'};
  return <span className={'grade ' + toneFor(grade)} title={`Evidence grade ${grade}: ${meaning[grade] ?? ''}`} aria-label={`Evidence grade ${grade}`}>{grade ?? 'U'}</span>;
}

export function Panel({eyebrow, title, text, actions, children, className = ''}) {
  return (
    <section className={'panel ' + className}>
      {(title || actions) && (
        <div className="panel-head">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <h2>{title}</h2>}
            {text && <p>{text}</p>}
          </div>
          {actions && <div className="btn-row">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({title, text, children}) {
  return <div className="empty"><strong>{title}</strong>{text && <p>{text}</p>}{children}</div>;
}

export function List({items, empty = 'None recorded'}) {
  if (!items?.length) return <p className="muted small">{empty}</p>;
  return <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>;
}

export function ScoreRange({score, compact}) {
  if (!score) return <span className="muted small">Not scored</span>;
  const {low, high, mid} = score;
  return (
    <div className="score" aria-label={`Opportunity score range ${low} to ${high} out of 100`}>
      <div className="label"><span>Score {low}–{high}</span>{!compact && <span>width {high - low}</span>}</div>
      <div className="score-track">
        <span style={{left: low + '%', width: Math.max(1, high - low) + '%'}} />
        <i style={{left: `calc(${mid ?? Math.round((low + high) / 2)}% - 1px)`}} />
      </div>
    </div>
  );
}

export function Quote({text, url, max = 220}) {
  if (!text) return null;
  const short = text.length > max ? text.slice(0, max) + '…' : text;
  return <span className="quote">“{short}”{url && <> <a href={url} target="_blank" rel="noreferrer">source ↗</a></>}</span>;
}

export const fmtDate = value => value ? new Date(value).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : '—';
export const fmtDay = value => value ? new Date(value).toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'}) : '—';
export const money = value => '$' + (Number(value) || 0).toFixed(Number(value) >= 1 ? 2 : 3);

export function Meter({label, used = 0, limit = 0, format = value => value}) {
  const pct = limit ? Math.min(100, Math.round(100 * used / limit)) : 0;
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{format(used)}</strong>
      <small>of {format(limit)} budget</small>
      <div className={'meter ' + (pct >= 100 ? 'over' : '')} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span style={{width: pct + '%'}} /></div>
    </div>
  );
}

export function Metric({label, value, detail}) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

export function ReasonSelect({value, onChange, codes, includeEmpty = true}) {
  return (
    <select value={value} onChange={event => onChange(event.target.value)} aria-label="Reason code">
      {includeEmpty && <option value="">Choose a reason…</option>}
      {Object.entries(codes ?? {}).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
    </select>
  );
}
