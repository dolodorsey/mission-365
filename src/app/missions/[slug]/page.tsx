import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Archive, BadgeCheck, CheckCircle2, Clock3, HandHeart, Images, MessageSquareQuote, Store, Users } from 'lucide-react'
import { MISSION365_SUPABASE_PUBLISHABLE_KEY, MISSION365_SUPABASE_URL } from '@/lib/mission365-public'
import DonateForm from './DonateForm'
import RegistryCheckoutForm from './RegistryCheckoutForm'
import SaveMissionButton from './SaveMissionButton'

export const dynamic='force-dynamic'
type Props={params:Promise<{slug:string}>}
const label=(v:string)=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
const isVideo=(url:string|null)=>Boolean(url&&url.toLowerCase().includes('.mp4'))

export default async function MissionPage({params}:Props){
 const {slug}=await params
 const supabase=createClient(MISSION365_SUPABASE_URL,MISSION365_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
 const {data:profile}=await supabase.from('mission365_mission_profiles').select('*').eq('slug',slug).eq('is_public',true).not('published_at','is',null).maybeSingle()
 if(!profile)notFound()
 const [{data:media},{data:posts},{data:testimonials},{data:opportunities}]=await Promise.all([
  supabase.from('mission365_mission_media').select('*').eq('profile_id',profile.id).eq('status','published').order('sort_order',{ascending:true}),
  supabase.from('mission365_mission_posts').select('*').eq('profile_id',profile.id).eq('status','published').order('published_at',{ascending:false}),
  supabase.from('mission365_mission_testimonials').select('*').eq('profile_id',profile.id).eq('status','published').eq('verification_status','verified').order('created_at',{ascending:false}),
  supabase.from('mission365_volunteer_opportunities').select('*').eq('profile_id',profile.id).in('status',['open','filled','closed']).order('starts_at',{ascending:true})
 ])
 let mission:any=null,org:any=null,milestones:any[]|null=null,updates:any[]|null=null,registryItems:any[]|null=null
 if(profile.mission_id){
  const {data:m}=await supabase.from('mission365_missions').select('id,title,goal_amount_cents,funded_amount_cents,status,published_at,organization_id,funding_closes_at').eq('id',profile.mission_id).maybeSingle();mission=m
  if(mission){
   const result=await Promise.all([
    supabase.from('mission365_organizations').select('public_name,organization_type,verification_status').eq('id',mission.organization_id).maybeSingle(),
    supabase.from('mission365_milestones').select('id,title,description,target_date,completed_at,verification_status').eq('mission_id',mission.id).order('sort_order',{ascending:true}),
    supabase.from('mission365_impact_updates').select('id,title,body,published_at').eq('mission_id',mission.id).eq('status','published').order('published_at',{ascending:false}),
    supabase.from('mission365_registry_items').select('id,title,description,category,target_amount_cents,funded_amount_cents,allow_partial,settlement_mode,vendor_name,vendor_website_url,status,due_date,sort_order').eq('mission_id',mission.id).order('sort_order',{ascending:true})
   ]);org=result[0].data;milestones=result[1].data;updates=result[2].data;registryItems=result[3].data
  }
 }
 const fundable=Boolean(mission&&['published','funded','reporting'].includes(mission.status)&&mission.published_at)
 const percent=fundable?Math.min(100,Math.round(Number(mission.funded_amount_cents)/Math.max(1,Number(mission.goal_amount_cents))*100)):0
 return <main className="status-page"><div className="status-card mission-profile-shell">
  <section className="mission-profile-hero">
   <div className="mission-profile-cover">{profile.cover_media_url?isVideo(profile.cover_media_url)?<video src={profile.cover_media_url} autoPlay muted loop playsInline/>:<img src={profile.cover_media_url} alt={`${profile.title} profile cover`}/>:<div className="mission-cover-empty"><HandHeart size={48}/><span>Mission 365</span></div>}</div>
   <div className="mission-profile-intro"><div className="row-actions wrap"><span className={`status-pill ${profile.lifecycle_status==='current'?'status-active':''}`}>{profile.lifecycle_status==='current'?<><Clock3 size={13}/> Current mission</>:<><Archive size={13}/> Past mission</>}</span><span className="status-pill">{profile.category}</span>{profile.lifecycle_status==='current'&&<span className="status-pill">Funding: {label(profile.fundraising_status)}</span>}</div><h1>{profile.title}</h1><p>{profile.summary}</p><p className="muted">{[profile.city,profile.region].filter(Boolean).join(', ')}</p>{mission&&<SaveMissionButton missionId={mission.id}/>}</div>
  </section>

  {profile.lifecycle_status==='current'&&!fundable&&<section className="workspace-panel notice-card"><p className="eyebrow">PROFILE LIVE · FUNDRAISING LOCKED</p><h2>Follow the mission now. Giving opens after verification.</h2><p>This mission profile is public while recipient verification and payout readiness are completed. When giving opens, personal supporters can start recurring support at <strong>$5/month</strong> and business donors at <strong>$25/month</strong>.</p><div className="row-actions wrap"><Link className="button" href="/join?role=donor_personal">Join as personal donor</Link><Link className="button button-ghost" href="/join?role=donor_business">Join as business donor</Link></div></section>}
  {profile.lifecycle_status==='past'&&profile.source_status==='needs_source'&&<section className="workspace-panel notice-card"><p className="eyebrow">ARCHIVE SOURCE VERIFICATION</p><h2>This historical profile is preloaded, not fabricated.</h2><p>Dates, photographs, totals, participant names, testimonials, and outcomes will appear only as source materials are attached and verified. The profile shell exists now so the historical record can be completed without inventing details.</p></section>}

  <section className="workspace-panel"><p className="eyebrow">THE MISSION</p><h2>Story, purpose & history.</h2><p>{profile.story}</p></section>

  <section className="workspace-panel"><p className="eyebrow"><Images size={14}/> PHOTO + VIDEO GALLERY</p><h2>See the mission.</h2>{media?.length?<div className="mission-gallery">{media.map((m:any)=><figure className="gallery-tile" key={m.id}>{m.media_type==='video'?<video src={m.media_url} controls playsInline/>:<img src={m.media_url} alt={m.alt_text||profile.title}/>} {m.caption&&<figcaption>{m.caption}</figcaption>}</figure>)}</div>:<p>No sourced public media has been attached yet.</p>}</section>

  <section className="workspace-panel"><p className="eyebrow">MISSION POSTS</p><h2>Updates from the mission.</h2>{posts?.length?<div className="mission-post-grid">{posts.map((p:any)=><article className="role-card" key={p.id}><span className="status-pill">{label(p.post_type)}</span><h3>{p.title}</h3><p>{p.body}</p>{p.published_at&&<small className="muted">{new Date(p.published_at).toLocaleDateString()}</small>}</article>)}</div>:<p>No public posts yet.</p>}</section>

  <section className="workspace-panel"><p className="eyebrow"><MessageSquareQuote size={14}/> VERIFIED TESTIMONIALS</p><h2>Hear from people connected to the work.</h2>{testimonials?.length?<div className="testimonial-grid">{testimonials.map((t:any)=><blockquote className="role-card" key={t.id}><p>“{t.quote}”</p><strong>{t.author_name}</strong>{t.author_role&&<small className="muted">{t.author_role}</small>}<span className="status-pill status-verified"><BadgeCheck size={13}/> Verified source</span></blockquote>)}</div>:<p>No verified public testimonials have been published yet. Mission 365 will not manufacture quotes to fill this section.</p>}</section>

  <section className="workspace-panel"><p className="eyebrow"><Users size={14}/> VOLUNTEER</p><h2>Support with time and skills.</h2>{opportunities?.length?<div className="record-list">{opportunities.map((o:any)=><div className="record-row" key={o.id}><div><strong>{o.title}</strong><small>{o.description}{o.location?` · ${o.location}`:''}{o.starts_at?` · ${new Date(o.starts_at).toLocaleString()}`:''}</small></div><span>{label(o.status)}</span></div>)}</div>:<p>No public volunteer opportunities are open yet.</p>}<Link className="button button-ghost" href="/app/volunteer">Open volunteer center</Link></section>

  {fundable&&<><div className="role-grid compact"><article className="role-card"><h3>${(Number(mission.funded_amount_cents)/100).toLocaleString()}</h3><p>recorded giving after refunds</p></article><article className="role-card"><h3>{percent}%</h3><p>of ${(Number(mission.goal_amount_cents)/100).toLocaleString()} goal</p></article><article className="role-card"><h3>{milestones?.filter((m:any)=>m.verification_status==='verified').length||0}/{milestones?.length||0}</h3><p>milestones independently verified</p></article></div>
  {registryItems?.length?<section className="workspace-panel"><p className="eyebrow">MISSION REGISTRY</p><h2>Fund exactly what this mission needs.</h2><p>Choose a specific line item instead of an unrestricted gift. Direct-to-vendor items route through an approved Stripe-connected vendor.</p><div className="registry-grid">{registryItems.map((item:any)=>{const target=Number(item.target_amount_cents),funded=Number(item.funded_amount_cents),remaining=Math.max(0,target-funded),pct=Math.min(100,Math.round(funded/target*100));return <article className="registry-item" key={item.id}><div className="registry-item-top"><div><span className={`status-pill status-${item.status}`}>{item.category} · {label(item.status)}</span><h3>{item.title}</h3><p>{item.description}</p></div><strong>${(target/100).toLocaleString()}</strong></div><div className="registry-progress"><span style={{width:`${pct}%`}}/></div><div className="registry-meta"><span>${(funded/100).toLocaleString()} funded · {pct}%</span><span>{item.settlement_mode==='vendor_direct'?<><Store size={13}/> Direct to {item.vendor_name||'approved vendor'}</>:'Mission payout'}{item.due_date?` · needed by ${new Date(`${item.due_date}T00:00:00`).toLocaleDateString()}`:''}</span></div>{item.vendor_website_url&&<a className="muted" href={item.vendor_website_url} target="_blank" rel="noreferrer">Vendor website ↗</a>}{remaining>0&&item.status!=='fulfilled'?<RegistryCheckoutForm itemId={item.id} remainingCents={remaining} allowPartial={item.allow_partial} settlementMode={item.settlement_mode as 'mission_payout'|'vendor_direct'} vendorName={item.vendor_name}/>:<p className="status-pill status-verified"><CheckCircle2 size={14}/> Fully funded</p>}</article>})}</div></section>:null}
  <section className="workspace-panel"><p className="eyebrow">MILESTONES</p><h2>What success looks like.</h2>{milestones?.length?<div className="record-list">{milestones.map((m:any)=><div className="record-row" key={m.id}><div><strong>{m.verification_status==='verified'?<CheckCircle2 size={15}/>:null}{m.title}</strong><small>{m.description} · {m.target_date||'No target date'} · {label(m.verification_status)}</small></div></div>)}</div>:<p>No public milestones are available.</p>}</section>
  <section className="workspace-panel"><p className="eyebrow">VERIFIED IMPACT</p><h2>What happened after funding.</h2>{updates?.length?<div className="record-list">{updates.map((u:any)=><div className="record-row" key={u.id}><div><strong>{u.title}</strong><small>{u.published_at?new Date(u.published_at).toLocaleDateString():''}</small><p>{u.body}</p></div></div>)}</div>:<p>No impact updates have been published yet.</p>}</section>
  <section className="workspace-panel"><p className="eyebrow">GENERAL SUPPORT</p><h2>Personal from $5/month. Business from $25/month.</h2><DonateForm missionId={mission.id}/></section></>}

  <div className="row-actions wrap"><Link className="button button-ghost" href="/missions">Back to mission directory</Link><Link className="button" href="/join">Choose a Mission 365 role</Link></div>
 </div></main>
}
