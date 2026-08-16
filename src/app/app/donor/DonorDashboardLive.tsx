'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, ReceiptText } from 'lucide-react'
import { MissionAppShell, MetricGrid } from '../../../components/MissionAppShell'
import { supabase } from '../../../lib/supabase'
import { MISSION365_DONOR_DASHBOARD_URL, MISSION365_SUPABASE_PUBLISHABLE_KEY } from '../../../lib/mission365-public'

type Mission={id:string;slug:string;title:string;category:string;status:string}
type Donation={id:string;mission_id:string;amount_cents:number;currency:string;status:string;succeeded_at:string|null;created_at:string;mission:Mission|null}
type Plan={id:string;mission_id:string|null;amount_cents:number;cadence:string;status:string;created_at:string;mission:Mission|null}
type Receipt={id:string;donation_id:string;receipt_number:string;amount_cents:number;currency:string;issued_at:string;receipt_url:string|null}
type Dashboard={metrics:{givingThisYearCents:number;activePlans:number;missionsSupported:number;receiptCount:number};plans:Plan[];donations:Donation[];receipts:Receipt[]}

function money(cents:number,currency='usd'){return new Intl.NumberFormat('en-US',{style:'currency',currency:currency.toUpperCase(),maximumFractionDigits:2}).format((Number(cents)||0)/100)}
function label(value:string){return value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}

export default function DonorDashboardLive(){
  const [data,setData]=useState<Dashboard|null>(null)
  const [signedIn,setSignedIn]=useState(false)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')

  const load=useCallback(async()=>{
    setBusy(true);setMessage('')
    const {data:{session}}=await supabase.auth.getSession()
    setSignedIn(Boolean(session))
    if(!session){setData(null);setBusy(false);return}
    try{
      const response=await fetch(MISSION365_DONOR_DASHBOARD_URL,{headers:{Authorization:`Bearer ${session.access_token}`,apikey:MISSION365_SUPABASE_PUBLISHABLE_KEY},cache:'no-store'})
      const body=await response.json();if(!response.ok)throw new Error(body.error||'Could not load donor dashboard.');setData(body)
    }catch(error){setMessage(error instanceof Error?error.message:'Could not load donor dashboard.')}finally{setBusy(false)}
  },[])

  useEffect(()=>{void load()},[load])

  if(!signedIn&&!busy)return <MissionAppShell title="Donor Dashboard" subtitle="Your giving, missions, receipts, and impact in one place."><article className="role-card"><h3>Sign in to see your giving ledger.</h3><p>Only your own donation history, monthly subscriptions, and receipts are returned.</p><Link className="button" href="/login">Sign in</Link></article></MissionAppShell>

  return <MissionAppShell title="Donor Dashboard" subtitle="Live giving totals, monthly subscriptions, supported missions, and receipts from your Mission 365 ledger.">
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><p className="eyebrow">LIVE DONOR LEDGER</p><button className="button button-ghost" onClick={()=>void load()} disabled={busy}><RefreshCw size={16}/>{busy?'Refreshing…':'Refresh'}</button></div>
    {message&&<article className="role-card"><strong>{message}</strong></article>}
    <MetricGrid items={[
      ['Giving this year',data?money(data.metrics.givingThisYearCents):'—','Succeeded subscription payments recorded this calendar year.'],
      ['Active monthly subscriptions',data?String(data.metrics.activePlans):'—','Recurring Mission 365 subscriptions currently active.'],
      ['Missions supported',data?String(data.metrics.missionsSupported):'—','Unique missions with succeeded subscription payments.'],
      ['Receipts',data?String(data.metrics.receiptCount):'—','Receipts issued from recorded monthly payments.'],
    ]}/>

    <section className="workspace-panel">
      <div><p className="eyebrow">RECENT GIVING</p><h2>Your payment history.</h2></div>
      {!data?.donations.length?<article className="role-card"><h3>No recorded subscription payments yet.</h3><p>Only completed Mission 365 monthly payments appear here.</p><Link className="button" href="/missions">Explore verified missions</Link></article>:
        <div className="record-list">{data.donations.slice(0,12).map(row=><div className="record-row" key={row.id}><div><strong>{row.mission?.title||'Mission'}</strong><small>{new Date(row.succeeded_at||row.created_at).toLocaleDateString()} · {label(row.status)}</small></div><span>{money(row.amount_cents,row.currency)}</span></div>)}</div>}
    </section>

    <section className="workspace-panel">
      <div><p className="eyebrow">MONTHLY SUBSCRIPTIONS</p><h2>Your recurring Mission 365 support.</h2></div>
      {!data?.plans.length?<p>No monthly subscriptions have been created yet.</p>:<div className="record-list">{data.plans.map(plan=><div className="record-row" key={plan.id}><div><strong>{plan.mission?.title||'Mission 365 subscription'}</strong><small>{label(plan.cadence)} · {label(plan.status)}</small></div><span>{money(plan.amount_cents)}/mo</span></div>)}</div>}
    </section>

    <section className="workspace-panel">
      <div><p className="eyebrow">RECEIPTS</p><h2>Issued monthly payment records.</h2></div>
      {!data?.receipts.length?<p>No receipts have been issued yet.</p>:<div className="record-list">{data.receipts.map(receipt=><div className="record-row" key={receipt.id}><div><strong><ReceiptText size={16}/> {receipt.receipt_number}</strong><small>{new Date(receipt.issued_at).toLocaleDateString()}</small></div><span>{money(receipt.amount_cents,receipt.currency)}</span></div>)}</div>}
    </section>
  </MissionAppShell>
}
