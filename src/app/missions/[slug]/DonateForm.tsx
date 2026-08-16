'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { MISSION365_CHECKOUT_URL, MISSION365_ENTRY_URL, MISSION365_SUPABASE_PUBLISHABLE_KEY } from '@/lib/mission365-public'
import { supabase } from '@/lib/supabase'

type DonorType='personal'|'business'

const PERSONAL_AMOUNTS=[5,10,25,50,100,250]
const BUSINESS_AMOUNTS=[25,50,100,250,500,1000]

export default function DonateForm({missionId}:{missionId:string}){
 const [token,setToken]=useState<string|null>(null),[userId,setUserId]=useState<string|null>(null),[ready,setReady]=useState(false),[amount,setAmount]=useState('5'),[donorType,setDonorType]=useState<DonorType>('personal'),[businesses,setBusinesses]=useState<any[]>([]),[businessOrganizationId,setBusinessOrganizationId]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[terms,setTerms]=useState(false),[accepted,setAccepted]=useState(false)
 useEffect(()=>{supabase.auth.getSession().then(async({data})=>{const session=data.session;setToken(session?.access_token||null);setUserId(session?.user.id||null);if(session){const [termsRow,entry]=await Promise.all([supabase.from('mission365_terms_acceptances').select('id').eq('user_id',session.user.id).eq('document_key','donor_terms').eq('version','2026-08-08').maybeSingle(),fetch(MISSION365_ENTRY_URL,{headers:{Authorization:`Bearer ${session.access_token}`,apikey:MISSION365_SUPABASE_PUBLISHABLE_KEY},cache:'no-store'}).then(r=>r.json()).catch(()=>null)]);setAccepted(Boolean(termsRow.data));setTerms(Boolean(termsRow.data));const orgs=entry?.businessOrganizations||[];setBusinesses(orgs);setBusinessOrganizationId(orgs[0]?.id||'')}setReady(true)})},[])
 function switchType(type:DonorType){setDonorType(type);setAmount(type==='business'?'25':'5')}
 async function give(event:FormEvent){event.preventDefault();if(!token||!userId)return;const amountCents=Math.round(Number(amount)*100),minimum=donorType==='business'?2500:500;if(!Number.isFinite(amountCents)||amountCents<minimum){setMessage(donorType==='business'?'Business monthly giving starts at $25.':'Personal monthly giving starts at $5.');return}if(donorType==='business'&&!businessOrganizationId){setMessage('Create or choose a business donor profile first.');return}if(!accepted&&!terms){setMessage('Accept the current donor terms before giving.');return}setBusy(true);setMessage('');try{if(!accepted){const {error}=await supabase.from('mission365_terms_acceptances').insert({user_id:userId,document_key:'donor_terms',version:'2026-08-08',metadata:{surface:'mission_checkout'}});if(error&&error.code!=='23505')throw error;setAccepted(true)}const response=await fetch(MISSION365_CHECKOUT_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,apikey:MISSION365_SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({missionId,amountCents,cadence:'monthly',donorType,businessOrganizationId:donorType==='business'?businessOrganizationId:null})});const body=await response.json();if(!response.ok)throw new Error(body.error||'Giving is not available yet.');if(body.checkoutUrl)window.location.assign(body.checkoutUrl)}catch(error){setMessage(error instanceof Error?error.message:'Giving is not available yet.')}finally{setBusy(false)}}
 if(!ready)return <p>Checking giving access…</p>
 if(!token)return <div><p>Sign in to start monthly support and keep receipts, subscription status, and impact history together.</p><Link className="button" href={`/login?next=${encodeURIComponent(`/missions/${window.location.pathname.split('/').pop()||''}`)}`}>Sign in to give</Link></div>
 const monthlyMinimum=donorType==='business'?25:5
 const presets=donorType==='business'?BUSINESS_AMOUNTS:PERSONAL_AMOUNTS
 return <form className="application-form" onSubmit={give}>
  <div className="giving-type-grid"><button className={`giving-type ${donorType==='personal'?'giving-type-active':''}`} type="button" onClick={()=>switchType('personal')}><strong>Personal donor</strong><span>Monthly subscriptions from $5</span></button><button className={`giving-type ${donorType==='business'?'giving-type-active':''}`} type="button" onClick={()=>switchType('business')}><strong>Business donor</strong><span>Monthly subscriptions from $25</span></button></div>
  {donorType==='business'&&(businesses.length?<label>Business donor profile<select value={businessOrganizationId} onChange={e=>setBusinessOrganizationId(e.target.value)} required>{businesses.map((o:any)=><option key={o.id} value={o.id}>{o.public_name}</option>)}</select></label>:<article className="role-card"><strong>No business donor profile yet.</strong><p>Create one in seconds. Business donor status does not bypass sponsorship or recipient verification.</p><Link className="button button-ghost" href="/join?role=donor_business">Create business donor profile</Link></article>)}
  <div>
   <strong>Choose a monthly subscription</strong>
   <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8,marginTop:10}}>{presets.map(value=><button key={value} type="button" className={`button ${Number(amount)===value?'':'button-ghost'}`} onClick={()=>setAmount(String(value))}>${value.toLocaleString()}/mo</button>)}</div>
  </div>
  <label>Or enter a custom monthly amount (USD)<input type="number" min={monthlyMinimum} step="1" value={amount} onChange={e=>setAmount(e.target.value)} required /></label>
  <small className="muted">Minimum: {donorType==='business'?'$25/month for businesses.':'$5/month for personal donors.'} Choose any preset above or enter a higher custom amount. The subscription renews monthly until cancelled.</small>
  {!accepted&&<label className="policy-check"><input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)}/><span>I accept the current <Link href="/legal#donor">Mission 365 donor/refund terms</Link>. I understand Mission 365 does not represent every contribution as tax-deductible.</span></label>}
  <button className="button" disabled={busy||(donorType==='business'&&!businessOrganizationId)}>{busy?'Opening secure checkout…':`Start ${donorType==='business'?'business ':'personal '}$${Number(amount||0).toLocaleString()}/month subscription`}</button>{message&&<p>{message}</p>}
  <small className="muted">Subscriptions and recurring billing are handled securely through Stripe. Mission 365 records each successful monthly payment, receipt, donor type, verified mission, and subsequent impact history.</small>
 </form>
}
