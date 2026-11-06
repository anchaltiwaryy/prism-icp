'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Briefcase, Building2, FileSearch, FlaskConical, GraduationCap, History, LayoutDashboard, Plus, ShieldAlert, Sparkles, Target,
} from 'lucide-react';
import { api, Badge, humanize, PrismContext } from './components/ui';
import Cockpit from './components/Cockpit';
import Icps from './components/Icps';
import Evidence from './components/Evidence';
import RedTeam from './components/RedTeam';
import Validation from './components/Validation';
import Accounts from './components/Accounts';
import Learning from './components/Learning';
import Runs from './components/Runs';
import Business from './components/Business';
import NewRunModal from './components/NewRunModal';

const VIEWS = [
  {key: 'cockpit', label: 'Cockpit', icon: LayoutDashboard, title: 'Research cockpit', text: 'Stages, budgets, coverage and the live log for the selected run.'},
  {key: 'icps', label: 'ICPs', icon: Target, title: 'ICP portfolio', text: 'Every hypothesis with its score range, evidence grade, objections and your review decision.'},
  {key: 'evidence', label: 'Evidence', icon: FileSearch, title: 'Evidence ledger', text: 'Claims, quotes and sources with provenance, verification verdicts and what was rejected.'},
  {key: 'redteam', label: 'Red team', icon: ShieldAlert, title: 'Adversarial report', text: 'Fifteen attacks per shortlisted ICP. A fail needs a checkable citation.'},
  {key: 'validation', label: 'Validation', icon: FlaskConical, title: 'Validation sprint', text: 'Pre-registered field tests. Only real outcomes can validate an ICP commercially.'},
  {key: 'accounts', label: 'Accounts', icon: Building2, title: 'Accounts & outreach', text: 'Sample organizations for accepted ICPs, human approval, tagged drafts and a dry-run outbox.'},
  {key: 'learning', label: 'Learning', icon: GraduationCap, title: 'Outcome learning', text: 'Outcomes, calibration, source precision and human-approved strategy changes.'},
  {key: 'runs', label: 'Runs', icon: History, title: 'Research runs', text: 'History, comparisons and exports.'},
  {key: 'business', label: 'Business', icon: Briefcase, title: 'Business understanding', text: 'What the owner declared, what the public site shows, and what was inferred.'},
];
const ACTIVE = ['running', 'queued'];

function readStorage(key) { try { return window.localStorage.getItem(key) ?? ''; } catch { return ''; } }
function writeStorage(key, value) { try { window.localStorage.setItem(key, value); } catch { /* storage unavailable */ } }

