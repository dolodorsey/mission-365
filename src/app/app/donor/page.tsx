import Link from 'next/link'
import { MissionAppShell, MetricGrid, WorkGrid } from '../../../components/MissionAppShell'

export const metadata={title:'Donor App | Mission 365'}
export default function Donor(){return <MissionAppShell title="Donor Dashboard" subtitle="Your giving, missions, receipts, and impact in one place."><MetricGrid items={[
  ['Giving this year','$0','Updates from recorded donations only.'],
  ['Active giving plans','0','One-time and recurring plans will appear here.'],
  ['Missions followed','0','Verified missions you save or support.'],
]}/><div style={{marginTop:24}}><WorkGrid items={[
  ['Discover verified missions','Browse only reviewed and published missions.'],
  ['365 Giving Plan','Build a recurring plan around a daily, weekly, monthly, or custom commitment.'],
  ['Impact timeline','Follow milestones and evidence from every mission you fund.'],
  ['Receipts & history','Keep donation history and transaction receipts in one ledger.'],
]}/></div><div className="hero-actions" style={{marginTop:24}}><Link className="button" href="/missions">Explore missions</Link></div></MissionAppShell>}
