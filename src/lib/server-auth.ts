import { createClient } from '@supabase/supabase-js'

export function getSupabaseClients(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishable=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRole=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!publishable) throw new Error('Supabase is not configured')
  const publicClient=createClient(url,publishable,{auth:{persistSession:false,autoRefreshToken:false}})
  const adminClient=serviceRole?createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}}):null
  return {publicClient,adminClient}
}

export async function requireUser(request:Request){
  const header=request.headers.get('authorization')||''
  const token=header.startsWith('Bearer ')?header.slice(7):''
  if(!token) return null
  const {publicClient}=getSupabaseClients()
  const {data,error}=await publicClient.auth.getUser(token)
  if(error||!data.user) return null
  return data.user
}
