import Link from 'next/link'
import { ArrowLeft, CheckCircle2, FileCheck2 } from 'lucide-react'
import ApplicationForm from './ApplicationForm'

export const metadata={title:'Apply | Mission 365',description:'Submit a mission or business partnership application for verification.'}
const requirements=['Organization and authorized representative identity','Specific mission purpose and requested funding','Measurable milestones and reporting schedule','Banking and payout verification before fundraising','Agreement to publish accurate impact updates']

export default function Apply(){return <main className="status-page"><div className="status-card apply-card">
  <FileCheck2 size={44}/><p className="eyebrow">Secure verification intake</p><h1>Apply to Mission 365.</h1>
  <p>Applications remain private while the Mission 365 review team verifies identity, purpose, organization information, and payout readiness.</p>
  <ul className="feature-list">{requirements.map(x=><li key={x}><CheckCircle2/>{x}</li>)}</ul>
  <ApplicationForm />
  <Link className="button button-ghost" href="/"><ArrowLeft size={17}/> Return home</Link>
</div></main>}
