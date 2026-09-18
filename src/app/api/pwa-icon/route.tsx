import { ImageResponse } from 'next/og'
export const runtime='edge'
export async function GET(request:Request){
  const requested=Number(new URL(request.url).searchParams.get('size')||512)
  const size=[180,192,512].includes(requested)?requested:512
  const logo=new URL('/app-logo.png',request.url).toString()
  return new ImageResponse(
    <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:'#050816',position:'relative',overflow:'hidden'}}>
      <img src={logo} alt="MISSION 365" style={{width:'86%',height:'86%',objectFit:'contain'}}/>
    </div>,{width:size,height:size}
  )
}