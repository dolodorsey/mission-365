#!/usr/bin/env node
/**
 * Route manifest gate for Mission 365.
 *
 * The untraceable `vercel deploy --prebuilt` production upload shipped a build
 * with only 11 routes. This script reads the manifests written by `next build`
 * and fails the release if any expected route is missing, so a truncated build
 * can never reach production silently.
 *
 * Usage: node scripts/verify-routes.mjs   (run after `npm run build`)
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const NEXT_DIR = resolve(process.cwd(), '.next')

/** Every route the Mission 365 app is contractually required to serve. */
export const EXPECTED_ROUTES = [
  '/',
  '/apply',
  '/join',
  '/login',
  '/missions',
  '/missions/[slug]',
  '/app',
  '/app/donor',
  '/app/mission-owner',
  '/app/mission-owner/profile',
  '/app/mission-owner/registry',
  '/app/business',
  '/app/vendor',
  '/app/volunteer',
  '/app/admin',
  '/legal',
  '/download',
  '/api/health',
  '/robots.txt',
  '/sitemap.xml',
]

function readJson(name) {
  const file = resolve(NEXT_DIR, name)
  if (!existsSync(file)) return null
  return JSON.parse(readFileSync(file, 'utf8'))
}

export function collectBuiltRoutes() {
  const routesManifest = readJson('routes-manifest.json')
  if (!routesManifest) {
    throw new Error('.next/routes-manifest.json not found — run `npm run build` first.')
  }

  const routes = new Set()
  for (const route of routesManifest.staticRoutes ?? []) {
    if (route.page) routes.add(route.page)
  }
  for (const route of routesManifest.dynamicRoutes ?? []) {
    if (route.page) routes.add(route.page)
  }

  // App Router route handlers (/api/health, /robots.txt, /sitemap.xml) are the
  // authoritative list in this manifest; merge it in when present.
  const appPaths = readJson('app-path-routes-manifest.json')
  if (appPaths) {
    for (const page of Object.values(appPaths)) {
      if (typeof page === 'string') routes.add(page)
    }
  }

  return routes
}

export function findMissingRoutes(builtRoutes) {
  return EXPECTED_ROUTES.filter((route) => !builtRoutes.has(route))
}

function main() {
  const builtRoutes = collectBuiltRoutes()
  const missing = findMissingRoutes(builtRoutes)
  const visible = [...builtRoutes].filter((route) => !route.startsWith('/_')).sort()

  console.log(`verify-routes: build produced ${builtRoutes.size} routes (${visible.length} public).`)
  for (const route of visible) console.log(`  ${route}`)

  if (missing.length > 0) {
    console.error(`verify-routes: FAIL — ${missing.length} expected route(s) missing:`)
    for (const route of missing) console.error(`  ${route}`)
    process.exit(1)
  }

  console.log(`verify-routes: OK — all ${EXPECTED_ROUTES.length} expected routes present.`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
