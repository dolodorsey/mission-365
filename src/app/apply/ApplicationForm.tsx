'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function ApplicationForm(){
  const [sessionReady,setSessionReady]=useState(false)
  const [token,setToken]=useState<string|null>(null)
  const [type,setType]=useState<'mission_owner'|'business_partner'>('mission_owner')
  const [legalName,setLegalName]=useState('')
  const [publicName,setPublicName]=useState('')
  const [email,setEmail]=useState('')
  const [summary,setSummary]=useState('')
  const [amount,setAmount]=useState('')
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)

  useEffect(()=>{supabase.auth.getSession().then(({data})=>{setToken(data.session?.access_token||null);setEmail(data.session?.user.email||'');setSessionReady(true)})},[])

  async function submit(event:FormEvent){
    event.preventDefault(); if(!token)return
    setBusy(true);setMessage('')
    const response=await fetch('/api/applications',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({
      applicationType:type,legalName,publicName,contactEmail:email,missionSummary:summary,
      requestedAmountCents:amount?Math.round(Number(amount)*100):null
    })})
    const body=await response.json();setBusy(false)
    if(!response.ok){setMessage(body.error||'Submission failed');return}
    setMessage(`Submitted. Application ${body.application.id} is now in review.`)
  }

  if(!sessionReady)return <p>Checking your Mission 365 account…</p>
  if(!token)return <div><p>You need a Mission 365 account before submitting private verification information.</p><Link className="button" href="/login">Sign in or create account</Link></div>

  return <form onSubmit={submit} className="application-form">
    <label>Application type<select value={type} onChange={e=>setType(e.target.value as typeof type)}><option value="mission_owner">Mission owner</option><option value="business_partner">Business partner</option></select></label>
    <label>Legal name<input value={legalName} onChange={e=>setLegalName(e.target.value)} required /></label>
    <label>Public / organization name<input value={publicName} onChange={e=>setPublicName(e.target.value)} required /></label>
    <label>Contact email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
    <label>{type==='mission_owner'?'Mission summary':'Partnership objective'}<textarea value={summary} onChange={e=>setSummary(e.target.value)} minLength={40} required /></label>
    {type==='mission_owner'&&<label>Requested funding (USD)<input type="number" min="1" step="1" value={amount} onChange={e=>setAmount(e.target.value)} /></label>}
    <button className="button" disabled={busy}>{busy?'Submitting…':'Submit for verification'}</button>
    {message&&<p>{message}</p>}
  </form>
}
