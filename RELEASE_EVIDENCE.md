# MISSION 365 release evidence

Updated: 2026-08-07

## Product boundary

- MISSION 365 remains its own brand, repository, application, Supabase project, payment ledger, and runtime boundary.
- Production backend project: `MISSION 365` in `us-east-1`.
- Public UI is hosted on Vercel; protected payment and payout operations run in the dedicated Supabase Edge Runtime.
- The product model covers donors, businesses, mission owners, verification, recurring giving, impact milestones, receipts, risk controls, payouts, and reporting.

## Completed in this release

- Converted the project from a static-export website into a real Next.js server-capable application.
- Added Donor, Mission Owner, Business Partner, and Admin/Verification operating surfaces.
- Added email/password authentication and RLS-backed private application submission.
- Added a Supabase-backed verified mission directory and individual mission pages.
- Provisioned the dedicated MISSION 365 Supabase production project and applied the full schema.
- Added private document storage, explicit Data API grants, RLS policies, payout accounting, webhook idempotency, receipts, risk events, notifications, audit history, and financial-integrity triggers.
- Deployed isolated Supabase Edge Functions for Stripe Checkout, Stripe webhook reconciliation, and controlled payout release.
- Registered the live Stripe webhook endpoint on API version `2026-06-24.dahlia` and stored its signing secret in Supabase Vault.
- Added one-time and monthly Checkout session creation with mission/donor/giving-plan metadata.
- Added webhook handling for paid/failed/async payments, recurring invoices, subscription cancellation, refunds, and disputes.
- Added hold-and-release payout controls using separate charges and transfers economics; platform fees are retained by transferring less to recipients.
- Upgraded Next.js from 16.2.12 to 16.3.0 to remediate production PostCSS/sharp advisories.
- Production dependency audit passes with zero production vulnerabilities after the upgrade.
- TypeScript and optimized Next.js production build pass under Next.js 16.3.0.
- Supabase security advisor reports only informational no-policy notices on intentionally server-only tables.

## Launch safety gates

- No fictional missions, donations, or impact records are seeded.
- No mission is public until its organization completes verification and payout readiness.
- Live giving remains credential-gated until a dedicated Stripe restricted live API key is added to the MISSION 365 Supabase Edge Function secret/Vault. The current placeholder intentionally returns HTTP 503 instead of attempting a charge.
- Mission payout release requires a Mission 365 `admin` or `finance` app-metadata role, an approved payout record, an active Stripe recipient transfer capability, and sufficient cleared mission proceeds.
- Native App Store / Play Store release remains separate from this web production release.

## Verification

- Dedicated Supabase project: ACTIVE_HEALTHY
- RLS: enabled across all Mission 365 public tables
- Private storage bucket: created
- Stripe live webhook endpoint: enabled
- Supabase Stripe webhook function: ACTIVE
- Supabase Checkout function: ACTIVE
- Supabase payout-release function: ACTIVE
- Production dependency audit: passed, 0 production vulnerabilities
- Next.js: 16.3.0
- TypeScript validation: passed
- Next.js optimized production build: passed
- Production web target: `https://mission-365.vercel.app`
