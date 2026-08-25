'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BadgeCheck, BarChart3, Building2, CalendarHeart, CheckCircle2, Globe2, HeartHandshake, LockKeyhole, ReceiptText, ShieldCheck, Sparkles, Users2 } from 'lucide-react'
import ApplicationNudge from '@/components/ApplicationNudge'

const roles = [
  [HeartHandshake, 'Everyday donors', 'Give once or build a recurring plan around the causes that matter to you.'],
  [Building2, 'Businesses', 'Sponsor verified missions and receive clear, exportable community-impact reporting.'],
  [Users2, 'Mission owners', 'Apply for verification, publish a specific need, and report progress against milestones.'],
] as const

const PROVIDER_ONBOARDING_URL = 'https://forms.thekollectivehospitality.com/f/mission-365/provider-onboarding'

type HealthSnapshot={
  verificationCandidates:number
  liveMissions:number
  payments:{stripeApi:boolean;webhook:boolean;liveGiving:boolean}
}

export default function Home() {
  const [health,setHealth]=useState<HealthSnapshot|null>(null)

  useEffect(()=>{
    let live=true
    fetch('/api/health',{cache:'no-store'})
      .then(async response=>{
        if(!response.ok) throw new Error(`health ${response.status}`)
        return response.json()
      })
      .then(data=>{if(live)setHealth(data as HealthSnapshot)})
      .catch(()=>{if(live)setHealth(null)})
    return()=>{live=false}
  },[])

  const givingLive=Boolean(health?.payments?.liveGiving&&health.liveMissions>0)

  return <main>
    <ApplicationNudge/>
    <nav className="nav-shell" aria-label="Primary navigation">
      <Link href="/" className="brand"><span className="brand-mark">M</span><span>MISSION <b>365</b></span></Link>
      <div className="nav-links"><a href="#model">How it works</a><Link href="/missions">Missions</Link><Link href="/join">Join</Link><Link href="/login">Sign in</Link></div>
      <Link href="/apply" className="button button-small">Submit a mission <ArrowRight size={16}/></Link>
    </nav>

    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow"><Sparkles size={14}/> Everyday giving. Verified impact.</p>
        <h1>Make a little impact.<br/><span>Every single day.</span></h1>
        <p className="hero-lede">Mission 365 turns one-time generosity into a trusted, year-round relationship between donors, businesses, and verified missions.</p>
        <div className="hero-actions"><Link href="/missions" className="button">Explore missions <ArrowRight size={18}/></Link><Link href="/join" className="button button-ghost">Choose how you participate</Link></div>
        <div className="launch-state"><BadgeCheck/><div><strong>{givingLive?'Live giving active':'Verification-first launch'}</strong><span>{givingLive?'Verified missions are open for support.':'Public fundraising stays closed until missions complete verification and payout readiness.'}</span></div></div>
      </div>
      <div className="hero-art"><Image src="/brand/mission365-hero.png" alt="Mission 365 community at sunrise" fill priority sizes="(max-width:900px) 100vw,48vw"/><div className="art-caption"><Globe2 size={17}/> One community. One mission. Global impact.</div></div>
    </section>

    <section className="truth-strip"><div><strong>{health?health.liveMissions:'—'}</strong><span>fundraising missions live</span></div><div><strong>{health?health.verificationCandidates:'—'}</strong><span>organizations in verification</span></div><div><strong>{health?(health.payments.liveGiving?'READY':'HOLD'):'—'}</strong><span>payment rail status</span></div></section>

    <section className="section" id="model">
      <div className="section-heading"><p className="eyebrow">One platform. Different roles.</p><h2>A complete giving ecosystem—not another donation button.</h2><p>Mission owners document the need. Reviewers verify the organization. Donors choose how to help. Every funded mission reports what happened next.</p></div>
      <div className="role-grid">{roles.map(([Icon,title,text])=><article className="role-card" key={title}><Icon/><h3>{title}</h3><p>{text}</p></article>)}</div>
      <div className="journey">{[['01','Create','Submit a specific, measurable need.'],['02','Verify','Review identity, purpose, organization and payout readiness.'],['03','Give','Open approved missions to one-time and recurring support.'],['04','Report','Publish milestones, receipts and impact evidence.']].map(([n,t,d])=><div className="journey-step" key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></div>)}</div>
    </section>

    <section className="split-section"><div className="phone-art"><Image src="/brand/mission365-impact.png" alt="Mission 365 impact dashboard preview" fill sizes="(max-width:800px) 90vw,34vw"/></div><div className="split-copy"><p className="eyebrow"><BarChart3 size={14}/> Impact you can follow</p><h2>Every gift keeps its story.</h2><p>Donors can see which mission they supported, when it was funded, the next milestone, and the evidence the mission owner supplied.</p><ul className="feature-list"><li><CalendarHeart/> One-time and recurring plans</li><li><ReceiptText/> Donation history and receipts</li><li><CheckCircle2/> Milestones and verified updates</li><li><BarChart3/> Personal and business dashboards</li></ul><div className="row-actions wrap"><Link className="button" href="/login?next=%2Fapp">Open your dashboard <ArrowRight size={18}/></Link><Link className="button button-ghost" href="/download">Mobile app status</Link></div></div></section>

    <section className="section trust" id="trust"><div className="section-heading"><p className="eyebrow"><ShieldCheck size={14}/> Safety, trust and integrity</p><h2>Trust is part of the product.</h2><p>Mission 365 does not publish sample charities, fictional donations, or projected impact as though it already happened.</p></div><div className="safeguard-grid">
      <article><span><BadgeCheck/></span><div><h3>Mission verification</h3><p>Identity, organization and payout-readiness review before funding.</p></div></article>
      <article><span><LockKeyhole/></span><div><h3>Protected giving</h3><p>Payments open only after Stripe and webhook verification.</p></div></article>
      <article><span><ReceiptText/></span><div><h3>Visible outcomes</h3><p>Updates and evidence remain connected to the funded mission.</p></div></article>
      <article><span><ShieldCheck/></span><div><h3>No manufactured impact</h3><p>Only reviewed missions and recorded activity appear in totals.</p></div></article>
    </div></section>

    <section className="partner-section"><div className="partner-art"><Image src="/brand/mission365-partner.png" alt="Mission 365 partnership artwork" fill sizes="(max-width:800px) 100vw,46vw"/></div><div className="partner-copy"><p className="eyebrow">Partners with purpose</p><h2>Turn community support into accountable action.</h2><p>Businesses can sponsor verified missions, support employee giving, and build a clear record of local impact. Service providers can also complete full network onboarding so approved mission needs can be matched with qualified vendors.</p><div className="row-actions wrap"><Link className="button" href="/join?role=donor_business">Join as a business <ArrowRight size={18}/></Link><Link className="button button-ghost" href="/join?role=vendor">Join as a Mission 365 vendor <ArrowRight size={18}/></Link><a className="button button-ghost" href={PROVIDER_ONBOARDING_URL}>Enterprise provider onboarding <ArrowRight size={18}/></a></div></div></section>

    <section className="final-cta"><p className="eyebrow">Give well. Report honestly. Repeat.</p><h2>365 days. Endless opportunities to help.</h2><div><Link href="/missions" className="button">Explore missions</Link><Link href="/apply" className="button button-ghost">Submit a mission</Link></div></section>
    <footer><div className="brand"><span className="brand-mark">M</span><span>MISSION <b>365</b></span></div><p>© 2026 Mission 365. A Kollective Hospitality Group platform.</p><div><Link href="/missions">Missions</Link><Link href="/join">Join</Link><Link href="/login">Sign in</Link><Link href="/app">Dashboard</Link><Link href="/apply">Apply</Link><Link href="/download">Apps</Link></div></footer>
  </main>
}
