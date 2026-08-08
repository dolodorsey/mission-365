import type { MetadataRoute } from 'next'
export default function robots():MetadataRoute.Robots{return {rules:[{userAgent:'*',allow:['/','/missions','/legal'],disallow:['/app/','/apply','/login','/api/']}],sitemap:'https://mission-365.vercel.app/sitemap.xml',host:'https://mission-365.vercel.app'}}
