const STRIPE_API='https://api.stripe.com'

function key(){
  const value=process.env.STRIPE_RESTRICTED_KEY||process.env.STRIPE_SECRET_KEY
  if(!value) throw new Error('Stripe is not configured')
  return value
}

export async function stripePost<T>(path:string,params:URLSearchParams,idempotencyKey?:string):Promise<T>{
  const response=await fetch(`${STRIPE_API}${path}`,{
    method:'POST',
    headers:{
      Authorization:`Bearer ${key()}`,
      'Content-Type':'application/x-www-form-urlencoded',
      ...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{}),
    },
    body:params.toString(),
    cache:'no-store',
  })
  const body=await response.json()
  if(!response.ok) throw new Error(body?.error?.message||`Stripe request failed (${response.status})`)
  return body as T
}

export async function stripeGet<T>(path:string):Promise<T>{
  const response=await fetch(`${STRIPE_API}${path}`,{
    headers:{Authorization:`Bearer ${key()}`},cache:'no-store'
  })
  const body=await response.json()
  if(!response.ok) throw new Error(body?.error?.message||`Stripe request failed (${response.status})`)
  return body as T
}
