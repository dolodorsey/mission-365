'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function ApplicationForm(){
  const [sessionReady,setSessionReady]=useState(false)
  const [userId,setUserId]=useState<string|null>(null)
  const [type,setType]=useState<'mission_owner'|'business_partner'>('mission_owner')
  const [legalName,setLegalName]=useState('')
  const [publicName,setPublicName]=useState('')
  const [email,setEmail]=useState('')
  const [summary,setSummary]=useState('')
  const [amount,setAmount]=useState('')
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)

  useEffect(()=>{supabase.auth.getSession().then(({data})=>{setUserId(data.session?.user.id||null);setEmail(data.session?.user.email||'');setSessionReady(true)})},[])

  async function submit(event:FormEvent){
    event.preventDefault(); if(!userId)return
    setBusy(true);setMessage('')
    const requestedAmountCents=amount?Math.round(Number(amount)*100):null
    const {data:application,error:insertError}=await supabase.from('mission365_applications').insert({
      applicant_user_id:userId,application_type:type,legal_name:legalName.trim(),public_name:publicName.trim(),
      contact_email:email.trim().toLowerCase(),mission_summary:summary.trim(),requested_amount_cents:requestedAmountCents,
      status:'draft'
    }).select('id').single()
    if(insertError||!application){setBusy(false);setMessage(insertError?.message||'Submission failed');return}
    const {error:updateError}=await supabase.from('mission365_applications').update({status:'submitted',submitted_at:new Date().toISOString()}).eq('id',application.id)
    setBusy(false)
    if(updateError){setMessage(updateError.message);return}
    setMessage(`Submitted. Application ${application.id} is now in review.`)
  }

  if(!sessionReady)return <p>Checking your Mission 365 account…</p>
  if(!userId)return <div><p>You need a Mission 365 account before submitting private verification information.</p><Link className="button" href="/login">Sign in or create account</Link></div>

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
