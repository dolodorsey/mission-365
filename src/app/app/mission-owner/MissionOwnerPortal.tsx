'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, CircleDashed, FileCheck2, Landmark, RefreshCw, UploadCloud } from 'lucide-react'
import { MissionAppShell, MetricGrid } from '../../../components/MissionAppShell'
import { supabase } from '../../../lib/supabase'
import { MISSION365_OWNER_PORTAL_URL, MISSION365_SUPABASE_PUBLISHABLE_KEY } from '../../../lib/mission365-public'

type Application={id:string;organization_id:string|null;application_type:string;legal_name:string;public_name:string;contact_email:string;mission_summary:string;requested_amount_cents:number|null;status:string;created_at:string}
type Organization={id:string;legal_name:string;public_name:string;organization_type:string;website_url:string|null;verification_status:string;verified_at:string|null;updated_at:string}
type DocumentRow={id:string;application_id:string|null;organization_id:string|null;document_type:string;storage_path:string;review_status:string;reviewed_at:string|null;created_at:string}
type Mission={id:string;organization_id:string;title:string;summary:string;story:string;category:string;city:string|null;region:string|null;country_code:string;goal_amount_cents:number;funded_amount_cents:number;status:string;funding_opens_at:string|null;funding_closes_at:string|null}
type Payout={organization_id:string;onboarding_status:string;transfers_status:string;requirements_due:unknown;last_checked_at:string|null}
type Portal={applications:Application[];organizations:Organization[];documents:DocumentRow[];missions:Mission[];payoutAccounts:Payout[];memberships:Array<{organization_id:string;member_role:string}>}

const documentOptions=[
  ['authorized_rep_id','Authorized representative ID'],
  ['formation_document','Formation / registration document'],
  ['ein_or_tax_id','EIN / tax identification document'],
  ['tax_exempt_status','Tax-exempt status documentation'],
  ['program_evidence','Program / need evidence'],
  ['other','Other verification evidence'],
] as const

function money(cents:number){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format((Number(cents)||0)/100)}
function statusLabel(value:string){return value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}

