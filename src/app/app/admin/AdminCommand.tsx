'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, BellRing, CheckCircle2, ExternalLink, FileCheck2, RefreshCw, ScanSearch, ShieldCheck, WalletCards } from 'lucide-react'
import { MissionAppShell, MetricGrid } from '../../../components/MissionAppShell'
import { supabase } from '../../../lib/supabase'
import { MISSION365_ADMIN_QUEUE_URL, MISSION365_LAUNCH_STATUS_URL, MISSION365_NOTIFICATION_DISPATCH_URL, MISSION365_PAYOUT_RELEASE_URL, MISSION365_REVIEW_ACTION_URL, MISSION365_RISK_SCAN_URL, MISSION365_SUPABASE_PUBLISHABLE_KEY } from '../../../lib/mission365-public'

const headers={'apikey':MISSION365_SUPABASE_PUBLISHABLE_KEY}
const label=(v:string)=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
const money=(c:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format((Number(c)||0)/100)

export default function AdminCommand(){
  const [token,setToken]=useState<string|null>(null)
  const [queue,setQueue]=useState<any>(null)
  const [launch,setLaunch]=useState<any>(null)
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)

  const load=useCallback(async()=>{
    setBusy(true);setMessage('')
    try{
      const status=await fetch(MISSION365_LAUNCH_STATUS_URL,{headers,cache:'no-store'});if(status.ok)setLaunch(await status.json())
      const {data:{session}}=await supabase.auth.getSession();setToken(session?.access_token||null)
      if(!session){setQueue(null);return}
      const response=await fetch(MISSION365_ADMIN_QUEUE_URL,{headers:{...headers,Authorization:`Bearer ${session.access_token}`},cache:'no-store'});const body=await response.json();if(!response.ok)throw new Error(body.error||'Admin queue unavailable');setQueue(body)
    }catch(error){setMessage(error instanceof Error?error.message:'Admin queue unavailable')}finally{setBusy(false)}
  },[])
  useEffect(()=>{void load()},[load])

  async function call(url:string,payload:any){if(!token)throw new Error('Reviewer sign-in required');const response=await fetch(url,{method:'POST',headers:{...headers,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});const body=await response.json();if(!response.ok)throw new Error(body.error||'Operation failed');return body}
  async function act(action:string,payload:any={}){setBusy(true);setMessage('');try{await call(MISSION365_REVIEW_ACTION_URL,{action,...payload});setMessage(`${label(action)} completed.`);await load()}catch(error){setMessage(error instanceof Error?error.message:'Operation failed')}finally{setBusy(false)}}
  async function payout(action:string,payoutId:string){setBusy(true);setMessage('');try{await call(MISSION365_PAYOUT_RELEASE_URL,{action,payoutId});setMessage(`Payout ${action} completed.`);await load()}catch(error){setMessage(error instanceof Error?error.message:'Payout operation failed')}finally{setBusy(false)}}
  async function viewDocument(documentId:string){try{const body=await call(MISSION365_REVIEW_ACTION_URL,{action:'document_url',documentId});window.open(body.url,'_blank','noopener,noreferrer')}catch(error){setMessage(error instanceof Error?error.message:'Could not open document')}}
  async function runRiskScan(){setBusy(true);try{const body=await call(MISSION365_RISK_SCAN_URL,{});setMessage(`Risk scan complete. ${body.createdEvents||0} new event(s).`);await load()}catch(error){setMessage(error instanceof Error?error.message:'Risk scan failed')}finally{setBusy(false)}}
  async function dispatch(){setBusy(true);try{const body=await call(MISSION365_NOTIFICATION_DISPATCH_URL,{});setMessage(`Notification dispatch: ${body.sent||0} sent, ${body.failed||0} failed, ${body.unconfigured||0} awaiting provider configuration.`);await load()}catch(error){setMessage(error instanceof Error?error.message:'Dispatch failed')}finally{setBusy(false)}}
  const promptNote=(title:string)=>window.prompt(title)||''

  if(!token&&!busy)return <MissionAppShell title="Mission 365 Admin Command" subtitle="Protected verification, mission governance, finance, risk, and impact operations."><article className="role-card"><h3>Reviewer sign-in required.</h3><p>Use the confirmed email authorized for Mission 365 reviewer access. Magic-link sign-in is supported.</p><Link className="button" href="/login">Sign in securely</Link></article></MissionAppShell>

  return <MissionAppShell title="Mission 365 Admin Command" subtitle="Evidence review, mission governance, payout controls, risk operations, and impact compliance from the production backend.">
    <div className="command-bar"><div><p className="eyebrow">PRODUCTION OPERATIONS</p><p>Reviewer role: <strong>{queue?.role?label(queue.role):'—'}</strong></p></div><div className="command-actions"><button className="button button-ghost" onClick={()=>void runRiskScan()} disabled={busy}><ScanSearch size={16}/>Risk scan</button><button className="button button-ghost" onClick={()=>void dispatch()} disabled={busy}><BellRing size={16}/>Dispatch notices</button><button className="button button-ghost" onClick={()=>void load()} disabled={busy}><RefreshCw size={16}/>Refresh</button></div></div>
    {message&&<article className="role-card notice-card"><strong>{message}</strong></article>}
    <MetricGrid items={[
      ['Verification queue',String(launch?.verificationCandidates??queue?.candidates?.filter((x:any)=>['pending','under_review'].includes(x.verification_status)).length??'—'),'Organizations awaiting evidence or reviewer decisions.'],
      ['Mission review',String(queue?.missions?.length??'—'),'Missions awaiting moderation or paused/rejected review.'],
      ['Payout operations',String(queue?.payouts?.length??'—'),'Requests, approvals, failures, and reversals requiring attention.'],
      ['Open risk',String(queue?.riskEvents?.length??'—'),'Risk events that can block publication or funds movement.'],
      ['Queued notices',String(queue?.operations?.queuedNotificationDeliveries??'—'),'Email/SMS deliveries awaiting configured providers or dispatch.'],
    ]}/>

    <section className="workspace-panel"><div><p className="eyebrow"><ShieldCheck size={14}/> PAYMENT RELEASE GATE</p><h2>{launch?.payments?.liveGiving?'Live giving enabled':'Live giving credential-gated'}</h2><p>Stripe API: <strong>{launch?.payments?.stripeApi?'READY':'MISSING'}</strong> · Webhook: <strong>{launch?.payments?.webhook?'READY':'NOT READY'}</strong>. Mission publication also requires a verified organization, transfer-ready recipient account, milestones, and no high-severity risk hold.</p></div></section>

    <section className="workspace-panel"><div><p className="eyebrow"><FileCheck2 size={14}/> ORGANIZATION & DOCUMENT REVIEW</p><h2>Verification command.</h2></div>
      {!queue?.candidates?.length?<p>No organizations are in the reviewer workspace.</p>:queue.candidates.map((org:any)=><article className="ops-card" key={org.id}>
        <div className="ops-title"><div><p className="eyebrow">{label(org.verification_status)}</p><h3>{org.public_name}</h3><small>{label(org.organization_type)} · Stripe {org.payout_account?`${label(org.payout_account.onboarding_status)} / ${label(org.payout_account.transfers_status)}`:'not connected'}</small></div><span className={`status-pill status-${org.verification_status}`}>{label(org.verification_status)}</span></div>
        <div className="record-list">{(org.documents||[]).length?(org.documents||[]).map((doc:any)=><div className="record-row" key={doc.id}><div><strong>{label(doc.document_type)}</strong><small>{label(doc.review_status)}{doc.review_note?` · ${doc.review_note}`:''}</small></div><div className="row-actions"><button className="button button-ghost button-compact" onClick={()=>void viewDocument(doc.id)}><ExternalLink size={14}/>View</button><button className="button button-ghost button-compact" onClick={()=>void act('review_document',{documentId:doc.id,status:'accepted',note:promptNote('Acceptance note (optional)')})}>Accept</button><button className="button button-ghost button-compact" onClick={()=>void act('review_document',{documentId:doc.id,status:'rejected',rejectionReason:promptNote('Reason / replacement needed')})}>Reject</button></div></div>):<p>No verification documents received.</p>}</div>
        <div className="row-actions wrap"><button className="button button-ghost button-compact" onClick={()=>void act('start_review',{organizationId:org.id,note:promptNote('Review note (optional)')})}>Start review</button><button className="button button-ghost button-compact" onClick={()=>void act('needs_information',{organizationId:org.id,note:promptNote('What information is needed?')})}>Needs info</button><button className="button button-compact" onClick={()=>void act('approve',{organizationId:org.id,note:promptNote('Verification approval note (optional)')})}>Verify organization</button><button className="button button-ghost button-compact" onClick={()=>void act('reject',{organizationId:org.id,note:promptNote('Rejection reason')})}>Reject</button><button className="button button-ghost button-compact" onClick={()=>void act('suspend',{organizationId:org.id,note:promptNote('Suspension reason')})}>Suspend</button></div>
        <small className="muted">Organization verification is evidence-based. Stripe payout readiness is a later publication/funding gate, not a prerequisite to verify identity and organization records.</small>
      </article>)}
    </section>

    <section className="workspace-panel"><div><p className="eyebrow">MISSION MODERATION</p><h2>Review before publication.</h2></div>{!queue?.missions?.length?<p>No missions await moderation.</p>:<div className="record-list">{queue.missions.map((m:any)=><div className="record-row" key={m.id}><div><strong>{m.title}</strong><small>{label(m.status)} · goal {money(m.goal_amount_cents)} · funded {money(m.funded_amount_cents)}</small></div><div className="row-actions"><button className="button button-compact" onClick={()=>void act('publish_mission',{missionId:m.id,note:promptNote('Publication review note (optional)')})}>Publish</button><button className="button button-ghost button-compact" onClick={()=>void act('reject_mission',{missionId:m.id,note:promptNote('Rejection reason')})}>Reject</button><button className="button button-ghost button-compact" onClick={()=>void act('pause_mission',{missionId:m.id,note:promptNote('Pause reason')})}>Pause</button></div></div>)}</div>}</section>

    <div className="two-column-ops">
      <section className="workspace-panel"><div><p className="eyebrow">MILESTONE EVIDENCE</p><h2>Outcome verification.</h2></div>{!queue?.milestones?.length?<p>No milestones await review.</p>:<div className="record-list">{queue.milestones.map((m:any)=><div className="record-row" key={m.id}><div><strong>{m.title}</strong><small>{label(m.verification_status)} · {m.target_date||'No target date'}</small></div><div className="row-actions"><button className="button button-compact" onClick={()=>void act('verify_milestone',{milestoneId:m.id,note:promptNote('Milestone verification note')})}>Verify</button><button className="button button-ghost button-compact" onClick={()=>void act('reject_milestone',{milestoneId:m.id,note:promptNote('What evidence needs correction?')})}>Reject</button></div></div>)}</div>}</section>
      <section className="workspace-panel"><div><p className="eyebrow">IMPACT UPDATES</p><h2>Publish reviewed outcomes.</h2></div>{!queue?.impactUpdates?.length?<p>No impact updates await review.</p>:<div className="record-list">{queue.impactUpdates.map((u:any)=><div className="record-row" key={u.id}><div><strong>{u.title}</strong><small>{label(u.status)}</small></div><div className="row-actions"><button className="button button-compact" onClick={()=>void act('publish_impact',{impactUpdateId:u.id,note:promptNote('Impact review note')})}>Publish</button><button className="button button-ghost button-compact" onClick={()=>void act('reject_impact',{impactUpdateId:u.id,note:promptNote('Correction requested')})}>Reject</button></div></div>)}</div>}</section>
    </div>

    <section className="workspace-panel"><div><p className="eyebrow"><WalletCards size={14}/> PAYOUT CONTROL</p><h2>Approve, release, reverse.</h2></div>{!queue?.payouts?.length?<p>No payout operations require attention.</p>:<div className="record-list">{queue.payouts.map((p:any)=><div className="record-row" key={p.id}><div><strong>{money(p.amount_cents)} · {label(p.status)}</strong><small>Mission {p.mission_id} · Organization {p.organization_id}{p.failure_reason?` · ${p.failure_reason}`:''}</small></div><div className="row-actions">{p.status==='pending_review'&&<button className="button button-compact" onClick={()=>void payout('approve',p.id)}>Approve</button>}{p.status==='approved'&&<button className="button button-compact" onClick={()=>void payout('release',p.id)}>Release</button>}{p.status==='paid'&&<button className="button button-ghost button-compact" onClick={()=>void payout('reverse',p.id)}>Reverse</button>}</div></div>)}</div>}</section>

    <section className="workspace-panel"><div><p className="eyebrow"><AlertTriangle size={14}/> RISK CENTER</p><h2>Block funds before problems compound.</h2></div>{!queue?.riskEvents?.length?<article className="role-card"><CheckCircle2/><h3>No open risk events.</h3></article>:<div className="record-list">{queue.riskEvents.map((r:any)=><div className="record-row" key={r.id}><div><strong>{label(r.risk_type)}</strong><small>{label(r.severity)} · {r.organization_id?`Org ${r.organization_id}`:''} {r.mission_id?`Mission ${r.mission_id}`:''}</small></div><div className="row-actions"><button className="button button-ghost button-compact" onClick={()=>void act('escalate_risk',{riskEventId:r.id,severity:'critical',note:promptNote('Escalation note')})}>Escalate</button><button className="button button-compact" onClick={()=>void act('resolve_risk',{riskEventId:r.id,note:promptNote('Resolution note')})}>Resolve</button></div></div>)}</div>}</section>
  </MissionAppShell>
}
