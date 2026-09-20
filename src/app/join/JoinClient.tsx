'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, HandHeart, HeartHandshake, Store, Target } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { MISSION365_ENTRY_URL, MISSION365_SUPABASE_PUBLISHABLE_KEY } from '@/lib/mission365-public'

type Role = 'mission_owner' | 'business_partner' | 'donor_personal' | 'donor_business' | 'vendor' | 'volunteer'

type RoleDefinition = {
  id: Role
  title: string
  price: string
  description: string
  icon: typeof Target
}

const roles: RoleDefinition[] = [
  {
    id: 'mission_owner',
    title: 'Mission Owner',
    price: 'Create + operate missions',
    description: 'Build a verified mission profile, registry, media history, posts, testimonials, volunteer needs, fundraising, milestones, and impact reporting.',
    icon: Target,
  },
  {
    id: 'business_partner',
    title: 'Business Partner',
    price: 'Support missions as a verified business',
    description: 'Apply as a business partner for sponsorship, funding, professional services, goods, employee giving, or strategic partnership opportunities.',
    icon: Building2,
  },
  {
    id: 'donor_personal',
    title: 'Personal Donor',
    price: 'Monthly from $5',
    description: 'Follow missions, give once or monthly, save favorites, keep receipts, and track what happened after funding.',
    icon: HandHeart,
  },
  {
    id: 'donor_business',
    title: 'Business Donor',
    price: 'Monthly from $25',
    description: 'Give as a business, build recurring support, sponsor specific needs, and maintain a community-impact record.',
    icon: Building2,
  },
  {
    id: 'vendor',
    title: 'Vendor',
    price: 'Get paid for mission needs',
    description: 'Join the vendor network so approved mission registry items can route sponsor dollars to the actual provider.',
    icon: Store,
  },
  {
    id: 'volunteer',
    title: 'Volunteer',
    price: 'Give time + skills',
    description: 'Join mission volunteer pools, register for opportunities, and keep participation connected to the mission profile.',
    icon: HeartHandshake,
  },
]

