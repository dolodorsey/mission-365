import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { BadgeCheck, CheckCircle2, Store } from 'lucide-react'
import { MISSION365_SUPABASE_PUBLISHABLE_KEY, MISSION365_SUPABASE_URL } from '@/lib/mission365-public'
import DonateForm from './DonateForm'
import RegistryCheckoutForm from './RegistryCheckoutForm'
import SaveMissionButton from './SaveMissionButton'

export const dynamic='force-dynamic'
type Props={params:Promise<{slug:string}>}
export default async function MissionPage({params}:Props){
 const {slug}=await params
 const supabase=createClient(MISSION365_SUPABASE_URL,MISSION365_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
 const {data:mission}=await supabase.from('mission365_missions').select('id,title,summary,story,category,city,region,goal_amount_cents,funded_amount_cents,status,published_at,organization_id').eq('slug',slug).maybeSingle()
 if(!mission||!['published','funded','reporting','completed'].includes(mission.status)||!mission.published_at)notFound()
 const [{data:org},{data:milestones},{data:updates},{data:registryItems}]=await Promise.all([
  supabase.from('mission365_organizations').select('public_name,organization_type,verification_status').eq('id',mission.organization_id).maybeSingle(),
  supabase.from('mission365_milestones').select('id,title,description,target_date,completed_at,verification_status').eq('mission_id',mission.id).order('sort_order',{ascending:true}),
  supabase.from('mission365_impact_updates').select('id,title,body,published_at').eq('mission_id',mission.id).eq('status','published').order('published_at',{ascending:false}),
  supabase.from('mission365_registry_items').select('id,title,description,category,target_amount_cents,funded_amount_cents,allow_partial,settlement_mode,vendor_name,vendor_website_url,status,due_date,sort_order').eq('mission_id',mission.id).order('sort_order',{ascending:true}).order('created_at',{ascending:true})
 ])
 const percent=Math.min(100,Math.round(Number(mission.funded_amount_cents)/Number(mission.goal_amount_cents)*100))
 return <main className="status-page"><div className="status-card apply-card">
  <p className="eyebrow"><BadgeCheck size={14}/> Verified mission · {mission.category}</p>
  <h1>{mission.title}</h1>
  <p>{mission.summary}</p>
  <div className="row-actions wrap"><span className="status-pill status-verified">Verified organization: {org?.public_name||'Mission owner'}</span><SaveMissionButton missionId={mission.id}/></div>
  <p>{[mission.city,mission.region].filter(Boolean).join(', ')}</p>
  <div className="role-grid compact"><article className="role-card"><h3>${(Number(mission.funded_amount_cents)/100).toLocaleString()}</h3><p>recorded giving after refunds</p></article><article className="role-card"><h3>{percent}%</h3><p>of ${(Number(mission.goal_amount_cents)/100).toLocaleString()} goal</p></article><article className="role-card"><h3>{milestones?.filter(m=>m.verification_status==='verified').length||0}/{milestones?.length||0}</h3><p>milestones independently verified</p></article></div>

  <section className="workspace-panel"><p className="eyebrow">THE MISSION</p><h2>Use of funds & purpose</h2><p>{mission.story}</p></section>

  {registryItems?.length?<section className="workspace-panel"><p className="eyebrow">MISSION REGISTRY</p><h2>Fund exactly what this mission needs.</h2><p>Choose a specific line item instead of making an unrestricted gift. Items marked “Direct to vendor” use Mission 365 checkout and route the funded amount to an approved Stripe-connected vendor.</p><div className="registry-grid">{registryItems.map(item=>{const target=Number(item.target_amount_cents),funded=Number(item.funded_amount_cents),remaining=Math.max(0,target-funded),pct=Math.min(100,Math.round(funded/target*100));return <article className="registry-item" key={item.id}><div className="registry-item-top"><div><span className={`status-pill status-${item.status}`}>{item.category} · {item.status.replaceAll('_',' ')}</span><h3>{item.title}</h3><p>{item.description}</p></div><strong>${(target/100).toLocaleString()}</strong></div><div className="registry-progress"><span style={{width:`${pct}%`}}/></div><div className="registry-meta"><span>${(funded/100).toLocaleString()} funded · {pct}%</span><span>{item.settlement_mode==='vendor_direct'?<><Store size={13}/> Direct to {item.vendor_name||'approved vendor'}</>:'Mission payout'}{item.due_date?` · needed by ${new Date(`${item.due_date}T00:00:00`).toLocaleDateString()}`:''}</span></div>{item.vendor_website_url&&<a className="muted" href={item.vendor_website_url} target="_blank" rel="noreferrer">Vendor website ↗</a>}{remaining>0&&item.status!=='fulfilled'&&mission.status!=='completed'?<RegistryCheckoutForm itemId={item.id} remainingCents={remaining} allowPartial={item.allow_partial} settlementMode={item.settlement_mode as 'mission_payout'|'vendor_direct'} vendorName={item.vendor_name}/>:<p className="status-pill status-verified"><CheckCircle2 size={14}/> Fully funded</p>}</article>})}</div></section>:null}

  <section className="workspace-panel"><p className="eyebrow">MILESTONES</p><h2>What success looks like.</h2>{milestones?.length?<div className="record-list">{milestones.map(m=><div className="record-row" key={m.id}><div><strong>{m.verification_status==='verified'?<CheckCircle2 size={15}/>:null}{m.title}</strong><small>{m.description} · {m.target_date||'No target date'} · {m.verification_status.replaceAll('_',' ')}</small></div></div>)}</div>:<p>No public milestones are available.</p>}</section>
  <section className="workspace-panel"><p className="eyebrow">VERIFIED IMPACT</p><h2>What happened after funding.</h2>{updates?.length?<div className="record-list">{updates.map(u=><div className="record-row" key={u.id}><div><strong>{u.title}</strong><small>{u.published_at?new Date(u.published_at).toLocaleDateString():''}</small><p>{u.body}</p></div></div>)}</div>:<p>No impact updates have been published yet.</p>}</section>
  {mission.status==='completed'?<p>This mission is complete and no longer accepting new gifts.</p>:<section className="workspace-panel"><p className="eyebrow">GENERAL SUPPORT</p><h2>Give to the mission overall.</h2><p>Prefer not to choose a registry item? Make a general one-time or monthly contribution.</p><DonateForm missionId={mission.id}/></section>}
  <p className="muted">A Mission 365 receipt records the transaction. Tax deductibility is not guaranteed and depends on the verified recipient’s tax status and applicable law.</p>
  <Link className="button button-ghost" href="/missions">Back to verified missions</Link>
 </div></main>
}
