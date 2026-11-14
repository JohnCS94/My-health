'use client';

import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import Dashboard from './Dashboard';

export default function Page() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    setDemo(new URLSearchParams(window.location.search).has('demo'));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (demo) return <Dashboard session={null} demo />;
  if (session === undefined) return <div className="center sub">Loading…</div>;
  if (!session) return <Login />;
  return <Dashboard session={session} />;
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } =
      mode === 'in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) setMsg(error.message);
    else if (mode === 'up') setMsg('Account created. Confirm your email if prompted, then sign in. Ask the owner to share their data with this email.');
  }

  return (
    <div className="center">
      <form className="login" onSubmit={submit}>
        <h1>Health Dashboard</h1>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        <button className="btn" disabled={busy}>
          {busy ? '…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
        <button type="button" className="btn ghost" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
        <a className="sub" href="/?demo" style={{ textAlign: 'center' }}>Preview with demo data</a>
        {msg ? <div className={mode === 'up' && !msg.includes('rror') ? 'sub' : 'err'}>{msg}</div> : null}
      </form>
    </div>
  );
}
