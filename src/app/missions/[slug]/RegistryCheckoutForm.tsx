'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Store } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { MISSION365_REGISTRY_URL, MISSION365_SUPABASE_PUBLISHABLE_KEY } from '@/lib/mission365-public'

export default function RegistryCheckoutForm({itemId,remainingCents,allowPartial,settlementMode,vendorName}:{itemId:string;remainingCents:number;allowPartial:boolean;settlementMode:'mission_payout'|'vendor_direct';vendorName?:string|null}){
  const [token,setToken]=useState<string|null>(null),[userId,setUserId]=useState<string|null>(null),[ready,setReady]=useState(false),[accepted,setAccepted]=useState(false),[terms,setTerms]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const suggested=useMemo(()=>Math.max(1,Math.min(remainingCents/100,allowPartial?100:remainingCents/100)),[remainingCents,allowPartial])
  const [amount,setAmount]=useState(String(suggested))

  useEffect(()=>{supabase.auth.getSession().then(async({data})=>{const session=data.session;setToken(session?.access_token||null);setUserId(session?.user.id||null);if(session){const {data:row}=await supabase.from('mission365_terms_acceptances').select('id').eq('user_id',session.user.id).eq('document_key','donor_terms').eq('version','2026-08-08').maybeSingle();setAccepted(Boolean(row));setTerms(Boolean(row))}setReady(true)})},[])

  async function checkout(event:FormEvent){
    event.preventDefault();if(!token||!userId)return
    const amountCents=allowPartial?Math.round(Number(amount)*100):remainingCents
    if(!Number.isInteger(amountCents)||amountCents<100||amountCents>remainingCents){setMessage(`Choose an amount from $1 to $${(remainingCents/100).toLocaleString()}.`);return}
    if(!accepted&&!terms){setMessage('Accept the donor terms before continuing.');return}
    setBusy(true);setMessage('')
    try{
      if(!accepted){const {error}=await supabase.from('mission365_terms_acceptances').upsert({user_id:userId,document_key:'donor_terms',version:'2026-08-08',metadata:{surface:'registry_checkout'}},{onConflict:'user_id,document_key,version',ignoreDuplicates:true});if(error)throw error;setAccepted(true)}
      const response=await fetch(MISSION365_REGISTRY_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,apikey:MISSION365_SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({action:'checkout_item',itemId,amountCents})})
      const body=await response.json();if(!response.ok)throw new Error(body.error||'Registry checkout is unavailable.');if(body.checkoutUrl)window.location.assign(body.checkoutUrl)
    }catch(error){setMessage(error instanceof Error?error.message:'Registry checkout is unavailable.')}finally{setBusy(false)}
  }

  if(!ready)return <p className="muted">Checking sponsorship access…</p>
  if(!token)return <div className="registry-checkout"><p>Sign in to sponsor this exact need and keep the receipt in your Mission 365 history.</p><Link className="button button-compact" href="/login">Sign in to sponsor</Link></div>

  return <form className="registry-checkout application-form" onSubmit={checkout}>
    {allowPartial?<label>Contribution amount (USD)<input type="number" min="1" max={Math.floor(remainingCents/100)} step="1" value={amount} onChange={e=>setAmount(e.target.value)} required/></label>:<p className="registry-fixed-total">Fund remaining balance: <strong>${(remainingCents/100).toLocaleString()}</strong></p>}
    {!accepted&&<label className="policy-check"><input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)}/><span>I accept the current <Link href="/legal#donor">Mission 365 donor/refund terms</Link>.</span></label>}
    <button className="button button-compact" disabled={busy}>{settlementMode==='vendor_direct'?<Store size={15}/>:null}{busy?'Opening secure checkout…':settlementMode==='vendor_direct'?'Pay this vendor':'Sponsor this item'}{settlementMode==='vendor_direct'?<ExternalLink size={14}/>:null}</button>
    {settlementMode==='vendor_direct'&&<small className="muted">This payment is routed through Mission 365 checkout to {vendorName||'the approved vendor'} after Stripe onboarding and verification.</small>}
    {message&&<small>{message}</small>}
  </form>
}
