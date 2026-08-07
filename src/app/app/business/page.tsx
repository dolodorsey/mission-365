import { MissionAppShell, MetricGrid, WorkGrid } from '../../../components/MissionAppShell'

export const metadata={title:'Business Partner | Mission 365'}
export default function Business(){return <MissionAppShell title="Business Impact Dashboard" subtitle="Sponsor verified missions, manage employee giving, and export accountable community-impact reporting."><MetricGrid items={[
  ['Contributed','$0','Recorded Mission 365 business giving.'],
  ['Missions sponsored','0','Verified missions funded by this business.'],
  ['Employees participating','0','Opt-in employee giving participation.'],
]}/><div style={{marginTop:24}}><WorkGrid items={[
  ['Sponsor a mission','Fund a verified mission with auditable allocation and reporting.'],
  ['Employee giving','Create employee participation programs without mixing personal and company ledgers.'],
  ['Matched giving','Configure employer matching rules and limits.'],
  ['Recurring commitment','Set a recurring community-support budget.'],
  ['Impact reporting','Track locations, categories, milestones, and verified outcomes.'],
  ['Exports','Generate finance and community-impact reports for internal records.'],
]}/></div></MissionAppShell>}
