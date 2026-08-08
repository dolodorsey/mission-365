'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { MissionAppShell, MetricGrid } from '../../../components/MissionAppShell'
import { supabase } from '../../../lib/supabase'
import { MISSION365_BUSINESS_DASHBOARD_URL, MISSION365_SUPABASE_PUBLISHABLE_KEY } from '../../../lib/mission365-public'

type Organization={id:string;public_name:string;legal_name:string;verification_status:string;website_url:string|null}
type Application={id:string;organization_id:string|null;public_name:string;status:string;created_at:string}
type Mission={id:string;slug:string;title:string;category:string;status:string}
type Sponsorship={id:string;business_organization_id:string;mission_id:string;commitment_amount_cents:number;funded_amount_cents:number;sponsorship_type:string;status:string;starts_at:string|null;ends_at:string|null;mission:Mission|null}
type Dashboard={metrics:{contributedCents:number;committedCents:number;activeSponsorships:number;givingPrograms:number};organizations:Organization[];applications:Application[];sponsorships:Sponsorship[]}

function money(cents:number){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format((Number(cents)||0)/100)}
function label(value:string){return value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}

export default function BusinessDashboardLive(){
  const [data,setData]=useState<Dashboard|null>(null)
  const [signedIn,setSignedIn]=useState(false)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')

  const load=useCallback(async()=>{
    setBusy(true);setMessage('')
    const {data:{session}}=await supabase.auth.getSession();setSignedIn(Boolean(session))
    if(!session){setData(null);setBusy(false);return}
    try{
      const response=await fetch(MISSION365_BUSINESS_DASHBOARD_URL,{headers:{Authorization:`Bearer ${session.access_token}`,apikey:MISSION365_SUPABASE_PUBLISHABLE_KEY},cache:'no-store'})
      const body=await response.json();if(!response.ok)throw new Error(body.error||'Could not load business dashboard.');setData(body)
    }catch(error){setMessage(error instanceof Error?error.message:'Could not load business dashboard.')}finally{setBusy(false)}
  },[])

  useEffect(()=>{void load()},[load])

  if(!signedIn&&!busy)return <MissionAppShell title="Business Impact Dashboard" subtitle="Sponsor verified missions, manage giving commitments, and track accountable community impact."><article className="role-card"><h3>Business sign-in required.</h3><p>Business records are returned only after the signed-in user is linked to that organization.</p><Link className="button" href="/login">Sign in</Link></article></MissionAppShell>

  return <MissionAppShell title="Business Impact Dashboard" subtitle="Live sponsorship commitments, funded impact, and verified organization status from Mission 365.">
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><p className="eyebrow">LIVE BUSINESS LEDGER</p><button className="button button-ghost" onClick={()=>void load()} disabled={busy}><RefreshCw size={16}/>{busy?'Refreshing…':'Refresh'}</button></div>
    {message&&<article className="role-card"><strong>{message}</strong></article>}
    <MetricGrid items={[
      ['Contributed',data?money(data.metrics.contributedCents):'—','Actual funded amount recorded across business sponsorships.'],
      ['Committed',data?money(data.metrics.committedCents):'—','Total business commitments recorded in Mission 365.'],
      ['Active sponsorships',data?String(data.metrics.activeSponsorships):'—','Sponsorships currently active.'],
      ['Giving programs',data?String(data.metrics.givingPrograms):'—','Matched-giving or employee-giving programs active or fulfilled.'],
    ]}/>

    <section className="workspace-panel">
      <div><p className="eyebrow">BUSINESS ORGANIZATIONS</p><h2>Connected business records.</h2></div>
      {!data?.organizations.length?<article className="role-card"><h3>No connected business organization yet.</h3><p>If you already submitted a business-partner application, open the verification workspace to create the organization record. Otherwise submit one now.</p><Link className="button" href="/apply?role=business">Apply as a business partner</Link></article>:
        <div className="record-list">{data.organizations.map(org=><div className="record-row" key={org.id}><div><strong>{org.public_name}</strong><small>{org.legal_name}{org.website_url?` · ${org.website_url}`:''}</small></div><span>{label(org.verification_status)}</span></div>)}</div>}
      {data?.applications?.length? <div style={{marginTop:18}}><p className="eyebrow">BUSINESS APPLICATIONS</p><div className="record-list">{data.applications.map(app=><div className="record-row" key={app.id}><div><strong>{app.public_name}</strong><small>{new Date(app.created_at).toLocaleDateString()}</small></div><span>{label(app.status)}</span></div>)}</div></div>:null}
    </section>

    <section className="workspace-panel">
      <div><p className="eyebrow">SPONSORSHIP PORTFOLIO</p><h2>Committed versus funded impact.</h2></div>
      {!data?.sponsorships.length?<article className="role-card"><h3>No sponsorships recorded yet.</h3><p>When your business funds or commits to a verified mission, the record will appear here with its actual funded amount and status.</p><Link className="button" href="/missions">Explore verified missions</Link></article>:
        <div className="record-list">{data.sponsorships.map(row=><div className="record-row" key={row.id}><div><strong>{row.mission?.title||'Mission sponsorship'}</strong><small>{label(row.sponsorship_type)} · {label(row.status)} · funded {money(row.funded_amount_cents)} of {money(row.commitment_amount_cents)}</small></div><span>{money(row.funded_amount_cents)}</span></div>)}</div>}
    </section>
  </MissionAppShell>
}
