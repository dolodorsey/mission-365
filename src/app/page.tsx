'use client'
import { useState, useEffect } from 'react'

const categories = [
  { name: 'Youth & Education', icon: '🎓', slug: 'youth-education' },
  { name: 'Homelessness', icon: '🏠', slug: 'homelessness' },
  { name: 'Food Security', icon: '🍽️', slug: 'food-security' },
  { name: 'Health & Wellness', icon: '💚', slug: 'health-wellness' },
  { name: 'Veterans', icon: '🎖️', slug: 'veterans' },
  { name: 'Animal Welfare', icon: '🐾', slug: 'animal-welfare' },
  { name: 'Faith & Community', icon: '⛪', slug: 'faith-community' },
  { name: 'Disaster Relief', icon: '🔥', slug: 'disaster-relief' },
  { name: 'Arts & Culture', icon: '🎨', slug: 'arts-culture' },
  { name: 'Environment', icon: '🌿', slug: 'environment' },
  { name: 'Women & Families', icon: '👨‍👩‍👧‍👦', slug: 'women-families' },
  { name: 'Elderly & Seniors', icon: '🤝', slug: 'elderly-seniors' },
]

export default function Home() {
  const [visible, setVisible] = useState(false)
  useEffect(() => { setVisible(true) }, [])

  return (
    <main className="grain min-h-screen">
      {/* HERO */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-midnight via-midnight/95 to-midnight" />
        <div className={`relative z-10 text-center px-6 max-w-4xl mx-auto transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-gold/80 tracking-[0.3em] uppercase text-sm font-body mb-6">Give Every Day</p>
          <h1 className="font-display text-6xl md:text-8xl font-light leading-[0.95] mb-8">
            <span className="text-cream">Mission</span>{' '}
            <span className="text-gold">365</span>
          </h1>
          <p className="text-cream/60 text-lg md:text-xl font-body max-w-2xl mx-auto mb-12 leading-relaxed">
            Turn scattered giving into predictable impact. Subscribe monthly to verified causes. 
            See exactly where your money goes. Change lives — every single day.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-8 py-4 bg-gold text-midnight font-body font-semibold tracking-wide hover:bg-gold/90 transition-all">
              START GIVING
            </button>
            <button className="px-8 py-4 border border-cream/20 text-cream font-body tracking-wide hover:border-gold/50 hover:text-gold transition-all">
              EXPLORE MISSIONS
            </button>
          </div>
        </div>
        {/* Stats bar */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-cream/10">
          <div className="max-w-6xl mx-auto grid grid-cols-3 divide-x divide-cream/10">
            {[
              { value: '$0', label: 'Total Given', note: 'launching soon' },
              { value: '0', label: 'Active Missions', note: 'accepting applications' },
              { value: '365', label: 'Days of Impact', note: 'every day counts' },
            ].map((s, i) => (
              <div key={i} className="py-6 px-4 text-center">
                <p className="text-gold font-display text-2xl md:text-3xl">{s.value}</p>
                <p className="text-cream/40 text-xs tracking-wider uppercase mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-4xl md:text-5xl text-center mb-4">
            How <span className="text-gold">It Works</span>
          </h2>
          <p className="text-cream/50 text-center mb-16 max-w-2xl mx-auto">
            Three steps to consistent, transparent, impactful giving.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Discover', desc: 'Browse verified missions by cause, location, or urgency. Every organization is vetted.' },
              { step: '02', title: 'Subscribe', desc: 'Choose your monthly amount. Pause, adjust, or cancel anytime. You\'re always in control.' },
              { step: '03', title: 'See Impact', desc: 'Receive updates showing exactly where your money went. Photos, milestones, real stories.' },
            ].map((item, i) => (
              <div key={i} className="border border-cream/10 p-8 hover:border-gold/30 transition-all group">
                <span className="text-gold/40 font-display text-5xl group-hover:text-gold/70 transition-all">{item.step}</span>
                <h3 className="font-display text-2xl text-cream mt-4 mb-3">{item.title}</h3>
                <p className="text-cream/50 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="py-24 px-6 bg-midnight/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-4xl md:text-5xl text-center mb-4">
            Choose Your <span className="text-gold">Cause</span>
          </h2>
          <p className="text-cream/50 text-center mb-16 max-w-2xl mx-auto">
            Every category. Every community. Every day.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((cat, i) => (
              <button key={i} className="border border-cream/10 p-6 text-left hover:border-gold/40 hover:bg-cream/5 transition-all group">
                <span className="text-2xl mb-3 block">{cat.icon}</span>
                <p className="text-cream/80 font-body text-sm group-hover:text-gold transition-all">{cat.name}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-4xl md:text-6xl mb-6">
            Ready to Make <span className="text-gold">Every Day</span> Count?
          </h2>
          <p className="text-cream/50 text-lg mb-10">
            Join Mission 365. Support verified causes with predictable, transparent monthly giving.
          </p>
          <button className="px-10 py-4 bg-gold text-midnight font-body font-semibold tracking-wide text-lg hover:bg-gold/90 transition-all">
            START YOUR MISSION
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-cream/10 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="font-display text-xl">Mission <span className="text-gold">365</span></p>
          <p className="text-cream/30 text-xs">© 2026 The Kollective Hospitality Group. All rights reserved.</p>
        </div>
      </footer>
    </main>
  )
}
