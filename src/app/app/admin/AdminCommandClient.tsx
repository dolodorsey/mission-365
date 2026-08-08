'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { MISSION365_ADMIN_QUEUE_URL, MISSION365_REVIEW_ACTION_URL } from '@/lib/mission365-public'

type QueueCandidate={id:string;public_name:string;organization_type:string;verification_status:string;actions:Array<{action:string;metadata:Record<string,unknown>;createdAt:string}>}
type QueueData={role:string;candidates:QueueCandidate[];applications:Array<{id:string;status:string;application_type:string;public_name:string;created_at:string}>;liveMissions:Array<{id:string;title:string;status:string}>;payoutHolds:Array<{id:string;amount_cents:number;status:string}>;riskEvents:Array<{id:string;risk_type:string;severity:string;status:string}>;payments:{stripeApi:boolean}}

const actionLabels:Record<string,string>={start_review:'Start review',needs_information:'Needs info',approve:'Approve',reject:'Reject',suspend:'Suspend'}

export default function AdminCommandClient(){
  const [queue,setQueue]=useState<QueueData|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState('')
  const [token,setToken]=useState<string|null>(null)

  const load=useCallback(async(accessToken?:string|null)=>{
    const sessionToken=accessToken??token
    if(!sessionToken){setLoading(false);return}
    setLoading(true);setError('')
    const response=await fetch(MISSION365_ADMIN_QUEUE_URL,{headers:{Authorization:`Bearer ${sessionToken}`},cache:'no-store'})
    const body=await response.json()
    setLoading(false)
    if(!response.ok){setError(body.error||'Could not load admin queue.');return}
    setQueue(body)
  },[token])

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{
      const access=data.session?.access_token||null
      setToken(access)
      if(access) void load(access)
      else setLoading(false)
    })
  },[load])

  async function review(organizationId:string,action:string){
    if(!token)return
    const note=window.prompt(`Optional reviewer note for ${actionLabels[action]||action}:`)||''
    setBusy(`${organizationId}:${action}`);setError('')
    const response=await fetch(MISSION365_REVIEW_ACTION_URL,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({organizationId,action,note})})
    const body=await response.json();setBusy('')
    if(!response.ok){setError(body.error||'Review action failed.');return}
    await load(token)
  }

  if(loading)return <div className="role-card"><h3>Loading verification command…</h3></div>
  if(!token)return <div className="role-card"><h3>Admin sign-in required</h3><p>Use an authorized Mission 365 reviewer, finance, or admin account to open the verification queue.</p><Link className="button" href="/login">Sign in</Link></div>
  if(error&&!queue)return <div className="role-card"><h3>Access unavailable</h3><p>{error}</p><Link className="button button-ghost" href="/login">Change account</Link></div>
  if(!queue)return null

  return <>
    {error&&<div className="role-card" style={{marginBottom:16}}><strong>Action blocked</strong><p>{error}</p></div>}
    <div className="role-grid">
      <article className="role-card"><p className="eyebrow">Applications</p><h2>{queue.applications.length}</h2><p>Submitted, in review, or awaiting information.</p></article>
      <article className="role-card"><p className="eyebrow">Verification queue</p><h2>{queue.candidates.length}</h2><p>Organizations pending or under review.</p></article>
      <article className="role-card"><p className="eyebrow">Live missions</p><h2>{queue.liveMissions.length}</h2><p>Published, funded, or reporting.</p></article>
      <article className="role-card"><p className="eyebrow">Payout holds</p><h2>{queue.payoutHolds.length}</h2><p>Pending review, approved, or processing.</p></article>
      <article className="role-card"><p className="eyebrow">Open risk</p><h2>{queue.riskEvents.length}</h2><p>Open or investigating risk events.</p></article>
      <article className="role-card"><p className="eyebrow">Live giving</p><h2>{queue.payments.stripeApi?'READY':'GATED'}</h2><p>{queue.payments.stripeApi?'Stripe API credential detected.':'Stripe API credential is not installed.'}</p></article>
    </div>

    <section style={{marginTop:28}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'end',flexWrap:'wrap'}}>
        <div><p className="eyebrow">Launch Cohort / Review Queue</p><h2 style={{marginTop:0}}>Organizations requiring review</h2></div>
        <button className="button button-ghost" onClick={()=>void load(token)}>Refresh queue</button>
      </div>
      {queue.candidates.length===0?<article className="role-card"><h3>Queue clear.</h3><p>No organizations are currently pending verification.</p></article>:
        <div className="role-grid">{queue.candidates.map(candidate=><article className="role-card" key={candidate.id}>
          <p className="eyebrow">{candidate.verification_status.replaceAll('_',' ')} · {candidate.organization_type.replaceAll('_',' ')}</p>
          <h3>{candidate.public_name}</h3>
          <p>{candidate.actions[0]?.action?`Latest: ${candidate.actions[0].action.replaceAll('.',' → ').replaceAll('_',' ')}`:'No review activity logged yet.'}</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:14}}>
            {candidate.verification_status==='pending'&&<button className="button" disabled={busy!==''} onClick={()=>void review(candidate.id,'start_review')}>Start review</button>}
            <button className="button button-ghost" disabled={busy!==''} onClick={()=>void review(candidate.id,'needs_information')}>Needs info</button>
            <button className="button button-ghost" disabled={busy!==''} onClick={()=>void review(candidate.id,'approve')}>Approve</button>
            <button className="button button-ghost" disabled={busy!==''} onClick={()=>void review(candidate.id,'reject')}>Reject</button>
          </div>
          <small style={{display:'block',marginTop:12,opacity:.72}}>Approval is server-blocked until accepted verification documents and an active payout account exist.</small>
        </article>)}</div>}
    </section>
  </>
}
