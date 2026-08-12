import JoinClient from './JoinClient'

export const metadata={title:'Join Mission 365',description:'Enter Mission 365 as a mission owner, personal donor, business donor, vendor, or volunteer.'}

type SearchParams={role?:string|string[]}
export default async function JoinPage({searchParams}:{searchParams:Promise<SearchParams>}){
 const {role}=await searchParams
 const initialRole=Array.isArray(role)?role[0]:role
 return <JoinClient initialRole={initialRole||''}/>
}
