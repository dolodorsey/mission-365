'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, KeyRound, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Mode='login'|'signup'|'magic'
export default function LoginPage(){
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [showPassword,setShowPassword]=useState(false)
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

  return <main className="status-page"><form className="status-card auth-card application-form" onSubmit={submit}>
    <p className="eyebrow">Mission 365 secure account</p>
    <h1>{mode==='login'?'Welcome back.':mode==='signup'?'Create your account.':'Email me a secure sign-in link.'}</h1>
    <p>One confirmed account unlocks donor giving, mission applications, business partnerships, and approved reviewer access. Reviewer permissions are never granted from profile fields you can edit yourself.</p>
    <label htmlFor="mission365-email">Email
      <input id="mission365-email" value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required />
    </label>
    {mode!=='magic'&&<label htmlFor="mission365-password">Password
      <span className="password-field">
        <input id="mission365-password" value={password} onChange={e=>setPassword(e.target.value)} type={showPassword?'text':'password'} autoComplete={mode==='login'?'current-password':'new-password'} minLength={8} required />
        <button className="password-toggle" type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button>
      </span>
    </label>}
    <button className="button auth-submit" disabled={busy}>{busy?'Working…':mode==='login'?'Sign in':mode==='signup'?'Create account':'Send secure link'}</button>
    {message&&<article className="role-card" style={{marginTop:4}}><strong>{message}</strong></article>}
    <div className="hero-actions auth-actions">
      <button className="button button-ghost" type="button" onClick={()=>setMode(mode==='login'?'signup':'login')}><KeyRound size={16}/>{mode==='login'?'Create account':'Use password sign-in'}</button>
      <button className="button button-ghost" type="button" onClick={()=>setMode('magic')}><Mail size={16}/>Email sign-in link</button>
    </div>
    <p style={{fontSize:12}}>By creating or using an account, you agree to the applicable Mission 365 policies presented before giving, mission submission, or business sponsorship.</p>
    <div><Link href="/legal">Legal & policies</Link> · <Link href="/">Return home</Link></div>
  </form></main>
}
