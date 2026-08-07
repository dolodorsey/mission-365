'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function DonateForm({missionId}:{missionId:string}){
  const [token,setToken]=useState<string|null>(null)
  const [ready,setReady]=useState(false)
  const [amount,setAmount]=useState('25')
  const [cadence,setCadence]=useState<'one_time'|'monthly'>('one_time')
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  useEffect(()=>{supabase.auth.getSession().then(({data})=>{setToken(data.session?.access_token||null);setReady(true)})},[])

  async function give(event:FormEvent){
    event.preventDefault(); if(!token)return
    const amountCents=Math.round(Number(amount)*100)
    if(!Number.isFinite(amountCents)||amountCents<100){setMessage('Choose an amount of at least $1.');return}
    setBusy(true);setMessage('')
    const response=await fetch('/api/stripe/checkout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({missionId,amountCents,cadence})})
    const body=await response.json();setBusy(false)
    if(!response.ok){setMessage(body.error||'Giving is not available yet.');return}
    if(body.checkoutUrl) window.location.assign(body.checkoutUrl)
  }

  if(!ready)return <p>Checking giving access…</p>
  if(!token)return <div><p>Sign in to give and keep your receipts, recurring plans, and impact history together.</p><Link className="button" href="/login">Sign in to give</Link></div>
  return <form className="application-form" onSubmit={give}>
    <label>Gift amount (USD)<input type="number" min="1" step="1" value={amount} onChange={e=>setAmount(e.target.value)} required /></label>
    <label>Giving schedule<select value={cadence} onChange={e=>setCadence(e.target.value as typeof cadence)}><option value="one_time">Give once</option><option value="monthly">Give every month</option></select></label>
    <button className="button" disabled={busy}>{busy?'Opening secure checkout…':cadence==='monthly'?'Start monthly giving':'Give securely'}</button>
    {message&&<p>{message}</p>}
  </form>
}
