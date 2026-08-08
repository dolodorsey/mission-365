'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { KeyRound, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Mode='login'|'signup'|'magic'
export default function LoginPage(){
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [mode,setMode]=useState<Mode>('login')
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)

  async function submit(event:FormEvent){
    event.preventDefault();setBusy(true);setMessage('')
    if(mode==='magic'){
      const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:`${window.location.origin}/app`}})
      setBusy(false);setMessage(error?error.message:'Secure sign-in link sent. Open the email on this device to activate your Mission 365 session.');return
    }
    const result=mode==='login'?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password,options:{emailRedirectTo:`${window.location.origin}/app`}})
    setBusy(false)
    if(result.error){setMessage(result.error.message);return}
    if(mode==='signup'&&!result.data.session){setMessage('Account created. Check your email to verify your address.');return}
    window.location.href='/app'
  }

  return <main className="status-page"><form className="status-card apply-card" onSubmit={submit}>
    <p className="eyebrow">Mission 365 secure account</p>
    <h1>{mode==='login'?'Welcome back.':mode==='signup'?'Create your account.':'Email me a secure sign-in link.'}</h1>
    <p>One confirmed account unlocks donor giving, mission applications, business partnerships, and approved reviewer access. Reviewer permissions are never granted from profile fields you can edit yourself.</p>
    <label>Email<input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" required /></label>
    {mode!=='magic'&&<label>Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete={mode==='login'?'current-password':'new-password'} minLength={8} required /></label>}
    <button className="button" disabled={busy}>{busy?'Working…':mode==='login'?'Sign in':mode==='signup'?'Create account':'Send secure link'}</button>
    {message&&<article className="role-card" style={{marginTop:12}}><strong>{message}</strong></article>}
    <div className="hero-actions" style={{marginTop:18}}>
      <button className="button button-ghost" type="button" onClick={()=>setMode(mode==='login'?'signup':'login')}><KeyRound size={16}/>{mode==='login'?'Create account':'Use password sign-in'}</button>
      <button className="button button-ghost" type="button" onClick={()=>setMode('magic')}><Mail size={16}/>Email sign-in link</button>
    </div>
    <p style={{fontSize:12}}>By creating or using an account, you agree to the applicable Mission 365 policies presented before giving, mission submission, or business sponsorship.</p>
    <Link href="/legal">Legal & policies</Link> · <Link href="/">Return home</Link>
  </form></main>
}
