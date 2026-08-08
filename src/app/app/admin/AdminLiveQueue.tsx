'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { MetricGrid } from '../../../components/MissionAppShell'
import { supabase } from '../../../lib/supabase'
import { MISSION365_ADMIN_QUEUE_URL, MISSION365_LAUNCH_STATUS_URL, MISSION365_REVIEW_ACTION_URL, MISSION365_SUPABASE_PUBLISHABLE_KEY } from '../../../lib/mission365-public'

type LaunchStatus={verificationCandidates:number;applicationsInReview:number;liveMissions:number;payoutHolds:number;payments:{stripeApi:boolean;webhook:boolean;liveGiving:boolean};qa:Array<{action:string;status:string|null;createdAt:string}>}
type Candidate={id:string;public_name:string;organization_type:string;verification_status:string;actions:Array<{action:string;metadata:Record<string,unknown>;createdAt:string}>}
type AdminQueue={role:string;candidates:Candidate[];applications:Array<Record<string,unknown>>;liveMissions:Array<Record<string,unknown>>;payoutHolds:Array<Record<string,unknown>>;riskEvents:Array<Record<string,unknown>>;payments:{stripeApi:boolean}}

const apiHeaders={'apikey':MISSION365_SUPABASE_PUBLISHABLE_KEY}
function formatAction(action:string){return action.replaceAll('.',' › ').replaceAll('_',' ')}

