import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { MISSION365_SUPABASE_PUBLISHABLE_KEY, MISSION365_SUPABASE_URL } from '@/lib/mission365-public'
import DonateForm from './DonateForm'

export const dynamic='force-dynamic'

type Props={params:Promise<{slug:string}>}

export default async function MissionPage({params}:Props){
  const {slug}=await params
  const supabase=createClient(MISSION365_SUPABASE_URL,MISSION365_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
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
