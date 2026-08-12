import Link from 'next/link'
import { ArrowLeft, Archive, BadgeCheck, Clock3, Sparkles } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { MISSION365_SUPABASE_PUBLISHABLE_KEY, MISSION365_SUPABASE_URL } from '@/lib/mission365-public'

export const dynamic='force-dynamic'
export const metadata={title:'Mission Directory | Mission 365',description:'Explore current Mission 365 profiles and the growing past-mission archive.'}

type Profile={id:string;slug:string;title:string;summary:string;category:string;city:string|null;region:string|null;lifecycle_status:'current'|'past';fundraising_status:string;cover_media_url:string|null;source_status:string}
const label=(v:string)=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
function Cover({profile}:{profile:Profile}){if(!profile.cover_media_url)return <div className="mission-cover mission-cover-empty"><Sparkles size={34}/><span>Mission 365</span></div>;return profile.cover_media_url.toLowerCase().includes('.mp4')?<video className="mission-cover" src={profile.cover_media_url} autoPlay muted loop playsInline/>:<img className="mission-cover" src={profile.cover_media_url} alt={`${profile.title} mission profile`}/>}
function Card({profile}:{profile:Profile}){return <article className={`mission-directory-card ${profile.lifecycle_status==='past'?'archive-card':''}`}><Cover profile={profile}/><div className="mission-card-body"><div className="row-actions wrap"><span className={`status-pill ${profile.lifecycle_status==='current'?'status-active':''}`}>{profile.lifecycle_status==='current'?'Current mission':'Past mission'}</span><span className="status-pill">{profile.category}</span></div><h3>{profile.title}</h3><p>{profile.summary}</p><small className="muted">{[profile.city,profile.region].filter(Boolean).join(', ')}{profile.lifecycle_status==='current'?` · ${label(profile.fundraising_status)}`:profile.source_status==='needs_source'?' · Archive source verification in progress':''}</small><Link className="button" href={`/missions/${profile.slug}`}>View mission profile</Link></div></article>}

export default async function Missions(){
 const supabase=createClient(MISSION365_SUPABASE_URL,MISSION365_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
 const {data}=await supabase.from('mission365_mission_profiles').select('id,slug,title,summary,category,city,region,lifecycle_status,fundraising_status,cover_media_url,source_status').eq('is_public',true).not('published_at','is',null).order('published_at',{ascending:false})
 const profiles=(data||[]) as Profile[],current=profiles.filter(p=>p.lifecycle_status==='current'),past=profiles.filter(p=>p.lifecycle_status==='past')
 return <main className="status-page"><div className="status-card mission-directory-shell">
  <BadgeCheck size={44}/><p className="eyebrow">MISSION 365 DIRECTORY</p><h1>Missions are living profiles.</h1><p>Every mission keeps one public home for its story, photos and video, posts, verified testimonials, volunteer opportunities, specific registry needs, fundraising status, and impact history.</p>
  <section className="workspace-panel"><div className="directory-heading"><div><p className="eyebrow"><Clock3 size={14}/> CURRENT MISSIONS</p><h2>{current.length} active profiles.</h2></div><Link className="button" href="/join">Choose how you participate</Link></div><div className="profile-directory">{current.map(p=><Card key={p.id} profile={p}/>)}</div></section>
  <section className="workspace-panel"><div><p className="eyebrow"><Archive size={14}/> PAST MISSION ARCHIVE</p><h2>{past.length} past missions preloaded.</h2><p>Past profiles are being converted into permanent records. Archive shells marked source-pending intentionally do not display invented dates, totals, testimonials, or impact claims; those fields fill in as source material is verified.</p></div><div className="profile-directory archive-directory">{past.map(p=><Card key={p.id} profile={p}/>)}</div></section>
  <div className="row-actions wrap"><Link className="button" href="/join">Mission Owner · Donor · Business · Vendor · Volunteer</Link><Link className="button button-ghost" href="/"><ArrowLeft size={17}/> Home</Link></div>
 </div></main>
}
