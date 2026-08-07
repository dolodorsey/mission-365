import Link from 'next/link'
import { MissionAppShell, WorkGrid } from '../../components/MissionAppShell'

export const metadata={title:'Mission 365 App | Command Center'}
export default function AppHome(){return <MissionAppShell title="Choose your Mission 365 workspace" subtitle="One platform with separated experiences for donors, mission owners, business partners, and the verification team."><WorkGrid items={[
  ['Donor App','Discover verified missions, build recurring giving plans, follow impact, and keep receipts.'],
  ['Mission Owner App','Apply for verification, publish missions, report milestones, manage supporters, and track payouts.'],
  ['Business Partner App','Sponsor missions, manage employee or matched giving, and export community-impact reporting.'],
  ['Admin Command Center','Review applications, approve missions, supervise payouts, handle risk, and enforce reporting.'],
]}/><div className="hero-actions" style={{marginTop:24}}><Link className="button" href="/app/donor">Open donor app</Link><Link className="button button-ghost" href="/app/admin">Open admin command</Link></div></MissionAppShell>}
