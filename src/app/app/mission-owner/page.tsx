import Link from 'next/link'
import { MissionAppShell, MetricGrid, WorkGrid } from '../../../components/MissionAppShell'

export const metadata={title:'Mission Owner | Mission 365'}
export default function MissionOwner(){return <MissionAppShell title="Mission Owner Workspace" subtitle="Verification, mission publishing, supporter reporting, milestones, and payout readiness."><MetricGrid items={[
  ['Verification','Not started','Identity, organization, mission purpose, and payout readiness.'],
  ['Active missions','0','Only approved missions can be published.'],
  ['Available payout','$0','Funds are released only through approved payout rules.'],
]}/><div style={{marginTop:24}}><WorkGrid items={[
  ['Application & verification','Submit organization identity, authorized representative, mission purpose, supporting documents, and banking readiness.'],
  ['Mission builder','Create goals, story, funding amount, milestones, location, media, and reporting commitments.'],
  ['Supporters','View donor activity without exposing protected payment details.'],
  ['Milestones & evidence','Submit progress updates, receipts, media, and measurable proof for review.'],
  ['Payouts','Track pending, approved, released, reversed, or held disbursements.'],
  ['Reporting','Publish accurate impact updates tied to funded missions.'],
]}/></div><div className="hero-actions" style={{marginTop:24}}><Link className="button" href="/apply">Start verification</Link></div></MissionAppShell>}
