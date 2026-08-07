import { createClient } from 'npm:@supabase/supabase-js@2.112.0'

const encoder = new TextEncoder()

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL')!
  const modern = Deno.env.get('SUPABASE_SECRET_KEYS')
  const key = modern ? JSON.parse(modern).default : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function hmacHex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}

async function verifyStripeSignature(raw: string, header: string, secret: string) {
  const pieces = header.split(',').map((part) => part.split('='))
  const timestamp = pieces.find(([key]) => key === 't')?.[1]
  const signatures = pieces.filter(([key]) => key === 'v1').map(([, value]) => value)
  if (!timestamp || signatures.length === 0) return false
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false
  const expected = await hmacHex(secret, `${timestamp}.${raw}`)
  return signatures.some((signature) => constantTimeEqual(expected, signature))
}

function subscriptionMetadata(invoice: any) {
  return invoice?.parent?.subscription_details?.metadata || invoice?.subscription_details?.metadata || invoice?.metadata || {}
}

function paymentIntentFromInvoice(invoice: any) {
  if (typeof invoice?.payment_intent === 'string') return invoice.payment_intent
  for (const row of invoice?.payments?.data || []) {
    const payment = row?.payment
    if (typeof payment?.payment_intent === 'string') return payment.payment_intent
  }
  return null
}

async function issueReceipt(supabase: any, donation: any) {
  if (!donation?.id || !donation?.donor_user_id) return
  await supabase.from('mission365_receipts').upsert({
    donation_id: donation.id,
    donor_user_id: donation.donor_user_id,
    receipt_number: `M365-${String(donation.id).replaceAll('-', '').slice(0, 16).toUpperCase()}`,
    amount_cents: donation.amount_cents,
    currency: donation.currency || 'usd',
  }, { onConflict: 'donation_id', ignoreDuplicates: true })
}