export default function MissionOwnerPortal(){
  const [portal,setPortal]=useState<Portal|null>(null)
  const [token,setToken]=useState<string|null>(null)
  const [userId,setUserId]=useState<string|null>(null)
  const [selectedOrgId,setSelectedOrgId]=useState('')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [file,setFile]=useState<File|null>(null)
  const [docType,setDocType]=useState('authorized_rep_id')
  const [profile,setProfile]=useState({legal_name:'',public_name:'',organization_type:'community_project',website_url:''})
  const [mission,setMission]=useState({id:'',title:'',summary:'',story:'',category:'Community',city:'',region:'',countryCode:'US',goalAmount:'5000',fundingClosesAt:''})

  const load=useCallback(async()=>{
    setBusy(true);setMessage('')
    const {data:{session}}=await supabase.auth.getSession()
    if(!session){setToken(null);setUserId(null);setPortal(null);setBusy(false);return}
    setToken(session.access_token);setUserId(session.user.id)
    const response=await fetch(MISSION365_OWNER_PORTAL_URL,{headers:{Authorization:`Bearer ${session.access_token}`,apikey:MISSION365_SUPABASE_PUBLISHABLE_KEY},cache:'no-store'})
    const body=await response.json();setBusy(false)
    if(!response.ok){setMessage(body.error||'Could not load verification workspace.');return}
    setPortal(body)
    const firstOrg=body.organizations?.[0]?.id||''
    setSelectedOrgId(current=>current&&body.organizations?.some((o:Organization)=>o.id===current)?current:firstOrg)
  },[])

  useEffect(()=>{void load()},[load])

  const selectedOrg=useMemo(()=>portal?.organizations.find(o=>o.id===selectedOrgId)||null,[portal,selectedOrgId])
  const ownerApps=useMemo(()=>portal?.applications.filter(a=>a.application_type==='mission_owner')||[],[portal])
  const selectedApplication=useMemo(()=>ownerApps.find(a=>a.organization_id===selectedOrgId)||ownerApps[0]||null,[ownerApps,selectedOrgId])
  const selectedDocs=useMemo(()=>portal?.documents.filter(d=>d.organization_id===selectedOrgId||(!d.organization_id&&d.application_id===selectedApplication?.id))||[],[portal,selectedOrgId,selectedApplication])
  const selectedPayout=useMemo(()=>portal?.payoutAccounts.find(p=>p.organization_id===selectedOrgId)||null,[portal,selectedOrgId])
  const selectedMissions=useMemo(()=>portal?.missions.filter(m=>m.organization_id===selectedOrgId)||[],[portal,selectedOrgId])

  useEffect(()=>{
    if(!selectedOrg)return
    setProfile({legal_name:selectedOrg.legal_name,public_name:selectedOrg.public_name,organization_type:selectedOrg.organization_type,website_url:selectedOrg.website_url||''})
    const draft=selectedMissions.find(m=>m.status==='draft')
    if(draft)setMission({id:draft.id,title:draft.title,summary:draft.summary,story:draft.story,category:draft.category,city:draft.city||'',region:draft.region||'',countryCode:draft.country_code||'US',goalAmount:String(Number(draft.goal_amount_cents)/100),fundingClosesAt:draft.funding_closes_at?draft.funding_closes_at.slice(0,10):''})
    else setMission({id:'',title:'',summary:'',story:'',category:'Community',city:'',region:'',countryCode:'US',goalAmount:'5000',fundingClosesAt:''})
  },[selectedOrg,selectedMissions])

  async function post(action:string,payload:Record<string,unknown>={}){
    if(!token)throw new Error('Sign in required')
    const response=await fetch(MISSION365_OWNER_PORTAL_URL,{method:'POST',headers:{Authorization:`Bearer ${token}`,apikey:MISSION365_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({action,...payload})})
    const body=await response.json();if(!response.ok)throw new Error(body.error||'Request failed');return body
  }

  async function initialize(applicationId:string){
    setBusy(true);setMessage('')
    try{const body=await post('initialize_workspace',{applicationId});setPortal(body.portal);setSelectedOrgId(body.organizationId);setMessage('Verification workspace opened.')}catch(error){setMessage(error instanceof Error?error.message:'Could not initialize workspace.')}finally{setBusy(false)}
  }

  async function saveProfile(event:FormEvent){
    event.preventDefault();if(!selectedOrgId)return
    setBusy(true);setMessage('')
    try{await post('save_organization',{organizationId:selectedOrgId,...profile});setMessage('Organization profile saved.');await load()}catch(error){setMessage(error instanceof Error?error.message:'Profile save failed.')}finally{setBusy(false)}
  }

  async function uploadDocument(event:FormEvent){
    event.preventDefault();if(!file||!userId||!selectedOrgId)return
    if(file.size>10*1024*1024){setMessage('Files must be 10 MB or smaller.');return}
    const allowed=['application/pdf','image/jpeg','image/png','image/webp']
    if(!allowed.includes(file.type)){setMessage('Upload PDF, JPG, PNG, or WebP files only.');return}
    setBusy(true);setMessage('')
    const safeName=file.name.replace(/[^a-zA-Z0-9._-]+/g,'-')
    const storagePath=`${userId}/${selectedOrgId}/${Date.now()}-${safeName}`
    try{
      const {error}=await supabase.storage.from('mission365-private').upload(storagePath,file,{upsert:false,contentType:file.type})
      if(error)throw error
      await post('register_document',{organizationId:selectedOrgId,applicationId:selectedApplication?.id||null,documentType:docType,storagePath})
      setFile(null);setMessage('Document uploaded privately and added to verification review.');await load()
    }catch(error){setMessage(error instanceof Error?error.message:'Upload failed.')}finally{setBusy(false)}
  }

  async function saveMission(event:FormEvent){
    event.preventDefault();if(!selectedOrgId)return
    setBusy(true);setMessage('')
    try{await post('save_mission',{organizationId:selectedOrgId,mission:{...mission,goalAmount:Number(mission.goalAmount),fundingClosesAt:mission.fundingClosesAt?`${mission.fundingClosesAt}T23:59:59Z`:null}});setMessage('Mission draft saved.');await load()}catch(error){setMessage(error instanceof Error?error.message:'Mission save failed.')}finally{setBusy(false)}
  }

  async function submitMission(missionId:string){
    setBusy(true);setMessage('')
    try{await post('submit_mission',{missionId});setMessage('Mission submitted for final review.');await load()}catch(error){setMessage(error instanceof Error?error.message:'Mission submission is not available yet.')}finally{setBusy(false)}
  }

  if(busy&&!portal)return <MissionAppShell title="Mission Owner Workspace" subtitle="Loading your private verification record…"><article className="role-card"><h3>Loading secure workspace…</h3></article></MissionAppShell>
  if(!token)return <MissionAppShell title="Mission Owner Workspace" subtitle="Verification, mission building, evidence, and payout readiness in one private workspace."><article className="role-card"><h3>Sign in required</h3><p>Your verification documents and mission drafts are private.</p><Link className="button" href="/login">Sign in or create account</Link></article></MissionAppShell>

  const accepted=(type:string)=>selectedDocs.some(d=>d.document_type===type&&d.review_status==='accepted')
  const submitted=(type:string)=>selectedDocs.some(d=>d.document_type===type)
  const checklist=[
    ['Application submitted',Boolean(selectedApplication&&selectedApplication.status!=='draft')],
    ['Authorized representative ID',accepted('authorized_rep_id')||submitted('authorized_rep_id')],
    ['Formation / registration document',accepted('formation_document')||submitted('formation_document')],
    ['EIN / tax identification',accepted('ein_or_tax_id')||submitted('ein_or_tax_id')],
    ['Program / need evidence',accepted('program_evidence')||submitted('program_evidence')],
    ['Payout onboarding ready',Boolean(selectedPayout?.onboarding_status==='ready'&&selectedPayout?.transfers_status==='active')],
  ] as Array<[string,boolean]>
  const completion=Math.round(checklist.filter(([,done])=>done).length/checklist.length*100)

  return <MissionAppShell title="Mission Owner Workspace" subtitle="Verification, private document intake, organization profile, first-mission builder, and payout readiness.">
    {message&&<article className="role-card" style={{marginBottom:18}}><strong>{message}</strong></article>}
    {!selectedOrg&&<section>
      <p className="eyebrow">START VERIFICATION</p>
      {ownerApps.length===0?<article className="role-card"><h3>No mission-owner application yet.</h3><p>Submit your organization and mission purpose first. The application stays private during review.</p><Link className="button" href="/apply">Submit mission-owner application</Link></article>:
        <div className="role-grid">{ownerApps.map(app=><article className="role-card" key={app.id}><p className="eyebrow">{statusLabel(app.status)}</p><h3>{app.public_name}</h3><p>{app.mission_summary}</p><button className="button" onClick={()=>void initialize(app.id)} disabled={busy}>{app.organization_id?'Open workspace':'Create verification workspace'}</button></article>)}</div>}
    </section>}

    {selectedOrg&&<>
      <div style={{display:'flex',gap:10,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'}}>
        <div><p className="eyebrow">ORGANIZATION</p><h2 style={{margin:'4px 0'}}>{selectedOrg.public_name}</h2></div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>{portal!.organizations.length>1&&<select value={selectedOrgId} onChange={e=>setSelectedOrgId(e.target.value)}>{portal!.organizations.map(org=><option key={org.id} value={org.id}>{org.public_name}</option>)}</select>}<button className="button button-ghost" onClick={()=>void load()}><RefreshCw size={16}/>Refresh</button></div>
      </div>

      <MetricGrid items={[
        ['Verification',statusLabel(selectedOrg.verification_status),`${completion}% of owner checklist supplied or ready.`],
        ['Mission drafts',String(selectedMissions.filter(m=>m.status==='draft').length),'Drafts remain private until submitted and approved.'],
        ['Payout readiness',selectedPayout?.onboarding_status?statusLabel(selectedPayout.onboarding_status):'Not started',selectedPayout?.transfers_status==='active'?'Transfers active.':'No funds can be released until transfers are active.'],
      ]}/>

      <div className="role-grid" style={{marginTop:20}}>
        <article className="role-card"><p className="eyebrow">VERIFICATION CHECKLIST</p><h3>{completion}% supplied / ready</h3>{checklist.map(([label,done])=><p key={label} style={{display:'flex',gap:8,alignItems:'center'}}>{done?<CheckCircle2 size={18}/>:<CircleDashed size={18}/>}<span>{label}</span></p>)}</article>
        <article className="role-card"><p className="eyebrow">PAYOUT READINESS</p><Landmark/><h3>{selectedPayout?statusLabel(selectedPayout.onboarding_status):'Not started'}</h3><p>Transfers: <strong>{selectedPayout?statusLabel(selectedPayout.transfers_status):'Inactive'}</strong></p><p>Mission submission remains locked until the organization is verified and the connected payout account is transfer-active.</p></article>
        <article className="role-card"><p className="eyebrow">DOCUMENT REVIEW</p><FileCheck2/><h3>{selectedDocs.length} document{selectedDocs.length===1?'':'s'} on file</h3><p>{selectedDocs.filter(d=>d.review_status==='accepted').length} accepted · {selectedDocs.filter(d=>d.review_status==='pending').length} pending review</p></article>
      </div>

      <section className="workspace-panel">
        <div><p className="eyebrow">ORGANIZATION PROFILE</p><h2>Keep the public-facing record accurate.</h2></div>
        <form className="application-form" onSubmit={saveProfile}>
          <label>Legal organization name<input value={profile.legal_name} onChange={e=>setProfile({...profile,legal_name:e.target.value})} required /></label>
          <label>Public organization name<input value={profile.public_name} onChange={e=>setProfile({...profile,public_name:e.target.value})} required /></label>
          <label>Organization type<select value={profile.organization_type} onChange={e=>setProfile({...profile,organization_type:e.target.value})}><option value="nonprofit">Nonprofit</option><option value="community_project">Community project</option><option value="school">School</option><option value="faith_organization">Faith organization</option><option value="business">Business</option><option value="individual_mission">Individual mission</option></select></label>
          <label>Website<input type="url" value={profile.website_url} onChange={e=>setProfile({...profile,website_url:e.target.value})} placeholder="https://" /></label>
          <button className="button" disabled={busy}>Save organization profile</button>
        </form>
      </section>

      <section className="workspace-panel">
        <div><p className="eyebrow">PRIVATE DOCUMENT INTAKE</p><h2>Upload verification evidence.</h2><p>PDF, JPG, PNG, or WebP · 10 MB maximum · stored in your private Mission 365 folder.</p></div>
        <form className="application-form" onSubmit={uploadDocument}>
          <label>Document type<select value={docType} onChange={e=>setDocType(e.target.value)}>{documentOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label>File<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)} required /></label>
          <button className="button" disabled={busy||!file}><UploadCloud size={18}/>Upload privately</button>
        </form>
        {selectedDocs.length>0&&<div className="record-list">{selectedDocs.map(doc=><div className="record-row" key={doc.id}><div><strong>{documentOptions.find(([value])=>value===doc.document_type)?.[1]||statusLabel(doc.document_type)}</strong><small>{new Date(doc.created_at).toLocaleDateString()}</small></div><span>{statusLabel(doc.review_status)}</span></div>)}</div>}
      </section>

      <section className="workspace-panel">
        <div><p className="eyebrow">FIRST MISSION BUILDER</p><h2>Build the mission before fundraising opens.</h2><p>You can draft during verification. Submission stays locked until organization verification and payout readiness are complete.</p></div>
        <form className="application-form" onSubmit={saveMission}>
          <label>Mission title<input value={mission.title} onChange={e=>setMission({...mission,title:e.target.value})} required /></label>
          <label>Short summary<textarea value={mission.summary} onChange={e=>setMission({...mission,summary:e.target.value})} minLength={20} required /></label>
          <label>Full mission story<textarea value={mission.story} onChange={e=>setMission({...mission,story:e.target.value})} minLength={40} required /></label>
          <div className="form-grid"><label>Category<input value={mission.category} onChange={e=>setMission({...mission,category:e.target.value})} required /></label><label>Goal (USD)<input type="number" min="1" step="1" value={mission.goalAmount} onChange={e=>setMission({...mission,goalAmount:e.target.value})} required /></label></div>
          <div className="form-grid"><label>City<input value={mission.city} onChange={e=>setMission({...mission,city:e.target.value})} /></label><label>State / region<input value={mission.region} onChange={e=>setMission({...mission,region:e.target.value})} /></label></div>
          <div className="form-grid"><label>Country code<input maxLength={2} value={mission.countryCode} onChange={e=>setMission({...mission,countryCode:e.target.value.toUpperCase()})} /></label><label>Funding closes<input type="date" value={mission.fundingClosesAt} onChange={e=>setMission({...mission,fundingClosesAt:e.target.value})} /></label></div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button className="button" disabled={busy}>Save mission draft</button>{mission.id&&<button className="button button-ghost" type="button" disabled={busy} onClick={()=>void submitMission(mission.id)}>Submit for final review</button>}</div>
        </form>
        {selectedMissions.filter(m=>m.status!=='draft').length>0&&<div className="record-list">{selectedMissions.filter(m=>m.status!=='draft').map(row=><div className="record-row" key={row.id}><div><strong>{row.title}</strong><small>{money(row.goal_amount_cents)} goal</small></div><span>{statusLabel(row.status)}</span></div>)}</div>}
      </section>
    </>}
  </MissionAppShell>
}
