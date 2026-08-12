import Link from 'next/link'
import { MissionAppShell, WorkGrid } from '../../components/MissionAppShell'

export const metadata={title:'Mission 365 App | Choose Your Role'}

const workspaces = [
  { href:'/app/mission-owner', title:'Mission Owner', description:'Build a verified mission profile, registry, media history, volunteer needs, milestones, fundraising, and impact reporting.', cta:'Open mission owner' },
  { href:'/app/donor', title:'Personal Donor', description:'Give once or start recurring support from $5 per month, follow missions, keep receipts, and track verified impact.', cta:'Open personal donor' },
  { href:'/app/business', title:'Business Donor', description:'Start recurring business support from $25 per month, sponsor mission needs, and maintain an impact portfolio.', cta:'Open business donor' },
  { href:'/app/vendor', title:'Vendor', description:'List services and participate in approved mission registry expenses with direct-to-vendor payment pathways.', cta:'Open vendor workspace' },
  { href:'/app/volunteer', title:'Volunteer', description:'Give time and skills by registering for mission-specific volunteer opportunities without making a donation.', cta:'Open volunteer center' },
] as const

export default function AppHome(){
  return <MissionAppShell title="Five ways to enter Mission 365" subtitle="One account can participate in multiple ways while mission verification, business verification, vendor payouts, and admin authority remain separated.">
    <WorkGrid items={workspaces.map(({title,description})=>[title,description])}/>
    <div className="hero-actions" style={{marginTop:24,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12}}>
      {workspaces.map(workspace=><Link key={workspace.href} className="button" href={workspace.href}>{workspace.cta}</Link>)}
    </div>
    <section className="workspace-panel"><p className="eyebrow">NEW TO MISSION 365?</p><h2>Choose your entry level first.</h2><p>Activate Mission Owner, Personal Donor, Business Donor, Vendor, or Volunteer. You can add other roles later without creating another account.</p><div className="row-actions wrap"><Link className="button" href="/join">Choose entry level</Link><Link className="button button-ghost" href="/missions">Browse mission profiles</Link><Link className="button button-ghost" href="/app/admin">Admin command</Link></div></section>
  </MissionAppShell>
}
