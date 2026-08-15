Deno.serve(()=>new Response(JSON.stringify({disabled:true}),{status:404,headers:{'content-type':'application/json','cache-control':'no-store'}}))