async function completeOneTimeSession(supabase: any, session: any) {
  const metadata = session.metadata || {}
  if (!metadata.donation_id) return
  const { data: donation } = await supabase.from('mission365_donations').update({
    status: 'succeeded',
    stripe_payment_intent_id: session.payment_intent,
    succeeded_at: new Date().toISOString(),
  }).eq('id', metadata.donation_id).select('*').single()
  if (metadata.giving_plan_id) await supabase.from('mission365_giving_plans').update({ status: 'completed' }).eq('id', metadata.giving_plan_id)
  await issueReceipt(supabase, donation)
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 })

  const supabase = adminClient()
  const raw = await req.text()
  const signature = req.headers.get('stripe-signature') || ''
  const { data: secret, error: secretError } = await supabase.rpc('mission365_get_runtime_secret', { secret_name: 'stripe_webhook_secret' })
  if (secretError || !secret) return Response.json({ error: 'Webhook secret unavailable' }, { status: 503 })
  if (!(await verifyStripeSignature(raw, signature, secret))) return Response.json({ error: 'Invalid signature' }, { status: 400 })

  let event: any
  try { event = JSON.parse(raw) } catch { return Response.json({ error: 'Invalid payload' }, { status: 400 }) }

  const { error: claimError } = await supabase.from('mission365_stripe_events').insert({
    stripe_event_id: event.id,
    event_type: event.type,
    livemode: Boolean(event.livemode),
    payload: event,
    processing_status: 'received',
  })
  if (claimError) {
    if (claimError.code === '23505') return Response.json({ received: true, duplicate: true })
    return Response.json({ error: 'Could not claim event' }, { status: 500 })
  }

  try {
    const object = event.data?.object || {}

    if (event.type === 'checkout.session.completed') {
      const metadata = object.metadata || {}
      if (metadata.giving_plan_id) {
        const update: Record<string, unknown> = { stripe_checkout_session_id: object.id }
        if (object.mode === 'subscription' && object.subscription) {
          update.status = 'active'
          update.stripe_subscription_id = object.subscription
        }
        await supabase.from('mission365_giving_plans').update(update).eq('id', metadata.giving_plan_id)
      }
      if (object.mode === 'payment' && object.payment_status === 'paid') await completeOneTimeSession(supabase, object)
    }

    if (event.type === 'checkout.session.async_payment_succeeded') {
      if (object.mode === 'payment') await completeOneTimeSession(supabase, object)
    }

    if (event.type === 'checkout.session.async_payment_failed') {
      const metadata = object.metadata || {}
      if (metadata.donation_id) await supabase.from('mission365_donations').update({ status: 'failed' }).eq('id', metadata.donation_id)
      if (metadata.giving_plan_id) await supabase.from('mission365_giving_plans').update({ status: 'payment_failed' }).eq('id', metadata.giving_plan_id)
    }

    if (event.type === 'invoice.paid') {
      const metadata = subscriptionMetadata(object)
      const subscriptionId = object.subscription || object?.parent?.subscription_details?.subscription
      if (metadata.giving_plan_id && metadata.mission_id && metadata.donor_user_id) {
        await supabase.from('mission365_giving_plans').update({ status: 'active', ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}) }).eq('id', metadata.giving_plan_id)
        const paymentIntentId = paymentIntentFromInvoice(object)
        const amount = Number(object.amount_paid || 0)
        if (paymentIntentId && amount > 0) {
          const { data: existing } = await supabase.from('mission365_donations').select('id').eq('stripe_payment_intent_id', paymentIntentId).maybeSingle()
          if (!existing) {
            const donationId = crypto.randomUUID()
            const { data: donation } = await supabase.from('mission365_donations').insert({
              id: donationId,
              giving_plan_id: metadata.giving_plan_id,
              donor_user_id: metadata.donor_user_id,
              mission_id: metadata.mission_id,
              amount_cents: amount,
              platform_fee_cents: Math.floor(amount * 500 / 10000),
              currency: String(object.currency || 'usd').toLowerCase(),
              status: 'succeeded',
              stripe_payment_intent_id: paymentIntentId,
              idempotency_key: crypto.randomUUID(),
              succeeded_at: new Date().toISOString(),
            }).select('*').single()
            await issueReceipt(supabase, donation)
          }
        }
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const metadata = subscriptionMetadata(object)
      if (metadata.giving_plan_id) await supabase.from('mission365_giving_plans').update({ status: 'payment_failed' }).eq('id', metadata.giving_plan_id)
    }

    if (event.type === 'customer.subscription.deleted') {
      const metadata = object.metadata || {}
      if (metadata.giving_plan_id) await supabase.from('mission365_giving_plans').update({ status: 'cancelled' }).eq('id', metadata.giving_plan_id)
    }

    if (event.type === 'payment_intent.payment_failed') {
      const donationId = object.metadata?.donation_id
      if (donationId) await supabase.from('mission365_donations').update({ status: 'failed', stripe_payment_intent_id: object.id }).eq('id', donationId)
    }

    if (event.type === 'charge.refunded') {
      const paymentIntentId = typeof object.payment_intent === 'string' ? object.payment_intent : null
      if (paymentIntentId) {
        const status = Number(object.amount_refunded) >= Number(object.amount) ? 'refunded' : 'partially_refunded'
        await supabase.from('mission365_donations').update({ status }).eq('stripe_payment_intent_id', paymentIntentId)
      }
    }

    if (event.type === 'charge.dispute.created') {
      const paymentIntentId = typeof object.payment_intent === 'string' ? object.payment_intent : null
      if (paymentIntentId) {
        const { data: donation } = await supabase.from('mission365_donations').select('id,mission_id,donor_user_id').eq('stripe_payment_intent_id', paymentIntentId).maybeSingle()
        if (donation) {
          await supabase.from('mission365_donations').update({ status: 'disputed' }).eq('id', donation.id)
          await supabase.from('mission365_risk_events').insert({
            donation_id: donation.id,
            mission_id: donation.mission_id,
            user_id: donation.donor_user_id,
            risk_type: 'stripe_dispute',
            severity: 'high',
            details: { stripe_dispute_id: object.dispute || object.id, reason: object.reason },
          })
        }
      }
    }

    await supabase.from('mission365_stripe_events').update({ processing_status: 'processed', processed_at: new Date().toISOString() }).eq('stripe_event_id', event.id)
    return Response.json({ received: true })
  } catch (error) {
    await supabase.from('mission365_stripe_events').update({ processing_status: 'failed', error_message: error instanceof Error ? error.message : 'Unknown processing error' }).eq('stripe_event_id', event.id)
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
})
