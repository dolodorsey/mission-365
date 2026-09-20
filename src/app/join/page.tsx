import { redirect } from 'next/navigation'
import JoinClient from './JoinClient'

export const metadata={title:'Join Mission 365',description:'Enter Mission 365 as a mission owner, personal donor, business donor, vendor, or volunteer.'}

type SearchParams={role?:string|string[]}
export default async function JoinPage({searchParams}:{searchParams:Promise<SearchParams>}){
 const {role}=await searchParams
 const initialRole=Array.isArray(role)?role[0]:role

 // Business partners use the premium verified-applicant flow, not the general
 // participant-role activation surface. Preserve the application type before
 // authentication so normal signup/sign-in returns to the correct intake.
 if(initialRole==='business_partner')redirect('/apply?role=business_partner')

 return <JoinClient initialRole={initialRole||''}/>
}
