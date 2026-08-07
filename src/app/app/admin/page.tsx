import { MissionAppShell, MetricGrid, WorkGrid } from '../../../components/MissionAppShell'

export const metadata={title:'Admin Command | Mission 365'}
export default function Admin(){return <MissionAppShell title="Mission 365 Admin Command" subtitle="Verification, mission governance, finance controls, risk review, payouts, and impact compliance."><MetricGrid items={[
  ['Applications','0','New and in-review submissions.'],
  ['Live missions','0','Reviewed missions currently published.'],
  ['Payout holds','0','Funds requiring operational review.'],
]}/><div style={{marginTop:24}}><WorkGrid items={[
  ['Verification queue','NEW → DOCUMENT REVIEW → IDENTITY REVIEW → ORGANIZATION REVIEW → FINANCIAL REVIEW → NEEDS INFO → APPROVED / REJECTED.'],
  ['Mission moderation','Review purpose, funding request, story, milestones, dates, and public claims before publication.'],
  ['Finance operations','Supervise payment events, fees, refunds, disputes, transfers, and payout reconciliation.'],
  ['People & organizations','Manage donor, mission-owner, business, reviewer, and admin account boundaries.'],
  ['Impact compliance','Enforce milestone deadlines, evidence review, and update requirements.'],
  ['Risk center','Flag duplicate identities, payout changes, suspicious activity, disputes, and complaints.'],
]}/></div></MissionAppShell>}
