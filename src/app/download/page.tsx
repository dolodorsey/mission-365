import Link from 'next/link'
import { ArrowLeft, Smartphone } from 'lucide-react'
export const metadata={title:'Mission 365 Apps',description:'Mission 365 mobile release status.'}
export default function DownloadPage(){return <main className="status-page"><div className="status-card"><Smartphone size={44}/><p className="eyebrow">Mobile release status</p><h1>Signed apps are not available yet.</h1><p>The generic TestFlight destination and unverified Android package have been removed. Downloads will return only after both signed builds pass release verification.</p><Link className="button button-ghost" href="/"><ArrowLeft size={17}/> Return home</Link></div></main>}
