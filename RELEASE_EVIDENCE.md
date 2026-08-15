# MISSION 365 release evidence

Updated: 2026-08-15

## Product boundary

- MISSION 365 remains its own brand, repository, application, Supabase project, payment ledger, and runtime boundary.
- Production backend: dedicated `MISSION 365` Supabase project `rwpcqeiukrektpjqkpdx` in `us-east-1`.
- Web: Next.js on Vercel project `prj_Tuq5y7kTRpAxgyvgfrT0jEQuqeOK`.
- Canonical web target: `https://mission-365.vercel.app`.
- Repository: `dolodorsey/mission-365` on branch `main`.
- Production deployment is owned by the Vercel Git integration. Pushes to `main` are built and promoted by Vercel, and the release workflow verifies that `/api/health` reports the exact pushed commit.

## Current production state

- Production web is healthy and serving from the Git-linked Vercel project.
- `/api/health` reads the dedicated Supabase launch-status endpoint instead of returning a static success response.
- Production runtime coverage includes applications/RLS, verification, checkout, Stripe webhook reconciliation, Connect, payouts, refunds, registry/vendor settlement, risk, and notifications.
- Current launch cohort: 5 organizations under review.
- Current mission queue: 4 missions under review.
- Current legitimate public activity remains 0 published missions, 0 donations, and 0 receipts.
- Current launch cohort has 0 verification documents, 0 accepted verification documents, 0 transfer-ready recipient accounts, and 0 mission milestones.
- No fake verification, milestones, donations, receipts, or public impact records should be inserted to manufacture launch readiness.

## Authentication and authorization

- Private user/admin/finance Edge Functions require Supabase platform JWT verification and also retain their existing in-function authorization checks.
- Authorization decisions use server-controlled memberships, reviewer records, or `app_metadata`; user-editable metadata is not used for authorization.
- The Stripe webhook remains intentionally public at the Supabase gateway because Stripe does not send Supabase user JWTs; the function verifies Stripe's signature before processing an event.
- The launch-status endpoint remains intentionally public and returns readiness/count data only.
- Financial donation detail in the protected admin queue is limited to `admin` and `finance` roles; ordinary reviewers retain verification access without donor/payment detail.

## Payment and settlement integrity

- Stripe Checkout supports authenticated one-time and monthly giving, personal/business donor identity, donor terms acceptance, mission verification/publish checks, payout-readiness checks, high/critical risk holds, server-side rate limiting, and idempotency.
- Stripe webhook reconciliation handles Checkout completion/failure/expiry, invoices and subscriptions, PaymentIntent failures, refunds, disputes, transfer events, receipts, and notification records.
- Business sponsorship checkout writes `donor_business` identity consistently across user roles, giving plans, donations, and Stripe metadata.
- Financial reconciliation triggers use cumulative net funded value and safely handle donation mission reassignment and sponsorship reassignment.
- `vendor_direct` registry gifts count toward mission/registry funded impact but are excluded from the Mission Owner payout pool. This prevents the same net funds from being paid once to a vendor and again to a Mission Owner.
- Protected refund operations are restricted to `admin`/`finance` users.
- Vendor-direct refunds request both `reverse_transfer=true` and `refund_application_fee=true` from Stripe so the connected-vendor transfer and platform application fee are reversed proportionally with the refund.
- Mission-payout refunds are blocked if the post-refund cleared proceeds would undercollateralize Mission Owner payouts already requested, approved, processing, or paid.
- Refund requests are idempotent and auditable; final donation/refund state remains reconciled from Stripe webhook events.

## Stripe / Connect readiness

- Platform Stripe account has card payments, transfers, and payouts enabled.
- Canonical live Mission 365 Stripe webhook is enabled and points to the dedicated Supabase webhook function.
- Stripe webhook secret is installed in the protected Mission 365 runtime.
- The restricted Mission 365 Stripe API key is **not yet installed** in the Supabase Edge environment/runtime vault, so production correctly reports `stripeApi: false` and `liveGiving: false`.
- There are currently 0 connected recipient accounts.
- Mission Owner and registry-vendor recipient onboarding use Stripe Connect recipient/Express account flows and remain gated behind verified organizations plus the restricted Stripe credential.

## Verification and publication gates

An organization cannot be approved without the required accepted verification documents. A mission cannot be published until its organization is verified, the payout destination is transfer-ready, at least one measurable milestone exists, and no open high/critical risk event blocks release.

Current real launch work therefore remains:

1. Upload legitimate verification evidence for a launch organization.
2. Review and accept the required evidence; then approve the organization.
3. Install the restricted Mission 365 live Stripe API key in the protected Supabase runtime.
4. Complete the organization's Stripe recipient onboarding and confirm transfers are active.
5. Add at least one legitimate measurable milestone to the first mission.
6. Review and publish the first legitimate mission.
7. Run controlled real payment QA: one-time gift, recurring gift, receipt, refund, vendor-direct reversal where applicable, payout approval/release/reversal.

## Security and operations

- RLS is enabled across exposed application tables.
- Supabase security advisor currently reports INFO-only `RLS enabled/no policy` notices on intentionally server-only deny-by-default tables; no new critical security lint was introduced by the latest financial hardening.
- Private evidence remains in `mission365-private`; reviewer document access uses short-lived signed URLs.
- Browser security headers include HSTS, clickjacking protection, MIME sniffing protection, referrer policy, permissions policy, and COOP.
- Checkout and registry checkout have server-side rate limits.
- Risk controls cover duplicate organization identity, donation velocity/large gifts, payout requirements, disputes, and high-severity release holds.
- In-app notifications work without third-party provider credentials. Resend/Twilio credentials remain optional gates for outbound email/SMS delivery.

## Source control and release automation

- Production application code and critical Supabase Edge runtimes are source-controlled in this repository, including checkout, webhook, Connect, owner/donor/business dashboards, admin review, payout release, refund control, risk, notification dispatch, registry, entry, and profile-management functions.
- The financial reconciliation hardening is preserved as Supabase migration `20260815111722_mission365_financial_reconciliation_hardening.sql`.
- Disabled QA/probe Edge Functions may remain deployed as non-operational stubs, but they are not part of the live application path.
- `main` runs dependency audit, lint, TypeScript validation, tests, optimized build, route verification, and production commit verification.
- Vercel Git deployment is operational; the prior manual-deployment/Git-integration blocker is closed.

## Native/mobile state

- Native shell targets the live HTTPS production application.
- Public download links remain disabled until signed distribution is real.
- Remaining mobile gates are iOS signing/provisioning and TestFlight/App Store review; Android signing and Play Console release; push/deep-link verification on signed builds.

## Legal / policy gate

The policy hub is an operating draft. Broad public fundraising should still receive legal/tax review, especially around tax deductibility/receipt language, fundraising obligations, privacy, refunds, platform fees, and marketplace/payment obligations.

## Definition of web launch-ready

MISSION 365 web should only be treated as live-giving ready when all of the following are true at the same time:

- restricted Stripe API credential present;
- Stripe webhook signing ready;
- at least one legitimate organization verified;
- that organization's recipient account transfer-ready;
- at least one mission has a measurable milestone and is approved/published;
- controlled real one-time and recurring payment tests pass through webhook, ledger, receipt, refund, and payout controls;
- no open high/critical risk hold blocks the launch mission.

Until then, the current verification-first prelaunch state is intentional and correct.
