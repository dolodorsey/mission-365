'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'
export default function GlobalError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){useEffect(()=>{console.error('Mission 365 route error',error)},[error]);return <main className="status-page"><section className="status-card"><AlertTriangle/><p className="eyebrow">MISSION 365 RECOVERY</p><h1>This workspace hit an error.</h1><p>No transaction or verification result should be inferred from this screen. Refresh the operation and confirm its recorded status before retrying any financial action.</p><div className="hero-actions"><button className="button" onClick={reset}><RefreshCw size={16}/>Retry safely</button><Link className="button button-ghost" href="/app">Command center</Link></div>{error.digest&&<small className="muted">Reference: {error.digest}</small>}</section></main>}
