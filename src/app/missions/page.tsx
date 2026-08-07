import Link from 'next/link'
import { ArrowLeft, BadgeCheck } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { MISSION365_SUPABASE_PUBLISHABLE_KEY, MISSION365_SUPABASE_URL } from '@/lib/mission365-public'

export const dynamic='force-dynamic'
export const metadata={title:'Verified Missions | Mission 365',description:'Explore missions that have completed Mission 365 review.'}

type Mission={id:string;slug:string;title:string;summary:string;category:string;city:string|null;region:string|null;goal_amount_cents:number;funded_amount_cents:number}

export default async function Missions(){
  const supabase=createClient(MISSION365_SUPABASE_URL,MISSION365_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data}=await supabase.from('mission365_missions').select('id,slug,title,summary,category,city,region,goal_amount_cents,funded_amount_cents').in('status',['published','funded','reporting']).order('published_at',{ascending:false})
  const missions=(data||[]) as Mission[]
  return <main className="status-page"><div className="status-card">
    <BadgeCheck size={44}/><p className="eyebrow">Verified mission directory</p><h1>Verified missions.</h1>
    <p>Only reviewed, published missions appear here. No sample charities or manufactured fundraising totals.</p>
    {missions.length===0?<div className="role-card"><h3>No missions are published yet.</h3><p>Applications can now enter verification. Giving opens only after approval and payout readiness.</p><Link className="button" href="/apply">Submit a mission</Link></div>:
      <div className="role-grid">{missions.map(m=><article className="role-card" key={m.id}><p className="eyebrow">{m.category}</p><h3>{m.title}</h3><p>{m.summary}</p><p>{[m.city,m.region].filter(Boolean).join(', ')}</p><strong>${(Number(m.funded_amount_cents)/100).toLocaleString()} raised of ${(Number(m.goal_amount_cents)/100).toLocaleString()}</strong><Link className="button" href={`/missions/${m.slug}`}>View verified mission</Link></article>)}</div>}
    <Link className="button button-ghost" href="/"><ArrowLeft size={17}/> Home</Link>
  </div></main>
}
