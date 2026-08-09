/**
 * Single source of truth for Mission 365 application types.
 *
 * The database enforces `application_type in ('mission_owner','business_partner')`
 * (supabase/migrations/20260803101953_create_mission365_core.sql). Anything that
 * reaches the client from a URL must be narrowed back to that set before a write,
 * so both the `?role=` preselect and the form submit call `resolveApplicationType`.
 */

export const APPLICATION_TYPES = ['mission_owner', 'business_partner'] as const

export type ApplicationType = (typeof APPLICATION_TYPES)[number]

export const DEFAULT_APPLICATION_TYPE: ApplicationType = 'mission_owner'

/**
 * Accepted spellings for each application type. Lookup is guarded by
 * isApplicationType so inherited Object.prototype keys (`constructor`,
 * `toString`, …) can never escape as a value.
 */
const APPLICATION_TYPE_ALIASES: Readonly<Record<string, ApplicationType | undefined>> = {
  mission_owner: 'mission_owner',
  'mission-owner': 'mission_owner',
  missionowner: 'mission_owner',
  mission: 'mission_owner',
  owner: 'mission_owner',
  business_partner: 'business_partner',
  'business-partner': 'business_partner',
  businesspartner: 'business_partner',
  business: 'business_partner',
  partner: 'business_partner',
}

export function isApplicationType(value: unknown): value is ApplicationType {
  return typeof value === 'string' && (APPLICATION_TYPES as readonly string[]).includes(value)
}

/**
 * Narrow untrusted input (a `searchParams` value, a `<select>` value, anything)
 * to a known application type. Unknown, hostile, empty, or repeated values fall
 * back to DEFAULT_APPLICATION_TYPE — this function never throws.
 */
export function resolveApplicationType(raw: string | string[] | undefined): ApplicationType {
  const candidate = Array.isArray(raw) ? raw[0] : raw
  if (typeof candidate !== 'string') return DEFAULT_APPLICATION_TYPE
  const resolved = APPLICATION_TYPE_ALIASES[candidate.trim().toLowerCase()]
  return isApplicationType(resolved) ? resolved : DEFAULT_APPLICATION_TYPE
}
