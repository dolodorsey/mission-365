/** @type {import('next').NextConfig} */
const securityHeaders=[
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'X-Frame-Options',value:'DENY'},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
  {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.stripe.com")'},
  {key:'Strict-Transport-Security',value:'max-age=63072000; includeSubDomains; preload'},
  {key:'Cross-Origin-Opener-Policy',value:'same-origin-allow-popups'},
]
const nextConfig={
  trailingSlash:false,
  turbopack:{root:__dirname},
  async headers(){return [{source:'/(.*)',headers:securityHeaders}]},
  async rewrites(){return [{source:'/brand/:path*',destination:'https://raw.githubusercontent.com/dolodorsey/mission-365/main/public/brand/:path*'}]},
}
module.exports=nextConfig
