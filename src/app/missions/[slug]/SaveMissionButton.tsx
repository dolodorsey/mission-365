'use client'
import { useEffect, useState } from 'react'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { MISSION365_DONOR_DASHBOARD_URL, MISSION365_SUPABASE_PUBLISHABLE_KEY } from '@/lib/mission365-public'

export default function SaveMissionButton({missionId}:{missionId:string}){
 const [saved,setSaved]=useState(false),[token,setToken]=useState<string|null>(null),[message,setMessage]=useState('')
 useEffect(()=>{supabase.auth.getSession().then(async({data})=>{const session=data.session;setToken(session?.access_token||null);if(session){const {data:row}=await supabase.from('mission365_saved_missions').select('mission_id').eq('user_id',session.user.id).eq('mission_id',missionId).maybeSingle();setSaved(Boolean(row))}})},[missionId])
 async function toggle(){if(!token){setMessage('Sign in to save missions.');return}setMessage('');const response=await fetch(MISSION365_DONOR_DASHBOARD_URL,{method:'POST',headers:{Authorization:`Bearer ${token}`,apikey:MISSION365_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({action:saved?'unsave_mission':'save_mission',missionId})});const body=await response.json();if(!response.ok){setMessage(body.error||'Could not update saved mission.');return}setSaved(!saved)}
 return <div><button className="button button-ghost" onClick={()=>void toggle()}>{saved?<BookmarkCheck size={17}/>:<Bookmark size={17}/>} {saved?'Saved':'Save mission'}</button>{message&&<small className="muted" style={{display:'block',marginTop:8}}>{message}</small>}</div>
}
