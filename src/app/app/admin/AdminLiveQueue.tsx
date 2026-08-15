'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { MetricGrid } from '../../../components/MissionAppShell'
import { supabase } from '../../../lib/supabase'
import { MISSION365_ADMIN_QUEUE_URL, MISSION365_LAUNCH_STATUS_URL, MISSION365_REFUND_URL, MISSION365_REVIEW_ACTION_URL, MISSION365_SUPABASE_PUBLISHABLE_KEY } from '../../../lib/mission365-public'

type LaunchStatus={verificationCandidates:number;applicationsInReview:number;liveMissions:number;payoutHolds:number;payments:{stripeApi:boolean;webhook:boolean;liveGiving:boolean};qa:Array<{action:string;status:string|null;createdAt:string}>}
type Candidate={id:string;public_name:string;organization_type:string;verification_status:string;actions:Array<{action:string;metadata:Record<string,unknown>;created_at:string}>}
type Donation={id:string;mission_id:string;amount_cents:number;refunded_amount_cents:number;currency:string;status:string;settlement_mode:string;stripe_payment_intent_id:string|null;created_at:string}
type MissionDetail={id:string;title:string}
type AdminQueue={role:string;candidates:Candidate[];applications:Array<Record<string,unknown>>;missions:Array<Record<string,unknown>>;payouts:Array<Record<string,unknown>>;riskEvents:Array<Record<string,unknown>>;donations:Donation[];missionDetails:MissionDetail[];payments:{stripeApi:boolean}}

const apiHeaders={'apikey':MISSION365_SUPABASE_PUBLISHABLE_KEY}
function formatAction(action:string){return action.replaceAll('.',' › ').replaceAll('_',' ')}
function formatUsd(cents:number){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(cents||0)/100)}

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

  const missionNames=useMemo(()=>new Map((queue?.missionDetails||[]).map(row=>[row.id,row.title])),[queue?.missionDetails])
  const financeAuthorized=Boolean(queue&&['admin','finance'].includes(queue.role))
  const refundableDonations=(queue?.donations||[]).filter(donation=>['succeeded','partially_refunded'].includes(donation.status)&&Boolean(donation.stripe_payment_intent_id)&&Number(donation.amount_cents)>Number(donation.refunded_amount_cents||0))

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

  async function refundDonation(donation:Donation){
    const {data:{session}}=await supabase.auth.getSession()
    if(!session){setMessage('Finance sign-in required.');return}
    const remaining=Math.max(0,Number(donation.amount_cents)-Number(donation.refunded_amount_cents||0))
    const rawAmount=window.prompt(`Refund amount in USD. Maximum ${formatUsd(remaining)}:`,(remaining/100).toFixed(2))
    if(rawAmount===null)return
    const dollars=Number(rawAmount)
    const amountCents=Math.round(dollars*100)
    if(!Number.isFinite(dollars)||amountCents<1||amountCents>remaining){setMessage(`Refund amount must be between $0.01 and ${formatUsd(remaining)}.`);return}
    const rawReason=window.prompt('Refund reason: requested_by_customer, duplicate, or fraudulent','requested_by_customer')
    if(rawReason===null)return
    const reason=rawReason.trim()
    if(!['requested_by_customer','duplicate','fraudulent'].includes(reason)){setMessage('Refund reason must be requested_by_customer, duplicate, or fraudulent.');return}
    setActionBusy(`refund:${donation.id}`);setMessage('')
    try{
      const response=await fetch(MISSION365_REFUND_URL,{method:'POST',headers:{...apiHeaders,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({donationId:donation.id,amountCents,reason})})
      const body=await response.json()
      if(!response.ok){setMessage(body.error||'Refund failed.');return}
      setMessage(`${formatUsd(amountCents)} refund submitted to Stripe.${body.vendorTransferReversalRequested?' Vendor transfer and application-fee reversal were requested automatically.':''}`)
      await refresh()
    }catch(error){setMessage(error instanceof Error?error.message:'Refund failed.')}
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
          <div style={{marginTop:14}}>{candidate.actions.length?candidate.actions.map(action=><p key={`${action.action}-${action.created_at}`} style={{margin:'6px 0'}}><strong>{formatAction(action.action)}</strong><br/><small>{action.created_at?new Date(action.created_at).toLocaleString():'Recorded'}</small></p>):<p>No review actions recorded.</p>}</div>
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

    {financeAuthorized&&<section style={{marginTop:32}}>
      <p className="eyebrow">FINANCE CONTROL</p><h2 style={{marginTop:4}}>Refunds & transfer protection</h2>
      <p>Vendor-direct refunds automatically request proportional Stripe transfer and application-fee reversals. Mission-payout refunds are blocked if they would underfund payouts already requested or released.</p>
      <div className="role-grid" style={{marginTop:16}}>
        {refundableDonations.map(donation=>{const remaining=Math.max(0,donation.amount_cents-donation.refunded_amount_cents);return <article className="role-card" key={donation.id}>
          <p className="eyebrow">{donation.settlement_mode.replaceAll('_',' ').toUpperCase()}</p>
          <h3>{missionNames.get(donation.mission_id)||'Mission donation'}</h3>
          <p>Gift: <strong>{formatUsd(donation.amount_cents)}</strong><br/>Already refunded: <strong>{formatUsd(donation.refunded_amount_cents)}</strong><br/>Refundable: <strong>{formatUsd(remaining)}</strong></p>
          <small>{new Date(donation.created_at).toLocaleString()} · {donation.status.replaceAll('_',' ')}</small>
          <div style={{marginTop:14}}><button className="button button-ghost" disabled={Boolean(actionBusy)} onClick={()=>void refundDonation(donation)}>{actionBusy===`refund:${donation.id}`?'Submitting…':'Issue refund'}</button></div>
        </article>})}
        {refundableDonations.length===0&&<article className="role-card"><h3>No refundable donations</h3><p>No succeeded donation currently has a refundable balance.</p></article>}
      </div>
    </section>}
  </>
}
