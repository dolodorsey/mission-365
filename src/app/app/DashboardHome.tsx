'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Archive, ArrowRight, BadgeCheck, Building2, HandHeart, HeartHandshake, LayoutDashboard, LogOut, Plus, ShieldCheck, Store, Target, Users } from 'lucide-react'
import AppRoleNav from '@/components/AppRoleNav'
import { supabase } from '@/lib/supabase'
import styles from './DashboardHome.module.css'

type Role='mission_owner'|'donor_personal'|'donor_business'|'vendor'|'volunteer'
type Mission={id:string;slug:string;title:string;summary:string;category:string;cover_media_url:string|null;fundraising_status:string}

const roleMeta:Record<Role,{label:string;short:string;href:string;icon:any}>={
 mission_owner:{label:'Mission Owner',short:'Operate missions, profiles and registries.',href:'/app/mission-owner',icon:Target},
 donor_personal:{label:'Personal Donor',short:'Give from $5/month and follow impact.',href:'/app/donor',icon:HandHeart},
 donor_business:{label:'Business Donor',short:'Sponsor needs from $25/month.',href:'/app/business',icon:Building2},
 vendor:{label:'Vendor',short:'Serve missions and receive approved payments.',href:'/app/vendor',icon:Store},
 volunteer:{label:'Volunteer',short:'Give time and skills to active missions.',href:'/app/volunteer',icon:HeartHandshake},
}

