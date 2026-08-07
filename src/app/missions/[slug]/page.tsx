import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import DonateForm from './DonateForm'

export const dynamic='force-dynamic'

type Props={params:Promise<{slug:string}>}

export default async function MissionPage({params}:Props){
  const {slug}=await params
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if(!url||!key)return <main className="status-page"><div className="status-card"><h1>Mission 365 giving is being connected.</h1><p>The dedicated backend must be activated before verified mission records can load.</p><Link className="button" href="/missions">Back to missions</Link></div></main>
  const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:mission}=await supabase.from('mission365_missions').select('id,title,summary,story,category,city,region,goal_amount_cents,funded_amount_cents,status,published_at').eq('slug',slug).maybeSingle()
  if(!mission||!['published','funded','reporting','completed'].includes(mission.status)||!mission.published_at) notFound()
  const percent=Math.min(100,Math.round(Number(mission.funded_amount_cents)/Number(mission.goal_amount_cents)*100))
  return <main className="status-page"><div className="status-card apply-card">
    <p className="eyebrow">Verified mission · {mission.category}</p><h1>{mission.title}</h1>
    <p>{mission.summary}</p><p>{[mission.city,mission.region].filter(Boolean).join(', ')}</p>
    <div className="role-grid compact"><article className="role-card"><h3>${(Number(mission.funded_amount_cents)/100).toLocaleString()}</h3><p>verified giving recorded</p></article><article className="role-card"><h3>{percent}%</h3><p>of ${(Number(mission.goal_amount_cents)/100).toLocaleString()} goal</p></article></div>
    <div><h2>The mission</h2><p>{mission.story}</p></div>
    {mission.status==='completed'?<p>This mission is complete and no longer accepting new gifts.</p>:<DonateForm missionId={mission.id}/>} 
    <Link className="button button-ghost" href="/missions">Back to verified missions</Link>
  </div></main>
}
