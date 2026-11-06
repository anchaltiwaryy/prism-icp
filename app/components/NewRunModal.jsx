'use client';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { api, usePrism } from './ui';

export default function NewRunModal({onClose, onStarted, onPilot}) {
  const {busy} = usePrism();
  const [form, setForm] = useState({name: '', offer: '', problem: '', website: '', geography: '', model: 'b2b', mode: 'discovery', topCount: 3, excluded: ''});
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const set = (key, value) => setForm(current => ({...current, [key]: value}));

  async function submit(event) {
    event.preventDefault();
    setSending(true); setError('');
    try {
      const result = await api('/api/runs', {...form, topCount: Number(form.topCount),
        excludedMarkets: form.excluded.split(',').map(item => item.trim()).filter(Boolean)});
      onStarted(result.id);
    } catch (cause) { setError(cause.message); } finally { setSending(false); }
  }

  return (
    <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="modal" onSubmit={submit} aria-label="New research run">
        <div className="modal-head">
          <div><div className="eyebrow">New research</div><h2>Tell PRISM what you sell</h2><p className="muted small">Start small. Missing facts stay visible as unknowns — nothing is guessed.</p></div>
          <button type="button" className="btn link" onClick={onClose} aria-label="Close">Close</button>
        </div>
        <div className="example"><strong>Example:</strong> FoxFoster · “Corporate training” · “Close team cybersecurity skills gaps” · https://foxfoster.com · India · B2B</div>
        <label className="field">Business name<input required maxLength={160} value={form.name} onChange={event => set('name', event.target.value)} placeholder="e.g. Acme Analytics" /></label>
        <label className="field">What you sell<input required maxLength={160} value={form.offer} onChange={event => set('offer', event.target.value)} placeholder="e.g. Self-serve product analytics" /></label>
        <label className="field">Problem it solves<textarea required maxLength={600} value={form.problem} onChange={event => set('problem', event.target.value)} placeholder="Who benefits and what outcome you deliver, as you understand it today" /></label>
        <div className="form-grid">
          <label className="field">Website <span className="hint">(optional, HTTPS)</span><input value={form.website} onChange={event => set('website', event.target.value)} placeholder="https://example.com" /></label>
          <label className="field">Geography<input value={form.geography} onChange={event => set('geography', event.target.value)} placeholder="Global" /></label>
        </div>
        <div className="form-grid three">
          <label className="field">Market<select value={form.model} onChange={event => set('model', event.target.value)}><option value="b2b">B2B</option><option value="b2c">B2C</option><option value="mixed">Mixed</option></select></label>
          <label className="field">Depth<select value={form.mode} onChange={event => set('mode', event.target.value)}><option value="quick">Quick orientation</option><option value="discovery">Discovery</option><option value="deep">Deep verification</option></select></label>
          <label className="field">Show me<select value={form.topCount} onChange={event => set('topCount', event.target.value)}><option value={3}>Top 3 at most</option><option value={5}>Top 5 at most</option></select></label>
        </div>
        <label className="field">Excluded markets <span className="hint">(optional, comma-separated)</span><input value={form.excluded} onChange={event => set('excluded', event.target.value)} placeholder="e.g. government, gambling" /></label>
        {error && <p className="notice error">{error}</p>}
        <div className="btn-row">
          <button className="btn primary" disabled={sending}>{sending ? 'Starting…' : 'Start research'} <ArrowRight size={15} /></button>
          <button type="button" className="btn" disabled={busy || sending} onClick={() => onPilot(form.mode)}>Research FoxFoster pilot instead</button>
        </div>
        <p className="muted small">Research uses public pages only (robots.txt respected, no logins, no personal data) and may legitimately recommend zero ICPs.</p>
      </form>
    </div>
  );
}