export default function DashboardHome(){
 const [loading,setLoading]=useState(true)
 const [email,setEmail]=useState('')
 const [roles,setRoles]=useState<Role[]>([])
 const [missions,setMissions]=useState<Mission[]>([])
 const [archiveCount,setArchiveCount]=useState(0)

 useEffect(()=>{
  let live=true
  async function load(){
   const {data:{session}}=await supabase.auth.getSession()
   if(!live)return
   if(!session){setLoading(false);return}
   setEmail(session.user.email||'Mission 365 member')
   const [rolesResult,missionsResult,archiveResult]=await Promise.all([
    supabase.from('mission365_user_roles').select('role,status').eq('user_id',session.user.id).eq('status','active'),
    supabase.from('mission365_mission_profiles').select('id,slug,title,summary,category,cover_media_url,fundraising_status').eq('lifecycle_status','current').eq('is_public',true).not('published_at','is',null).order('published_at',{ascending:false}),
    supabase.from('mission365_mission_profiles').select('id',{count:'exact',head:true}).eq('lifecycle_status','past').eq('is_public',true).not('published_at','is',null),
   ])
   if(!live)return
   setRoles(((rolesResult.data||[]).map((r:any)=>r.role).filter((r:any)=>r in roleMeta)) as Role[])
   setMissions((missionsResult.data||[]) as Mission[])
   setArchiveCount(archiveResult.count||0)
   setLoading(false)
  }
  void load()
  return()=>{live=false}
 },[])

 const quickActions=useMemo(()=>{
  const items:Array<{title:string;detail:string;href:string;icon:any}>=[]
  const has=(r:Role)=>roles.includes(r)
  if(has('mission_owner')){
   items.push({title:'Mission Owner Command',detail:'Operate missions and verification workflow.',href:'/app/mission-owner',icon:Target})
   items.push({title:'Profile Manager',detail:'Update story, media, posts and testimonials.',href:'/app/mission-owner/profile',icon:BadgeCheck})
   items.push({title:'Mission Registry',detail:'Manage itemized needs, vendors and sponsorship.',href:'/app/mission-owner/registry',icon:LayoutDashboard})
  }
  if(has('donor_personal'))items.push({title:'Personal Giving',detail:'Manage giving, receipts and supported missions.',href:'/app/donor',icon:HandHeart})
  if(has('donor_business'))items.push({title:'Business Giving',detail:'Manage sponsorships and impact portfolio.',href:'/app/business',icon:Building2})
  if(has('vendor'))items.push({title:'Vendor Workspace',detail:'Services, approvals and vendor payment readiness.',href:'/app/vendor',icon:Store})
  if(has('volunteer'))items.push({title:'Volunteer Center',detail:'Find and manage mission volunteer opportunities.',href:'/app/volunteer',icon:HeartHandshake})
  if(!items.length)items.push({title:'Choose Your First Role',detail:'Activate the way you want to participate.',href:'/join',icon:Plus})
  items.push({title:'Browse Missions',detail:'See current missions and the historical archive.',href:'/missions',icon:Archive})
  return items.slice(0,7)
 },[roles])

 const primary=useMemo(()=>{
  const order:Role[]=['mission_owner','donor_business','donor_personal','volunteer','vendor']
  const role=order.find(r=>roles.includes(r))
  return role?roleMeta[role]:null
 },[roles])

 if(loading)return <main className={styles.loading}><div className={styles.loadingInner}><span className={styles.pulse}/>Loading your Mission 365 dashboard…</div></main>
 if(!email)return <main className={styles.loading}><div className={styles.loadingInner}><ShieldCheck/>Sign in required. <Link className="button button-small" href="/login?next=%2Fapp">Sign in</Link></div></main>

 const donorEntry=roles.includes('donor_personal')&&roles.includes('donor_business')?'$5 / $25':roles.includes('donor_business')?'$25/mo':roles.includes('donor_personal')?'$5/mo':'—'

 return <main className={styles.page}><section className={styles.shell}>
  <header className={styles.topbar}>
   <Link className="brand" href="/app"><span className="brand-mark">M</span><span>MISSION <b>365</b></span></Link>
   <AppRoleNav/>
   <div className={styles.topbarRight}><span className={styles.accountChip}>{email}</span><button className={styles.signOut} onClick={async()=>{await supabase.auth.signOut();window.location.href='/'}}><LogOut size={14}/> Sign out</button></div>
  </header>

  <div className={styles.main}>
   <section className={styles.hero}>
    <article className={styles.heroPrimary}>
     <div className={styles.heroContent}>
      <div className={styles.kicker}><BadgeCheck size={14}/> YOUR MISSION 365</div>
      <h1 className={styles.heroTitle}>Welcome back.<br/><span>What are we moving today?</span></h1>
      <p className={styles.heroCopy}>{roles.length?`Your account is active in ${roles.length} Mission 365 ${roles.length===1?'lane':'lanes'}. Continue where you left off, support a current mission, or add another way to participate.`:'Your secure account is ready. Choose your first role so Mission 365 can open the right tools instead of showing you every workspace at once.'}</p>
      <div className={styles.heroActions}>{primary?<Link className="button" href={primary.href}>Continue as {primary.label}<ArrowRight size={16}/></Link>:<Link className="button" href="/join">Choose your first role<ArrowRight size={16}/></Link>}<Link className="button button-ghost" href="/missions">Explore missions</Link><Link className="button button-ghost" href="/join"><Plus size={15}/>Add role</Link></div>
     </div>
    </article>
    <aside className={styles.heroSide}>
     <div className={styles.sideTop}><h3>Your access</h3><p>Only the roles attached to your account appear here. You can add another role without making a new account.</p><div className={styles.rolePills}>{roles.map(role=>{const Icon=roleMeta[role].icon;return <Link className={styles.rolePill} href={roleMeta[role].href} key={role}><Icon/>{roleMeta[role].label}</Link>})}<Link className={`${styles.rolePill} ${styles.rolePillAdd}`} href="/join"><Plus/> Add role</Link></div></div>
     <div className={styles.sideStatus}><div className={styles.statusLine}><span>Account</span><strong>Secure</strong></div><div className={styles.statusLine}><span>Current missions</span><strong>{missions.length}</strong></div><div className={styles.statusLine}><span>Archive</span><strong>{archiveCount}</strong></div></div>
    </aside>
   </section>

   <section className={styles.section}><div className={styles.metrics}>
    <article className={styles.metric}><div className={styles.metricLabel}>Active Roles</div><div className={styles.metricValue}>{roles.length}</div><div className={styles.metricDetail}>One account. Multiple participation lanes.</div></article>
    <article className={styles.metric}><div className={styles.metricLabel}>Current Missions</div><div className={styles.metricValue}>{missions.length}</div><div className={styles.metricDetail}>Live public profiles available now.</div></article>
    <article className={styles.metric}><div className={styles.metricLabel}>Past Mission Archive</div><div className={styles.metricValue}>{archiveCount}</div><div className={styles.metricDetail}>Historical mission records preserved.</div></article>
    <article className={styles.metric}><div className={styles.metricLabel}>Recurring Entry</div><div className={styles.metricValue}>{donorEntry}</div><div className={styles.metricDetail}>{donorEntry==='—'?'Activate a donor role when you are ready.':'Minimum recurring support for your donor role.'}</div></article>
   </div></section>

   <section className={styles.section}><div className={styles.bento}>
    <article className={styles.panel}><div className={styles.sectionHead}><div><div className={styles.kicker}>YOUR LANES</div><h2>Use the tools attached to you.</h2></div></div><div className={styles.laneGrid}>{roles.map(role=>{const meta=roleMeta[role],Icon=meta.icon;return <Link className={styles.laneCard} href={meta.href} key={role}><div className={styles.laneIcon}><Icon size={19}/></div><h3>{meta.label}</h3><p>{meta.short}</p><span className={styles.laneCta}>Open workspace <ArrowRight size={13}/></span></Link>})}<Link className={`${styles.laneCard} ${styles.addLane}`} href="/join"><div className={styles.laneIcon}><Plus size={19}/></div><h3>Add another role</h3><p>Mission Owner, donor, vendor and volunteer access can live under one login.</p><span className={styles.laneCta}>Choose role <ArrowRight size={13}/></span></Link></div></article>
    <aside className={styles.panel}><div className={styles.sectionHead}><div><div className={styles.kicker}>QUICK ACTIONS</div><h2>Get to the work.</h2></div></div><div className={styles.quickList}>{quickActions.map(item=>{const Icon=item.icon;return <Link href={item.href} className={styles.quickAction} key={item.href}><div className={styles.quickActionLeft}><div className={styles.quickIcon}><Icon size={17}/></div><div className={styles.quickText}><strong>{item.title}</strong><span>{item.detail}</span></div></div><ArrowRight size={15}/></Link>})}</div></aside>
   </section>

   <section className={styles.section}><div className={styles.sectionHead}><div><div className={styles.kicker}><Users size={13}/> CURRENT MISSIONS</div><h2>Four missions moving now.</h2></div><Link className="button button-ghost button-small" href="/missions">View all missions <ArrowRight size={14}/></Link></div>{missions.length?<div className={styles.missions}>{missions.map(mission=><article className={styles.missionCard} key={mission.id}><div className={styles.missionMedia}>{mission.cover_media_url?mission.cover_media_url.toLowerCase().includes('.mp4')?<video src={mission.cover_media_url} autoPlay muted loop playsInline/>:<img src={mission.cover_media_url} alt={`${mission.title} mission`}/>:<div className={styles.missionFallback}><HandHeart size={36}/></div>}</div><div className={styles.missionBody}><div className={styles.missionMeta}><span className={styles.missionTag}>Current</span><span className={styles.missionTag}>{mission.category}</span></div><h3>{mission.title}</h3><p>{mission.summary}</p><Link className={styles.missionLink} href={`/missions/${mission.slug}`}>View profile <ArrowRight size={14}/></Link></div></article>)}</div>:<div className={styles.empty}>Current mission profiles are loading into the directory.</div>}</section>
  </div>
 </section></main>
}
