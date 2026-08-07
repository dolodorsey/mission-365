'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LoginPage(){
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [mode,setMode]=useState<'login'|'signup'>('login')
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)

  async function submit(event:FormEvent){
    event.preventDefault(); setBusy(true); setMessage('')
    const result=mode==='login'
      ? await supabase.auth.signInWithPassword({email,password})
      : await supabase.auth.signUp({email,password})
    setBusy(false)
    if(result.error){setMessage(result.error.message);return}
    if(mode==='signup'&&!result.data.session){setMessage('Account created. Check your email to verify your address.');return}
    window.location.href='/app'
  }

  return <main className="status-page"><form className="status-card apply-card" onSubmit={submit}>
    <p className="eyebrow">Mission 365 account</p>
    <h1>{mode==='login'?'Welcome back.':'Create your account.'}</h1>
    <p>One account unlocks donor giving, mission applications, business partnerships, and approved team access.</p>
    <label>Email<input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" required /></label>
    <label>Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete={mode==='login'?'current-password':'new-password'} minLength={8} required /></label>
    <button className="button" disabled={busy}>{busy?'Working…':mode==='login'?'Sign in':'Create account'}</button>
    {message&&<p>{message}</p>}
    <button className="button button-ghost" type="button" onClick={()=>setMode(mode==='login'?'signup':'login')}>
      {mode==='login'?'Need an account? Sign up':'Already registered? Sign in'}
    </button>
    <Link href="/">Return home</Link>
  </form></main>
}