export default function Dashboard() {
  const [runs, setRuns] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [run, setRun] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [view, setView] = useState('cockpit');
  const [modal, setModal] = useState(false);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reviewer, setReviewer] = useState('');
  const [askName, setAskName] = useState(null);
  const [nameDraft, setNameDraft] = useState('');
  const selectedRef = useRef('');

  useEffect(() => {
    setReviewer(readStorage('prism.reviewer'));
    const stored = readStorage('prism.run');
    if (stored) { setSelectedId(stored); selectedRef.current = stored; }
  }, []);

  const loadRuns = useCallback(async () => {
    try {
      const list = await api('/api/runs');
      setRuns(list);
      if (!selectedRef.current && list.length) { selectedRef.current = list[0].id; setSelectedId(list[0].id); }
      if (selectedRef.current && list.length && !list.some(item => item.id === selectedRef.current)) {
        selectedRef.current = list[0].id; setSelectedId(list[0].id);
      }
    } catch (error) { setRuns(current => current ?? []); }
  }, []);

  const loadRun = useCallback(async (id = selectedRef.current) => {
    if (!id) { setRun(null); return; }
    try { const data = await api('/api/runs/' + id); if (id === selectedRef.current) setRun(data); }
    catch (error) { if (id === selectedRef.current) setRun(null); }
  }, []);

  const loadWorkspace = useCallback(async () => {
    try { setWorkspace(await api('/api/workspace')); } catch { /* keep last value */ }
  }, []);

  useEffect(() => { loadRuns(); loadWorkspace(); const timer = setInterval(loadRuns, 3000); return () => clearInterval(timer); }, [loadRuns, loadWorkspace]);
  useEffect(() => { loadRun(selectedId); }, [selectedId, loadRun]);
  useEffect(() => {
    if (!ACTIVE.includes(run?.status)) return undefined;
    const timer = setInterval(() => loadRun(), 2500);
    return () => clearInterval(timer);
  }, [run?.status, loadRun]);
  const jobsRunning = workspace?.jobs?.some(job => job.status === 'running');
  useEffect(() => {
    if (!['accounts', 'learning'].includes(view) && !jobsRunning) return undefined;
    const timer = setInterval(loadWorkspace, 5000);
    return () => clearInterval(timer);
  }, [view, jobsRunning, loadWorkspace]);

  const selectRun = useCallback(id => {
    selectedRef.current = id; setSelectedId(id); writeStorage('prism.run', id);
  }, []);

  /** Run an API action with busy state, inline errors and a refresh of everything it may have changed. */
  const act = useCallback(async (fn, success) => {
    setBusy(true); setNotice(null);
    try {
      const result = await fn();
      if (success) setNotice({kind: 'ok', text: typeof success === 'function' ? success(result) : success});
      await Promise.all([loadRun(), loadRuns(), loadWorkspace()]);
      return result;
    } catch (error) {
      setNotice({kind: 'error', text: error.message});
      return null;
    } finally { setBusy(false); }
  }, [loadRun, loadRuns, loadWorkspace]);

  /** Every human decision carries a named reviewer (logical sign-off, PRD §22). */
  const withActor = useCallback(callback => {
    if (reviewer) return callback('human:' + reviewer);
    setNameDraft('');
    setAskName(() => callback);
    return null;
  }, [reviewer]);

  function saveName(event) {
    event.preventDefault();
    const name = nameDraft.trim().replace(/[^\w .@-]/g, '').slice(0, 60);
    if (!name) return;
    setReviewer(name); writeStorage('prism.reviewer', name);
    const pending = askName; setAskName(null);
    if (pending) pending('human:' + name);
  }

  const runAction = useCallback((payload, success) => act(() => api('/api/runs/' + selectedRef.current, payload), success), [act]);
  const workspaceAction = useCallback((payload, success) => act(() => api('/api/workspace', payload), success), [act]);

  const context = useMemo(() => ({
    run, runs: runs ?? [], workspace, busy, reviewer, act, withActor, runAction, workspaceAction, selectRun, setView,
    reasonCodes: workspace?.reasonCodes ?? {}, openNewRun: () => setModal(true), notify: setNotice, refreshWorkspace: loadWorkspace,
  }), [run, runs, workspace, busy, reviewer, act, withActor, runAction, workspaceAction, selectRun, loadWorkspace]);

  const current = VIEWS.find(item => item.key === view);
  const counts = {
    icps: run?.cards?.length, evidence: run?.claims?.length,
    accounts: workspace?.accounts?.filter(account => account.state === 'HUMAN_REVIEW').length || undefined,
    validation: run?.experiments?.length, runs: runs?.length,
  };

  async function startPilot(mode) {
    const result = await act(() => api('/api/runs', {pilot: 'foxfoster', mode, topCount: 3}), 'FoxFoster pilot started');
    if (result?.id) { selectRun(result.id); setView('cockpit'); setModal(false); }
  }

  return (
    <PrismContext.Provider value={context}>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-icon"><Sparkles size={18} /></div>
            <div><strong>PRISM</strong><small>Evidence-led GTM system</small></div>
          </div>
          <button className="btn primary" onClick={() => setModal(true)}><Plus size={15} /> New research</button>
          <div className="side-caption">WORKSPACE</div>
          <nav className="nav" aria-label="Views">
            {VIEWS.map(({key, label, icon: Icon}) => (
              <button key={key} className={'nav-item ' + (view === key ? 'selected' : '')} onClick={() => setView(key)} aria-current={view === key ? 'page' : undefined}>
                <Icon size={16} /><span>{label}</span>{counts[key] ? <span className="count">{counts[key]}</span> : null}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="health" aria-live="polite">
              <strong>System</strong>
              <div className="row"><Activity size={13} /> <span>Model: {workspace?.health?.llm ?? 'checking…'}</span></div>
              <div className="row"><FileSearch size={13} /> <span>Search: {workspace?.health?.search ?? '…'}</span></div>
              <div className="row"><ShieldAlert size={13} /> <span>Outreach: dry-run only, never sent</span></div>
            </div>
            <div className="reviewer-chip">
              <div className="avatar">{(reviewer || '?').slice(0, 2).toUpperCase()}</div>
              <span>{reviewer || 'No reviewer set'}<small>Signs human decisions</small></span>
              <button className="btn link small" onClick={() => { setNameDraft(reviewer); setAskName(() => () => {}); }}>{reviewer ? 'Change' : 'Set'}</button>
            </div>
          </div>
        </aside>

        <main className="main">
          <header className="topbar">
            <div className="run-picker">
              <span className="eyebrow">Run</span>
              {runs?.length ? (
                <select value={selectedId} onChange={event => selectRun(event.target.value)} aria-label="Selected research run">
                  {runs.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {humanize(item.mode)} · {humanize(item.status)} · {new Date(item.createdAt).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              ) : <span className="muted small">No runs yet</span>}
              {run && <Badge value={run.status} />}
            </div>
            <div className="top-actions">
              {run && <a className="btn small" href={`/api/runs/${run.id}/export?format=memo`}>Decision memo</a>}
              <button className="btn small" onClick={() => setModal(true)}><Plus size={14} /> New research</button>
            </div>
          </header>

          <div className="content">
            <div className="page-heading">
              <div>
                <div className="eyebrow">{run ? run.brief?.name : 'PRISM'}</div>
                <h1>{current.title}</h1>
                <p>{current.text}</p>
              </div>
            </div>
            {notice && (
              <div className={'notice ' + notice.kind} role={notice.kind === 'error' ? 'alert' : 'status'}>
                <span>{notice.text}</span>
                <button className="btn link small" onClick={() => setNotice(null)} aria-label="Dismiss message">Dismiss</button>
              </div>
            )}
            {runs !== null && !runs.length && !['learning', 'accounts'].includes(view) ? (
              <section className="panel onboarding">
                <div className="brand-icon" style={{height: 48, width: 48}}><Sparkles size={22} /></div>
                <h2>Start with what you sell</h2>
                <p>PRISM maps plausible markets, collects public evidence, challenges every hypothesis with a red team, verifies claims against
                  their sources and recommends at most a few ICPs to test in the field. It is allowed to recommend none.</p>
                <div className="btn-row">
                  <button className="btn primary" onClick={() => setModal(true)}><Plus size={15} /> Start a research run</button>
                  <button className="btn" onClick={() => startPilot('quick')} disabled={busy}>Research FoxFoster pilot (quick)</button>
                </div>
              </section>
            ) : (
              <>
                {view === 'cockpit' && <Cockpit />}
                {view === 'icps' && <Icps />}
                {view === 'evidence' && <Evidence />}
                {view === 'redteam' && <RedTeam />}
                {view === 'validation' && <Validation />}
                {view === 'accounts' && <Accounts />}
                {view === 'learning' && <Learning />}
                {view === 'runs' && <Runs />}
                {view === 'business' && <Business />}
              </>
            )}
          </div>
        </main>

        {modal && <NewRunModal onClose={() => setModal(false)} onPilot={startPilot}
          onStarted={id => { selectRun(id); setView('cockpit'); setModal(false); }} />}

        {askName !== null && (
          <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setAskName(null); }}>
            <form className="modal" onSubmit={saveName} style={{width: 'min(440px, 100%)'}}>
              <div className="modal-head">
                <div><div className="eyebrow">Reviewer</div><h2>Who is signing this decision?</h2></div>
                <button type="button" className="btn link" onClick={() => setAskName(null)} aria-label="Close">Close</button>
              </div>
              <p className="muted small">Human decisions (accepting ICPs, approving accounts, validating outcomes, adopting learning changes) are recorded with your name. It is stored only in this browser.</p>
              <label className="field">Your name<input autoFocus value={nameDraft} onChange={event => setNameDraft(event.target.value)} placeholder="e.g. Anchal" maxLength={60} /></label>
              <div className="btn-row"><button className="btn primary" type="submit" disabled={!nameDraft.trim()}>Save and continue</button></div>
            </form>
          </div>
        )}
      </div>
    </PrismContext.Provider>
  );
}
