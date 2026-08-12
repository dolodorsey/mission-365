'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, Store, WalletCards } from 'lucide-react'
import { MissionAppShell, MetricGrid } from '@/components/MissionAppShell'
import { supabase } from '@/lib/supabase'
import { MISSION365_ENTRY_URL, MISSION365_SUPABASE_PUBLISHABLE_KEY } from '@/lib/mission365-public'

export default function VendorWorkspace(){
 const [token,setToken]=useState<string|null>(null),[data,setData]=useState<any>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const load=useCallback(async()=>{setBusy(true);setMessage('');try{const {data:{session}}=await supabase.auth.getSession();setToken(session?.access_token||null);if(!session){setData(null);return}const r=await fetch(MISSION365_ENTRY_URL,{headers:{apikey:MISSION365_SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`},cache:'no-store'});const b=await r.json();if(!r.ok)throw new Error(b.error||'Vendor workspace unavailable');setData(b)}catch(error){setMessage(error instanceof Error?error.message:'Vendor workspace unavailable')}finally{setBusy(false)}},[])
 useEffect(()=>{void load()},[load])
 if(!token&&!busy)return <MissionAppShell title="Vendor Workspace" subtitle="Be available for mission registry work and approved direct-to-vendor payments."><article className="role-card"><Store/><h3>Vendor sign-in required.</h3><p>Create or manage a vendor profile with one Mission 365 account.</p><Link className="button" href="/login?next=%2Fapp%2Fvendor">Sign in securely</Link></article></MissionAppShell>
 const vendor=data?.vendorProfile
 if(!vendor)return <MissionAppShell title="Vendor Workspace" subtitle="Create a vendor profile to participate in mission registry fulfillment.">{message&&<article className="role-card notice-card"><strong>{message}</strong></article>}<article className="role-card"><Store/><h3>No vendor profile yet.</h3><p>Add your business name, service categories, location, website, and contact details.</p><Link className="button" href="/join?role=vendor">Create vendor profile</Link></article></MissionAppShell>
 return <MissionAppShell title="Vendor Workspace" subtitle="Your vendor identity, services, and registry-payment readiness in one place.">
  <div className="command-bar"><div><p className="eyebrow">VENDOR PROFILE</p><h2 style={{margin:0}}>{vendor.public_name}</h2></div><div className="command-actions"><Link className="button button-ghost" href="/join?role=vendor">Edit profile</Link><button className="button button-ghost" onClick={()=>void load()} disabled={busy}><RefreshCw size={16}/>Refresh</button></div></div>
  {message&&<article className="role-card notice-card"><strong>{message}</strong></article>}
  <MetricGrid items={[["Status",String(vendor.status||'active').replaceAll('_',' '),"Your Mission 365 vendor-directory status."],["Services",String((vendor.service_categories||[]).length),"Service categories listed on your profile."],["Location",[vendor.city,vendor.region].filter(Boolean).join(', ')||'Not set',"Primary service area."],["Registry payments","Per mission relationship","Stripe payout onboarding occurs when a mission owner selects you for direct vendor settlement."]]}/>
  <section className="workspace-panel"><div><p className="eyebrow"><Store size={14}/> SERVICES</p><h2>What you can provide.</h2></div><div className="row-actions wrap">{(vendor.service_categories||[]).map((x:string)=><span className="status-pill" key={x}>{x}</span>)}</div><p>{vendor.description||'No vendor description added yet.'}</p>{vendor.website_url&&<a className="button button-ghost" href={vendor.website_url} target="_blank" rel="noreferrer">Vendor website ↗</a>}</section>
  <section className="workspace-panel"><div><p className="eyebrow"><WalletCards size={14}/> DIRECT VENDOR PAYMENTS</p><h2>Registry payments stay tied to an approved need.</h2><p>A public vendor profile does not create unrestricted payout access. When a mission owner assigns your vendor record to a registry item, Mission 365 creates the specific Stripe onboarding/payment relationship needed for that mission expense. Sponsors can then fund the actual vendor instead of sending unrestricted money to the mission owner.</p></div><Link className="button button-ghost" href="/missions">Browse mission profiles</Link></section>
 </MissionAppShell>
}