export default function AdminLiveQueue(){
  const [launch,setLaunch]=useState<LaunchStatus|null>(null)
  const [queue,setQueue]=useState<AdminQueue|null>(null)
  const [signedIn,setSignedIn]=useState(false)
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  const [actionBusy,setActionBusy]=useState('')

  const refresh=useCallback(async()=>{
    setBusy(true);setMessage('')
    try{
      const statusResponse=await fetch(MISSION365_LAUNCH_STATUS_URL,{headers:apiHeaders,cache:'no-store'})
      if(statusResponse.ok)setLaunch(await statusResponse.json())
      const {data:{session}}=await supabase.auth.getSession()
      setSignedIn(Boolean(session))
      if(session){
        const queueResponse=await fetch(MISSION365_ADMIN_QUEUE_URL,{headers:{...apiHeaders,Authorization:`Bearer ${session.access_token}`},cache:'no-store'})
        const body=await queueResponse.json()
        if(queueResponse.ok)setQueue(body)
        else {setQueue(null);setMessage(body.error||'Admin queue is unavailable for this account.')}
      }else setQueue(null)
    }catch(error){setMessage(error instanceof Error?error.message:'Could not refresh Mission 365 status.')}
    finally{setBusy(false)}
  },[])

  useEffect(()=>{void refresh()},[refresh])

  async function review(organizationId:string,action:'start_review'|'needs_information'|'approve'|'reject'){
    const {data:{session}}=await supabase.auth.getSession()
    if(!session){setMessage('Reviewer sign-in required.');return}
    const note=window.prompt(`Optional reviewer note for ${formatAction(action)}:`)||''
    setActionBusy(`${organizationId}:${action}`);setMessage('')
    try{
      const response=await fetch(MISSION365_REVIEW_ACTION_URL,{method:'POST',headers:{...apiHeaders,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({organizationId,action,note})})
      const body=await response.json()
      if(!response.ok){setMessage(body.error||'Review action failed.');return}
      setMessage(`${body.organization.public_name} moved to ${String(body.organization.verification_status).replaceAll('_',' ')}.`)
      await refresh()
    }catch(error){setMessage(error instanceof Error?error.message:'Review action failed.')}
    finally{setActionBusy('')}
  }

  const metrics:Array<[string,string,string]>=[
    ['Verification queue',String(launch?.verificationCandidates??'—'),'Organizations pending or currently under review.'],
    ['Applications',String(launch?.applicationsInReview??'—'),'Submitted, in-review, or needs-information applications.'],
    ['Live missions',String(launch?.liveMissions??'—'),'Reviewed missions currently published.'],
    ['Payout holds',String(launch?.payoutHolds??'—'),'Transfers requiring operational review or release.'],
  ]

  return <>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap',marginBottom:18}}>
      <div><p className="eyebrow">LIVE OPERATING DATA</p><p style={{margin:0}}>Counts and readiness below come from the dedicated Mission 365 production backend.</p></div>
      <button className="button button-ghost" onClick={()=>void refresh()} disabled={busy}><RefreshCw size={16}/>{busy?'Refreshing…':'Refresh'}</button>
    </div>
    <MetricGrid items={metrics}/>

    <div className="role-grid" style={{marginTop:24}}>
      <article className="role-card"><p className="eyebrow">PAYMENT RELEASE GATE</p><h3>{launch?.payments.liveGiving?'Live giving enabled':'Live giving credential-gated'}</h3><p>Stripe API credential: <strong>{launch?.payments.stripeApi?'READY':'MISSING'}</strong><br/>Webhook signing: <strong>{launch?.payments.webhook?'READY':'NOT READY'}</strong></p>{launch?.payments.liveGiving?<ShieldCheck/>:<TriangleAlert/>}</article>
      <article className="role-card"><p className="eyebrow">QA EVIDENCE</p><h3>Financial integrity checks</h3>{(launch?.qa||[]).length?<ul>{launch!.qa.map(row=><li key={`${row.action}-${row.createdAt}`}><strong>{formatAction(row.action)}</strong> — {row.status||'recorded'}</li>)}</ul>:<p>No production QA evidence has been recorded yet.</p>}</article>
    </div>

    <section style={{marginTop:28}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'end',flexWrap:'wrap'}}><div><p className="eyebrow">VERIFICATION COMMAND</p><h2 style={{marginTop:4}}>Launch Cohort & review queue</h2></div>{!signedIn&&<Link className="button" href="/login">Sign in as reviewer</Link>}</div>
      {message&&<div className="role-card" style={{marginTop:16}}><p>{message}</p></div>}
      {queue?<div className="role-grid" style={{marginTop:16}}>
        {queue.candidates.map(candidate=><article className="role-card" key={candidate.id}>
          <p className="eyebrow">{candidate.verification_status.replaceAll('_',' ').toUpperCase()}</p><h3>{candidate.public_name}</h3><p>{candidate.organization_type.replaceAll('_',' ')}</p>
          <div style={{marginTop:14}}>{candidate.actions.length?candidate.actions.map(action=><p key={`${action.action}-${action.createdAt}`} style={{margin:'6px 0'}}><strong>{formatAction(action.action)}</strong><br/><small>{new Date(action.createdAt).toLocaleString()}</small></p>):<p>No review actions recorded.</p>}</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:14}}>
            {candidate.verification_status==='pending'&&<button className="button" disabled={Boolean(actionBusy)} onClick={()=>void review(candidate.id,'start_review')}>Start review</button>}
            <button className="button button-ghost" disabled={Boolean(actionBusy)} onClick={()=>void review(candidate.id,'needs_information')}>Needs info</button>
            <button className="button button-ghost" disabled={Boolean(actionBusy)} onClick={()=>void review(candidate.id,'approve')}>Approve</button>
            <button className="button button-ghost" disabled={Boolean(actionBusy)} onClick={()=>void review(candidate.id,'reject')}>Reject</button>
          </div>
          <small style={{display:'block',marginTop:12,opacity:.72}}>Approval is server-blocked until accepted verification documents are on file and payout onboarding is ready with transfers active.</small>
        </article>)}
        {queue.candidates.length===0&&<article className="role-card"><h3>Queue clear</h3><p>No organizations are waiting for verification.</p></article>}
      </div>:signedIn&&!message?<div className="role-card" style={{marginTop:16}}><p>Loading protected verification queue…</p></div>:null}
    </section>
  </>
}
