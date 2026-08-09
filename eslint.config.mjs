import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

/**
 * Mission 365 lint configuration (flat config, ESLint 9 + eslint-config-next 16.3).
 * `next lint` was removed in Next 16, so the `lint` npm script calls `eslint` directly.
 */

/**
 * Pre-existing debt, not new code.
 *
 * eslint-plugin-react-hooks 7 added `react-hooks/set-state-in-effect`, which flags the
 * "load on mount then setState" pattern used by every dashboard workspace shipped before
 * this branch. Refactoring those data-loading effects is a behavioural change and does not
 * belong in a release-hardening branch, so it is downgraded to a warning for exactly these
 * files. Any *new* file that introduces the pattern still fails the lint gate.
 */
const LEGACY_SET_STATE_IN_EFFECT_FILES = [
  'src/app/app/admin/AdminCommand.tsx',
  'src/app/app/admin/AdminLiveQueue.tsx',
  'src/app/app/business/BusinessDashboardLive.tsx',
  'src/app/app/business/BusinessWorkspace.tsx',
  'src/app/app/donor/DonorDashboardLive.tsx',
  'src/app/app/donor/DonorWorkspace.tsx',
  'src/app/app/mission-owner/MissionOwnerPortal.tsx',
  'src/app/app/mission-owner/MissionOwnerWorkspace.tsx',
]

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'ios/**',
      'native-shell/**',
      'supabase/functions/**',
      'next-env.d.ts',
    ],
  },
  ...nextCoreWebVitals,
  {
    files: LEGACY_SET_STATE_IN_EFFECT_FILES,
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]
