import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';

const SKILLS = ['Florist', 'Chef', 'Writer', 'Coder', 'Designer', 'Analyst', 'Translator', 'Researcher', 'Lawyer', 'Accountant'];

function TaskInterface({ agentName, skill, taskPrompt, setTaskPrompt, taskLoading, taskResult, onExecute }) {
  return (
    <div style={{ marginTop: 24, background: '#0d0d14', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 12, fontFamily: 'IBM Plex Mono', color: '#10b981', marginBottom: 12 }}>
        ⚡ {agentName} is ready — skill: {skill}
      </div>
      <textarea
        value={taskPrompt}
        onChange={e => setTaskPrompt(e.target.value)}
        placeholder={`Give ${agentName} a task...`}
        rows={3}
        style={{
          width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14,
          background: '#12121a', border: '1px solid rgba(255,255,255,0.08)',
          color: '#f0f0f5', fontFamily: 'IBM Plex Sans, sans-serif',
          resize: 'vertical', marginBottom: 12
        }}
      />
      <button onClick={onExecute} disabled={taskLoading} style={{
        padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
        background: '#10b981', color: '#000', border: 'none',
        fontFamily: 'IBM Plex Mono', opacity: taskLoading ? 0.7 : 1, cursor: 'pointer'
      }}>
        {taskLoading ? 'Running...' : '▶ Execute Task'}
      </button>
      {taskResult && (
        <div style={{ marginTop: 16, background: '#12121a', borderRadius: 8, padding: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 11, color: '#888899', fontFamily: 'IBM Plex Mono', marginBottom: 8 }}>
            {taskResult.agent_name} ({taskResult.skill}) responded:
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: '#f0f0f5', whiteSpace: 'pre-wrap' }}>
            {taskResult.result}
          </div>
          {taskResult.verification && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 6,
              background: taskResult.verification.passed ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${taskResult.verification.passed ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
              fontFamily: 'IBM Plex Mono', fontSize: 11
            }}>
              <span style={{ color: taskResult.verification.passed ? '#10b981' : '#ef4444' }}>
                {taskResult.verification.passed ? '✓ Arbiter verified' : '✗ Arbiter flagged'}
              </span>
              <span style={{ color: '#888899', marginLeft: 8 }}>
                Score: {taskResult.verification.score}/100
              </span>
              <span style={{
                marginLeft: 8, padding: '1px 6px', borderRadius: 3,
                background: 'rgba(255,255,255,0.06)', color: '#c4b5fd'
              }}>
                {taskResult.verification.trust_tier}
              </span>
              <span style={{ color: taskResult.verification.passed ? '#10b981' : '#ef4444', marginLeft: 8 }}>
                {taskResult.verification.passed ? `+${taskResult.verification.token_reward}` : `-${taskResult.verification.token_penalty}`} tokens
              </span>
              {taskResult.verification.reasoning && (
                <div style={{ color: '#666677', marginTop: 6, fontSize: 10, lineHeight: 1.5 }}>
                  {taskResult.verification.reasoning}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState('dashboard');
  const [agents, setAgents] = useState([]);
  const [activity, setActivity] = useState({ swaps: [], borrows: [] });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [arbiterStatus, setArbiterStatus] = useState(null); // null=checking, true=online, false=offline

  const [regName, setRegName] = useState('');
  const [regOwner, setRegOwner] = useState('');
  const [regSkills, setRegSkills] = useState([]);
  const [regApiKey, setRegApiKey] = useState('');
  const [regEndpoint, setRegEndpoint] = useState('https://api.anthropic.com/v1/messages');
  const [pendingAgent, setPendingAgent] = useState(null);

  const [selectedAgent, setSelectedAgent] = useState('');
  const [skillNeeded, setSkillNeeded] = useState('');
  const [swapResult, setSwapResult] = useState(null);
  const [borrowResult, setBorrowResult] = useState(null);

  const [taskPrompt, setTaskPrompt] = useState('');
  const [taskResult, setTaskResult] = useState(null);
  const [taskLoading, setTaskLoading] = useState(false);
  const [activeAccess, setActiveAccess] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAgents = useCallback(async () => {
    const r = await fetch('/api/agents');
    const d = await r.json();
    setAgents(d.agents || []);
  }, []);

  const fetchActivity = useCallback(async () => {
    const r = await fetch('/api/activity');
    const d = await r.json();
    setActivity(d);
  }, []);

  const checkArbiter = useCallback(async () => {
    try {
      const r = await fetch('https://arbiter-mzgk60pt2-nishantneus-projects.vercel.app/api/health');
      setArbiterStatus(r.ok);
    } catch {
      setArbiterStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchActivity();
    checkArbiter();
    const interval = setInterval(fetchAgents, 8000);
    const arbiterInterval = setInterval(checkArbiter, 30000);
    return () => { clearInterval(interval); clearInterval(arbiterInterval); };
  }, [fetchAgents, fetchActivity, checkArbiter]);

  const handleRegister = async () => {
    if (!regName || !regOwner || !regSkills.length) { showToast('Fill all fields', 'error'); return; }
    setLoading(true);
    const r = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: regName, owner_name: regOwner, skills: regSkills, api_key: regApiKey, model_endpoint: regEndpoint })
    });
    const d = await r.json();
    setPendingAgent(d);
    setLoading(false);
  };

  const handleConfirmPayment = async () => {
    setLoading(true);
    const r = await fetch('/api/confirm-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: pendingAgent.agent_id, invoice_id: pendingAgent.invoice.invoice_id })
    });
    const d = await r.json();
    showToast(d.message);
    setPendingAgent(null);
    setRegName(''); setRegOwner(''); setRegSkills([]); setRegApiKey('');
    await fetchAgents();
    setTab('dashboard');
    setLoading(false);
  };

  const handleSwap = async () => {
    if (!selectedAgent || !skillNeeded) { showToast('Select agent and skill', 'error'); return; }
    setLoading(true);
    const r = await fetch('/api/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requester_agent_id: selectedAgent, skill_needed: skillNeeded })
    });
    const d = await r.json();
    if (r.ok) {
      setSwapResult(d);
      setActiveAccess({ agent_name: d.provider.name, skill: skillNeeded, api_key: d.provider.api_key, model_endpoint: d.provider.model_endpoint });
      await fetchActivity(); await fetchAgents();
    } else showToast(d.error, 'error');
    setLoading(false);
  };

  const handleBorrow = async () => {
    if (!selectedAgent || !skillNeeded) { showToast('Select agent and skill', 'error'); return; }
    setLoading(true);
    const r = await fetch('/api/borrow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ borrower_agent_id: selectedAgent, skill_needed: skillNeeded })
    });
    const d = await r.json();
    if (r.status === 402 && d.invoice) {
      setBorrowResult({ ...d, needsPayment: true });
    } else if (r.ok) {
      setBorrowResult({ ...d, needsPayment: false });
      setActiveAccess({ agent_name: d.provider.name, skill: skillNeeded, api_key: d.provider.api_key, model_endpoint: d.provider.model_endpoint });
      showToast(d.message);
      await fetchAgents();
    } else showToast(d.error, 'error');
    setLoading(false);
  };

  const handleConfirmBorrow = async () => {
    setLoading(true);
    const r = await fetch('/api/confirm-borrow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ borrow_id: borrowResult.borrow_id, invoice_id: borrowResult.invoice.invoice_id })
    });
    const d = await r.json();
    if (r.ok) {
      showToast(d.message);
      setBorrowResult({ ...d, needsPayment: false });
      setActiveAccess({ agent_name: d.provider_name, skill: skillNeeded, api_key: d.provider?.api_key, model_endpoint: d.provider?.model_endpoint });
      await fetchActivity(); await fetchAgents();
    } else showToast(d.error, 'error');
    setLoading(false);
  };

  const handleExecuteTask = async () => {
    if (!taskPrompt) { showToast('Enter a task', 'error'); return; }
    setTaskLoading(true);
    setTaskResult(null);

    const agentData = agents.find(a => a.name === activeAccess?.agent_name);

    const r = await fetch('/api/execute-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skill: activeAccess?.skill,
        task_prompt: taskPrompt,
        agent_name: activeAccess?.agent_name,
        api_key: agentData?.api_key || activeAccess?.api_key,
        model_endpoint: agentData?.model_endpoint || activeAccess?.model_endpoint,
        agent_id: agentData?.id
      })
    });
    const d = await r.json();
    if (r.ok) {
      setTaskResult(d);
      if (d.verification) {
        const v = d.verification;
        showToast(
          v.passed
            ? `Arbiter: Score ${v.score}/100 — +${v.token_reward} tokens — ${v.trust_tier}`
            : `Arbiter flagged: Score ${v.score}/100 — -${v.token_penalty} tokens`,
          v.passed ? 'success' : 'error'
        );
      }
      await fetchAgents();
    } else showToast(d.error, 'error');
    setTaskLoading(false);
  };

  const handleCompleteTask = async (agent_id) => {
    const tasks = ['Analyzed market data', 'Generated content', 'Processed request', 'Reviewed document', 'Completed consultation'];
    const r = await fetch('/api/complete-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id, description: tasks[Math.floor(Math.random() * tasks.length)] })
    });
    const d = await r.json();
    showToast(d.message, d.verification && !d.verification.passed ? 'error' : 'success');
    await fetchAgents();
  };

  const toggleSkill = (s) => setRegSkills(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const tierLabel = (balance) => {
    if (balance < 500) return { label: 'T1', color: '#6366f1' };
    if (balance < 2000) return { label: 'T2', color: '#06b6d4' };
    return { label: 'T3', color: '#f59e0b' };
  };

  const getTrustTier = (tokenBalance, taskCount) => {
    if (taskCount >= 10 && tokenBalance >= 5000) return { label: 'ELITE', color: '#8b5cf6' };
    if (taskCount >= 5 && tokenBalance >= 2000) return { label: 'TRUSTED', color: '#10b981' };
    if (taskCount >= 2 && tokenBalance >= 500) return { label: 'STANDARD', color: '#f59e0b' };
    if (taskCount >= 1) return { label: 'PROBATION', color: '#f97316' };
    return { label: 'UNTRUSTED', color: '#ef4444' };
  };

  return (
    <>
      <Head>
        <title>Guildage — Agent Bank</title>
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </Head>

      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 1000,
          background: toast.type === 'error' ? '#3f1515' : '#0f2d20',
          border: `1px solid ${toast.type === 'error' ? '#ef4444' : '#10b981'}`,
          color: toast.type === 'error' ? '#ef4444' : '#10b981',
          padding: '12px 20px', borderRadius: 8, fontFamily: 'IBM Plex Mono',
          fontSize: 13, maxWidth: 360
        }}>
          {toast.type === 'success' ? '✓ ' : '✗ '}{toast.msg}
        </div>
      )}

      <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
        <header style={{
          borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 60, position: 'sticky', top: 0, zIndex: 100,
          background: 'rgba(10,10,15,0.95)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'IBM Plex Mono', fontSize: 12, fontWeight: 600, color: '#fff'
            }}>G</div>
            <span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 600, fontSize: 15 }}>Guildage</span>
            <span style={{
              fontSize: 11, fontFamily: 'IBM Plex Mono', color: '#10b981',
              background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 4,
              border: '1px solid rgba(16,185,129,0.2)'
            }}>⚡ Lightning</span>
            <span style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontFamily: 'IBM Plex Mono',
              color: arbiterStatus === null ? '#888899' : arbiterStatus ? '#10b981' : '#ef4444',
              background: arbiterStatus === null ? 'rgba(136,136,153,0.08)' : arbiterStatus ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
              padding: '2px 8px', borderRadius: 4,
              border: `1px solid ${arbiterStatus === null ? 'rgba(136,136,153,0.2)' : arbiterStatus ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
                background: arbiterStatus === null ? '#888899' : arbiterStatus ? '#10b981' : '#ef4444'
              }} />
              {arbiterStatus === null ? 'Arbiter checking...' : arbiterStatus ? 'Arbiter connected' : 'Arbiter offline — using local scoring'}
            </span>
          </div>
          <nav style={{ display: 'flex', gap: 4 }}>
            {['dashboard', 'register', 'swap', 'borrow'].map(t => (
              <button key={t} onClick={() => { setTab(t); setSwapResult(null); setBorrowResult(null); setTaskResult(null); setActiveAccess(null); }} style={{
                padding: '6px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                background: tab === t ? 'rgba(139,92,246,0.15)' : 'transparent',
                color: tab === t ? '#8b5cf6' : '#888899',
                border: tab === t ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
                cursor: 'pointer', textTransform: 'capitalize'
              }}>{t}</button>
            ))}
          </nav>
        </header>

        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

          {tab === 'dashboard' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
                <div>
                  <h1 style={{ fontSize: 28, fontWeight: 600, fontFamily: 'IBM Plex Mono', marginBottom: 6 }}>Agent Registry</h1>
                  <p style={{ color: '#888899', fontSize: 14 }}>{agents.length} licensed agents · Balances accrue every 8s</p>
                </div>
                <button onClick={fetchAgents} style={{
                  padding: '9px 18px', borderRadius: 7, fontSize: 13, fontWeight: 500,
                  background: 'rgba(139,92,246,0.1)', color: '#8b5cf6',
                  border: '1px solid rgba(139,92,246,0.3)', cursor: 'pointer'
                }}>↻ Refresh</button>
              </div>

              {agents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 20px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 12, color: '#888899' }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>🏦</div>
                  <p>No agents registered yet. Go to Register tab to add your first agent.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                  {agents.map(agent => {
                    const tier = tierLabel(agent.token_balance);
                    const trustTier = getTrustTier(agent.token_balance, agent.task_count);
                    return (
                      <div key={agent.id} style={{ background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20, position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${tier.color}, transparent)` }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 16, fontFamily: 'IBM Plex Mono', marginBottom: 2 }}>{agent.name}</div>
                            <div style={{ fontSize: 12, color: '#888899' }}>owned by {agent.owner_name}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: `${tier.color}20`, color: tier.color, border: `1px solid ${tier.color}40`, fontFamily: 'IBM Plex Mono' }}>{tier.label}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 7px', borderRadius: 4, background: `${trustTier.color}18`, color: trustTier.color, border: `1px solid ${trustTier.color}35`, fontFamily: 'IBM Plex Mono' }} title="Local trust tier estimate — real score from Arbiter during verification">{trustTier.label}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                          {agent.skills.map(s => (
                            <span key={s} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.2)' }}>{s}</span>
                          ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                          <div style={{ background: '#1a1a24', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ fontSize: 11, color: '#888899', marginBottom: 3, fontFamily: 'IBM Plex Mono' }}>TOKENS</div>
                            <div style={{ fontSize: 18, fontWeight: 600, color: '#f59e0b', fontFamily: 'IBM Plex Mono' }}>{agent.token_balance.toFixed(1)}</div>
                          </div>
                          <div style={{ background: '#1a1a24', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ fontSize: 11, color: '#888899', marginBottom: 3, fontFamily: 'IBM Plex Mono' }}>TASKS</div>
                            <div style={{ fontSize: 18, fontWeight: 600, color: '#10b981', fontFamily: 'IBM Plex Mono' }}>{agent.task_count}</div>
                          </div>
                        </div>
                        <button onClick={() => handleCompleteTask(agent.id)} style={{
                          width: '100%', padding: '8px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                          background: 'rgba(16,185,129,0.08)', color: '#10b981',
                          border: '1px solid rgba(16,185,129,0.2)', cursor: 'pointer', fontFamily: 'IBM Plex Mono'
                        }}>+ Complete Task</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {(activity.swaps.length > 0 || activity.borrows.length > 0) && (
                <div style={{ marginTop: 40 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 600, fontFamily: 'IBM Plex Mono', marginBottom: 16, color: '#888899' }}>ACTIVITY LOG</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#888899', marginBottom: 10, fontFamily: 'IBM Plex Mono' }}>SWAPS (FREE)</div>
                      {activity.swaps.map(s => (
                        <div key={s.id} style={{ background: '#12121a', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 8, fontSize: 13 }}>
                          <span style={{ color: '#8b5cf6', fontFamily: 'IBM Plex Mono' }}>{s.requester_name}</span>
                          <span style={{ color: '#888899' }}> ↔ </span>
                          <span style={{ color: '#06b6d4', fontFamily: 'IBM Plex Mono' }}>{s.provider_name}</span>
                          <div style={{ fontSize: 11, color: '#888899', marginTop: 3 }}>skill: {s.skill_requested}</div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#888899', marginBottom: 10, fontFamily: 'IBM Plex Mono' }}>BORROWS (PAID)</div>
                      {activity.borrows.map(b => (
                        <div key={b.id} style={{ background: '#12121a', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 8, fontSize: 13 }}>
                          <span style={{ color: '#f59e0b', fontFamily: 'IBM Plex Mono' }}>{b.borrower_name}</span>
                          <span style={{ color: '#888899' }}> → </span>
                          <span style={{ fontFamily: 'IBM Plex Mono' }}>{b.provider_name}</span>
                          <div style={{ fontSize: 11, color: '#888899', marginTop: 3 }}>{b.tokens_paid} tokens · {b.skill_requested}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'register' && (
            <div style={{ maxWidth: 520 }}>
              <h1 style={{ fontSize: 24, fontWeight: 600, fontFamily: 'IBM Plex Mono', marginBottom: 8 }}>Register Agent</h1>
              <p style={{ color: '#888899', fontSize: 14, marginBottom: 32 }}>Pay 100 sats via Lightning to mint your agent in Guildage</p>

              {!pendingAgent ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { label: 'AGENT NAME', value: regName, set: setRegName, placeholder: 'e.g. Story Spark' },
                    { label: 'OWNER NAME', value: regOwner, set: setRegOwner, placeholder: 'Your name' },
                    { label: 'API KEY', value: regApiKey, set: setRegApiKey, placeholder: 'sk-ant-... or sk-... (your model API key)', type: 'password' },
                    { label: 'MODEL ENDPOINT (optional)', value: regEndpoint, set: setRegEndpoint, placeholder: 'https://api.anthropic.com/v1/messages' },
                  ].map(({ label, value, set, placeholder, type }) => (
                    <div key={label}>
                      <label style={{ display: 'block', fontSize: 12, fontFamily: 'IBM Plex Mono', color: '#888899', marginBottom: 8 }}>{label}</label>
                      <input type={type || 'text'} value={value} onChange={e => set(e.target.value)} placeholder={placeholder} style={{
                        width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14,
                        background: '#12121a', border: '1px solid rgba(255,255,255,0.08)',
                        color: '#f0f0f5', fontFamily: 'IBM Plex Mono'
                      }} />
                    </div>
                  ))}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontFamily: 'IBM Plex Mono', color: '#888899', marginBottom: 10 }}>SKILLS</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {SKILLS.map(s => (
                        <button key={s} onClick={() => toggleSkill(s)} style={{
                          padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
                          background: regSkills.includes(s) ? 'rgba(139,92,246,0.2)' : '#12121a',
                          color: regSkills.includes(s) ? '#8b5cf6' : '#888899',
                          border: regSkills.includes(s) ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.08)',
                          cursor: 'pointer'
                        }}>{s}</button>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleRegister} disabled={loading} style={{
                    marginTop: 8, padding: '12px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                    background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)', color: '#fff',
                    border: 'none', fontFamily: 'IBM Plex Mono', cursor: 'pointer', opacity: loading ? 0.7 : 1
                  }}>{loading ? 'Generating Invoice...' : '⚡ Generate Lightning Invoice'}</button>
                </div>
              ) : (
                <div style={{ background: '#12121a', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: 24 }}>
                  <div style={{ fontSize: 12, fontFamily: 'IBM Plex Mono', color: '#f59e0b', marginBottom: 16 }}>⚡ LIGHTNING INVOICE READY</div>
                  <div style={{ fontSize: 28, fontWeight: 600, fontFamily: 'IBM Plex Mono', color: '#f59e0b', marginBottom: 4 }}>{pendingAgent.deposit_sats} sats</div>
                  <div style={{ fontSize: 12, color: '#888899', marginTop: 4, marginBottom: 16 }}>→ {pendingAgent.starting_tokens} tokens on activation</div>
                  <div style={{ background: '#0a0a0f', borderRadius: 8, padding: '10px 14px', fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#888899', wordBreak: 'break-all', marginBottom: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
                    {pendingAgent.invoice.bolt11}
                  </div>
                  <button onClick={handleConfirmPayment} disabled={loading} style={{
                    width: '100%', padding: '12px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                    background: '#10b981', color: '#fff', border: 'none', fontFamily: 'IBM Plex Mono', cursor: 'pointer', opacity: loading ? 0.7 : 1
                  }}>{loading ? 'Confirming...' : '✓ Confirm Payment & Activate Agent'}</button>
                  <p style={{ fontSize: 11, color: '#888899', marginTop: 10, textAlign: 'center' }}>Demo mode: Lightning payment auto-confirmed</p>
                </div>
              )}
            </div>
          )}

          {tab === 'swap' && (
            <div style={{ maxWidth: 560 }}>
              <h1 style={{ fontSize: 24, fontWeight: 600, fontFamily: 'IBM Plex Mono', marginBottom: 8 }}>Skill Swap</h1>
              <p style={{ color: '#888899', fontSize: 14, marginBottom: 28 }}>Free — your agent serves the provider's owner in return</p>

              {!swapResult ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { label: 'YOUR AGENT', val: selectedAgent, set: setSelectedAgent, opts: agents.map(a => ({ v: a.id, l: `${a.name} (${a.owner_name})` })) },
                    { label: 'SKILL NEEDED', val: skillNeeded, set: setSkillNeeded, opts: SKILLS.map(s => ({ v: s, l: s })) }
                  ].map(({ label, val, set, opts }) => (
                    <div key={label}>
                      <label style={{ display: 'block', fontSize: 12, fontFamily: 'IBM Plex Mono', color: '#888899', marginBottom: 8 }}>{label}</label>
                      <select value={val} onChange={e => set(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', color: val ? '#f0f0f5' : '#888899', fontFamily: 'IBM Plex Mono' }}>
                        <option value="">Select...</option>
                        {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    </div>
                  ))}
                  <button onClick={handleSwap} disabled={loading} style={{ padding: '12px', borderRadius: 8, fontSize: 14, fontWeight: 600, background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.4)', fontFamily: 'IBM Plex Mono', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
                    {loading ? 'Matching...' : '⟳ Request Swap — FREE'}
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ background: '#12121a', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 12, padding: 24 }}>
                    <div style={{ fontSize: 12, fontFamily: 'IBM Plex Mono', color: '#8b5cf6', marginBottom: 16 }}>✓ SWAP ACTIVE</div>
                    <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'IBM Plex Mono', marginBottom: 4 }}>{swapResult.provider.name}</div>
                    <div style={{ fontSize: 13, color: '#888899', marginBottom: 16 }}>owned by {swapResult.provider.owner_name}</div>
                    <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
                      ⟳ {swapResult.requester_obligation}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981', fontFamily: 'IBM Plex Mono' }}>COST: FREE</div>
                  </div>
                  {activeAccess && <TaskInterface agentName={activeAccess.agent_name} skill={activeAccess.skill} taskPrompt={taskPrompt} setTaskPrompt={setTaskPrompt} taskLoading={taskLoading} taskResult={taskResult} onExecute={handleExecuteTask} />}
                  <button onClick={() => { setSwapResult(null); setSelectedAgent(''); setSkillNeeded(''); setTaskResult(null); setActiveAccess(null); }} style={{ marginTop: 16, width: '100%', padding: '10px', borderRadius: 7, fontSize: 13, background: 'transparent', color: '#888899', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', fontFamily: 'IBM Plex Mono' }}>New Swap</button>
                </div>
              )}
            </div>
          )}

          {tab === 'borrow' && (
            <div style={{ maxWidth: 560 }}>
              <h1 style={{ fontSize: 24, fontWeight: 600, fontFamily: 'IBM Plex Mono', marginBottom: 8 }}>Borrow Skill</h1>
              <p style={{ color: '#888899', fontSize: 14, marginBottom: 28 }}>Pay with tokens or Lightning sats. Get an L402 access token.</p>

              {!borrowResult ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { label: 'YOUR AGENT', val: selectedAgent, set: setSelectedAgent, opts: agents.map(a => ({ v: a.id, l: `${a.name} — ${a.token_balance.toFixed(0)} tokens` })) },
                    { label: 'SKILL NEEDED', val: skillNeeded, set: setSkillNeeded, opts: SKILLS.map(s => ({ v: s, l: s })) }
                  ].map(({ label, val, set, opts }) => (
                    <div key={label}>
                      <label style={{ display: 'block', fontSize: 12, fontFamily: 'IBM Plex Mono', color: '#888899', marginBottom: 8 }}>{label}</label>
                      <select value={val} onChange={e => set(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', color: val ? '#f0f0f5' : '#888899', fontFamily: 'IBM Plex Mono' }}>
                        <option value="">Select...</option>
                        {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    </div>
                  ))}
                  <button onClick={handleBorrow} disabled={loading} style={{ padding: '12px', borderRadius: 8, fontSize: 14, fontWeight: 600, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.35)', fontFamily: 'IBM Plex Mono', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
                    {loading ? 'Processing...' : '⚡ Request Borrow'}
                  </button>
                </div>
              ) : borrowResult.needsPayment ? (
                <div style={{ background: '#12121a', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: 24 }}>
                  <div style={{ fontSize: 12, fontFamily: 'IBM Plex Mono', color: '#f59e0b', marginBottom: 16 }}>⚡ LIGHTNING PAYMENT REQUIRED</div>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'IBM Plex Mono', color: '#f59e0b', marginBottom: 4 }}>{borrowResult.amount_sats} sats</div>
                  <div style={{ fontSize: 13, color: '#888899', marginBottom: 16 }}>Borrow {skillNeeded} from {borrowResult.provider.name}</div>
                  <div style={{ background: '#0a0a0f', borderRadius: 8, padding: '10px 14px', fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#888899', wordBreak: 'break-all', marginBottom: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
                    {borrowResult.invoice.bolt11}
                  </div>
                  <button onClick={handleConfirmBorrow} disabled={loading} style={{ width: '100%', padding: '12px', borderRadius: 8, fontSize: 14, fontWeight: 600, background: '#f59e0b', color: '#000', border: 'none', fontFamily: 'IBM Plex Mono', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
                    {loading ? 'Confirming...' : '✓ Confirm Lightning Payment'}
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ background: '#12121a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: 24 }}>
                    <div style={{ fontSize: 12, fontFamily: 'IBM Plex Mono', color: '#10b981', marginBottom: 16 }}>✓ ACCESS GRANTED</div>
                    <div style={{ fontSize: 13, color: '#888899', marginBottom: 8 }}>L402 ACCESS TOKEN</div>
                    <div style={{ background: '#0a0a0f', borderRadius: 8, padding: '10px 14px', fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#10b981', wordBreak: 'break-all', marginBottom: 16, border: '1px solid rgba(16,185,129,0.2)' }}>
                      {borrowResult.access_token || 'Token issued'}
                    </div>
                  </div>
                  {activeAccess && <TaskInterface agentName={activeAccess.agent_name} skill={activeAccess.skill} taskPrompt={taskPrompt} setTaskPrompt={setTaskPrompt} taskLoading={taskLoading} taskResult={taskResult} onExecute={handleExecuteTask} />}
                  <button onClick={() => { setBorrowResult(null); setSelectedAgent(''); setSkillNeeded(''); setTaskResult(null); setActiveAccess(null); }} style={{ marginTop: 16, width: '100%', padding: '10px', borderRadius: 7, fontSize: 13, background: 'transparent', color: '#888899', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', fontFamily: 'IBM Plex Mono' }}>New Borrow</button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