export default function JoinClient({ initialRole }: { initialRole: string }) {
  const [token, setToken] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<any>(null)
  const [selected, setSelected] = useState<Role | ''>(
    (roles.some((role) => role.id === initialRole) ? initialRole : '') as Role | '',
  )
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [business, setBusiness] = useState({ publicName: '', websiteUrl: '' })
  const [vendor, setVendor] = useState({
    publicName: '',
    contactEmail: '',
    phone: '',
    websiteUrl: '',
    city: 'Atlanta',
    region: 'GA',
    serviceCategories: '',
    description: '',
  })

  const load = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    setToken(session?.access_token || null)
    if (!session) {
      setSnapshot(null)
      return
    }

    const response = await fetch(MISSION365_ENTRY_URL, {
      headers: {
        apikey: MISSION365_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
      cache: 'no-store',
    })
    const body = await response.json()
    if (response.ok) {
      setSnapshot(body)
      if (body.vendorProfile) {
        setVendor({
          publicName: body.vendorProfile.public_name || '',
          contactEmail: body.vendorProfile.contact_email || '',
          phone: body.vendorProfile.phone || '',
          websiteUrl: body.vendorProfile.website_url || '',
          city: body.vendorProfile.city || '',
          region: body.vendorProfile.region || '',
          serviceCategories: (body.vendorProfile.service_categories || []).join(', '),
          description: body.vendorProfile.description || '',
        })
      }
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function post(action: string, payload: any = {}) {
    if (!token) throw new Error('Sign in required')
    const response = await fetch(MISSION365_ENTRY_URL, {
      method: 'POST',
      headers: {
        apikey: MISSION365_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...payload }),
    })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error || 'Could not update your Mission 365 entry')
    return body
  }

  async function run(fn: () => Promise<any>, success: string, redirect?: string) {
    setBusy(true)
    setMessage('')
    try {
      await fn()
      setMessage(success)
      await load()
      if (redirect) window.location.assign(redirect)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not continue')
    } finally {
      setBusy(false)
    }
  }

  async function activate(role: Role, redirect: string) {
    await run(() => post('activate_role', { role }), 'Mission 365 role activated.', redirect)
  }

  async function createBusiness(event: FormEvent) {
    event.preventDefault()
    await run(() => post('create_business_donor', business), 'Business donor profile created.', '/app/business')
  }

  async function saveVendor(event: FormEvent) {
    event.preventDefault()
    await run(
      () =>
        post('save_vendor_profile', {
          ...vendor,
          serviceCategories: vendor.serviceCategories
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      'Vendor profile saved.',
      '/app/vendor',
    )
  }

  const active = new Set(
    (snapshot?.roles || []).filter((role: any) => role.status === 'active').map((role: any) => role.role),
  )
  const authReturn = `/join${selected ? `?role=${selected}` : ''}`

  return (
    <main className="status-page">
      <section className="status-card entry-card">
        <p className="eyebrow">SIX WAYS INTO MISSION 365</p>
        <h1>Choose how you participate.</h1>
        <p>
          One account can hold more than one role. Selecting a role does not bypass mission verification, business verification,
          payout controls, or vendor Stripe onboarding.
        </p>

        {message && (
          <article className="role-card notice-card">
            <strong>{message}</strong>
          </article>
        )}

        <div className="entry-grid">
          {roles.map(({ id, title, price, description, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`entry-role ${selected === id ? 'entry-role-active' : ''}`}
              onClick={() => setSelected(id)}
            >
              <Icon size={28} />
              <span className="eyebrow">{price}</span>
              <h3>{title}</h3>
              <p>{description}</p>
              {active.has(id) && <span className="status-pill status-verified">Active on your account</span>}
            </button>
          ))}
        </div>

        {!token ? (
          <section className="workspace-panel">
            <p className="eyebrow">ACCOUNT REQUIRED</p>
            <h2>Sign in, then continue your selected path.</h2>
            <p>Your selected entry path will be waiting after login.</p>
            <Link className="button" href={`/login?next=${encodeURIComponent(authReturn)}`}>
              Sign in / create account
            </Link>
          </section>
        ) : null}

        {token && selected === 'mission_owner' && (
          <section className="workspace-panel">
            <p className="eyebrow">MISSION OWNER</p>
            <h2>Build a mission with a permanent public record.</h2>
            <p>
              Mission owners can maintain the mission story, media gallery, posts, verified testimonials, registry expenses,
              volunteer opportunities, milestones, and impact updates.
            </p>
            <button className="button" disabled={busy} onClick={() => void activate('mission_owner', '/apply?role=mission_owner')}>
              {active.has('mission_owner') ? 'Continue to mission application' : 'Activate Mission Owner'}
            </button>
          </section>
        )}

        {token && selected === 'business_partner' && (
          <section className="workspace-panel">
            <p className="eyebrow">BUSINESS PARTNER</p>
            <h2>Apply through the verified business-partner path.</h2>
            <p>
              Your application and three-document verification packet stay separate from donor activation. Approval does not
              automatically enable fundraising or payouts.
            </p>
            <Link className="button" href="/apply?role=business_partner">
              Continue to business partner application
            </Link>
          </section>
        )}

        {token && selected === 'donor_personal' && (
          <section className="workspace-panel">
            <p className="eyebrow">PERSONAL DONOR</p>
            <h2>Start as low as $5 per month.</h2>
            <p>
              Monthly personal giving is enforced at a $5 minimum. One-time giving remains available separately on open verified
              missions.
            </p>
            <button className="button" disabled={busy} onClick={() => void activate('donor_personal', '/missions')}>
              {active.has('donor_personal') ? 'Explore missions' : 'Activate Personal Donor'}
            </button>
          </section>
        )}

        {token && selected === 'donor_business' && (
          <section className="workspace-panel">
            <p className="eyebrow">BUSINESS DONOR</p>
            <h2>Start recurring business support at $25 per month.</h2>
            {snapshot?.businessOrganizations?.length ? (
              <>
                <p>You already have a business organization on this account.</p>
                <div className="record-list">
                  {snapshot.businessOrganizations.map((organization: any) => (
                    <div className="record-row" key={organization.id}>
                      <div>
                        <strong>{organization.public_name}</strong>
                        <small>
                          {organization.verification_status.replaceAll('_', ' ')} · Business donor giving does not itself grant
                          sponsorship verification.
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="button" disabled={busy} onClick={() => void activate('donor_business', '/app/business')}>
                  Use existing business donor profile
                </button>
              </>
            ) : (
              <form className="application-form" onSubmit={createBusiness}>
                <label>
                  Business name
                  <input
                    value={business.publicName}
                    onChange={(event) => setBusiness({ ...business, publicName: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Website (optional)
                  <input
                    type="url"
                    placeholder="https://"
                    value={business.websiteUrl}
                    onChange={(event) => setBusiness({ ...business, websiteUrl: event.target.value })}
                  />
                </label>
                <button className="button" disabled={busy}>
                  Create business donor profile
                </button>
              </form>
            )}
          </section>
        )}

        {token && selected === 'vendor' && (
          <section className="workspace-panel">
            <p className="eyebrow">VENDOR</p>
            <h2>Become available for direct-to-vendor registry payments.</h2>
            <p>
              This public vendor profile is your entry point. Stripe payout onboarding for a specific registry relationship remains
              separate and is initiated when a mission owner selects your vendor record.
            </p>
            <form className="application-form" onSubmit={saveVendor}>
              <div className="form-grid">
                <label>
                  Vendor / business name
                  <input
                    value={vendor.publicName}
                    onChange={(event) => setVendor({ ...vendor, publicName: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Contact email
                  <input
                    type="email"
                    value={vendor.contactEmail}
                    onChange={(event) => setVendor({ ...vendor, contactEmail: event.target.value })}
                  />
                </label>
                <label>
                  Phone
                  <input value={vendor.phone} onChange={(event) => setVendor({ ...vendor, phone: event.target.value })} />
                </label>
                <label>
                  Website
                  <input
                    type="url"
                    placeholder="https://"
                    value={vendor.websiteUrl}
                    onChange={(event) => setVendor({ ...vendor, websiteUrl: event.target.value })}
                  />
                </label>
                <label>
                  City
                  <input value={vendor.city} onChange={(event) => setVendor({ ...vendor, city: event.target.value })} />
                </label>
                <label>
                  State / region
                  <input value={vendor.region} onChange={(event) => setVendor({ ...vendor, region: event.target.value })} />
                </label>
              </div>
              <label>
                Services / categories
                <input
                  placeholder="Stage rental, printing, catering"
                  value={vendor.serviceCategories}
                  onChange={(event) => setVendor({ ...vendor, serviceCategories: event.target.value })}
                />
              </label>
              <label>
                Description
                <textarea value={vendor.description} onChange={(event) => setVendor({ ...vendor, description: event.target.value })} />
              </label>
              <button className="button" disabled={busy}>
                Save vendor profile
              </button>
            </form>
          </section>
        )}

        {token && selected === 'volunteer' && (
          <section className="workspace-panel">
            <p className="eyebrow">VOLUNTEER</p>
            <h2>Give time, talent, or labor.</h2>
            <p>Volunteer activity is separate from donations. Join the volunteer role, then choose open mission opportunities.</p>
            <button className="button" disabled={busy} onClick={() => void activate('volunteer', '/app/volunteer')}>
              {active.has('volunteer') ? 'Open volunteer opportunities' : 'Activate Volunteer'}
            </button>
          </section>
        )}

        <div className="row-actions wrap">
          <Link className="button button-ghost" href="/missions">
            Mission directory
          </Link>
          <Link className="button button-ghost" href="/app">
            App home
          </Link>
        </div>
      </section>
    </main>
  )
}
