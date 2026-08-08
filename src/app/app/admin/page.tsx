import { MissionAppShell, WorkGrid } from '../../../components/MissionAppShell'
import AdminLiveQueue from './AdminLiveQueue'

export const metadata={title:'Admin Command | Mission 365'}

export default function Admin(){return <MissionAppShell title="Mission 365 Admin Command" subtitle="Live verification, mission governance, finance controls, risk review, payouts, and impact compliance.">
  <AdminLiveQueue/>
  <div style={{marginTop:28}}><WorkGrid items={[
    ['Verification workflow','PENDING → DOCUMENT REVIEW → IDENTITY REVIEW → ORGANIZATION REVIEW → FINANCIAL REVIEW → NEEDS INFO → VERIFIED / REJECTED.'],
    ['Mission moderation','Review purpose, funding request, story, milestones, dates, evidence, and public claims before publication.'],
    ['Finance operations','Supervise payment events, platform fees, receipts, refunds, disputes, transfers, and payout reconciliation.'],
    ['People & organizations','Keep donor, mission-owner, business, reviewer, finance, and admin account boundaries separate.'],
    ['Impact compliance','Enforce milestone deadlines, evidence review, outcome updates, and reporting requirements.'],
    ['Risk center','Escalate identity conflicts, payout changes, suspicious activity, disputes, and complaints before funds move.'],
  ]}/></div>
</MissionAppShell>}
