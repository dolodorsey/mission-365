'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Role='mission_owner'|'donor_personal'|'donor_business'|'vendor'|'volunteer'

const roleLinks:Record<Role,Array<[string,string]>>={
  mission_owner:[['Mission Owner','/app/mission-owner'],['Profile','/app/mission-owner/profile'],['Registry','/app/mission-owner/registry']],
  donor_personal:[['My Giving','/app/donor']],
  donor_business:[['Business Giving','/app/business']],
  vendor:[['Vendor','/app/vendor']],
  volunteer:[['Volunteer','/app/volunteer']],
}

export default function AppRoleNav(){
 const pathname=usePathname()
 const [roles,setRoles]=useState<Role[]>([])
 useEffect(()=>{
  let active=true
  async function load(){
   const {data:{session}}=await supabase.auth.getSession()
   if(!session||!active){if(active)setRoles([]);return}
   const {data}=await supabase.from('mission365_user_roles').select('role,status').eq('user_id',session.user.id).eq('status','active')
   if(active)setRoles(((data||[]).map((r:any)=>r.role).filter((r:any)=>r in roleLinks)) as Role[])
  }
  void load()
  const {data:listener}=supabase.auth.onAuthStateChange(()=>void load())
  return()=>{active=false;listener.subscription.unsubscribe()}
 },[])
 const links:Array<[string,string]>=[['Dashboard','/app'],['Missions','/missions']]
 roles.forEach(role=>links.push(...roleLinks[role]))
 if(pathname.startsWith('/app/admin'))links.push(['Admin','/app/admin'])
 const unique=links.filter((item,index,array)=>array.findIndex(x=>x[1]===item[1])===index)
 return <nav className="app-role-nav" aria-label="Mission 365 app navigation">{unique.map(([label,href])=>{
  const active=href==='/app'?pathname===href:pathname.startsWith(href)
  return <Link key={href} className={`button button-ghost button-compact${active?' app-nav-active':''}`} href={href}>{label}</Link>
 })}</nav>
}
