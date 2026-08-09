import Link from 'next/link'
import { MissionAppShell, WorkGrid } from '../../components/MissionAppShell'

export const metadata={title:'Mission 365 App | Command Center'}

const workspaces = [
  { href:'/app/donor', title:'Donor App', description:'Discover verified missions, build recurring giving plans, follow impact, and keep receipts.', cta:'Open donor app' },
  { href:'/app/mission-owner', title:'Mission Owner App', description:'Apply for verification, publish missions, report milestones, manage supporters, and track payouts.', cta:'Open mission owner app' },
  { href:'/app/business', title:'Business Partner App', description:'Sponsor missions, manage employee or matched giving, and export community-impact reporting.', cta:'Open business partner app' },
  { href:'/app/admin', title:'Admin Command Center', description:'Review applications, approve missions, supervise payouts, handle risk, and enforce reporting.', cta:'Open admin command' },
] as const

export default function AppHome(){
  return <MissionAppShell title="Choose your Mission 365 workspace" subtitle="One platform with separated experiences for donors, mission owners, business partners, and the verification team.">
    <WorkGrid items={workspaces.map(({title,description})=>[title,description])}/>
    <div className="hero-actions" style={{marginTop:24,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12}}>
      {workspaces.map(workspace=><Link key={workspace.href} className="button" href={workspace.href}>{workspace.cta}</Link>)}
    </div>
  </MissionAppShell>
}
