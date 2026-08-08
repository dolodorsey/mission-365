# MISSION 365 release evidence

Updated: 2026-08-08

## Product boundary

- MISSION 365 remains its own brand, repository, application, Supabase project, payment ledger, and runtime boundary.
- Production backend: dedicated `MISSION 365` Supabase project in `us-east-1`.
- Web: Next.js on Vercel. Protected verification, payment, Connect, risk, notification, and payout operations: dedicated Supabase Edge Runtime.
- Payment architecture: Stripe Checkout + Billing + Connect, Separate Charges and Transfers, 5% Mission 365 platform fee modeled by transferring less to verified recipients.

## Completed product and backend

- Donor, Mission Owner, Business, and Admin operating workspaces are production-backed rather than static placeholder dashboards.
- Mission-owner workflow: application → organization verification → private evidence → Stripe recipient onboarding → agreement → mission → milestones → review → publication → impact evidence → payout request.
- Admin workflow: expiring private-evidence links, document accept/reject, organization verification, mission moderation, milestone/impact verification, payout approval/release/reversal, risk escalation/resolution, notification dispatch.
- Donor workflow: one-time/monthly giving, net-after-refund ledger, receipts, saved missions, verified impact timeline, notification preferences/inbox, CSV export, Stripe Customer Portal for recurring-plan/payment-method management.
- Business workflow: verification handoff, sponsor terms, sponsorship commitments, employee/matched-giving settings, secure sponsorship funding, cancellation, reconciliation, impact export.
- Public mission page: verified organization, funding totals, milestones, published impact, save/follow action, explicit donor/tax language.
- Legal/policy hub: platform terms, privacy, donor/refund, Mission Owner, business sponsor, acceptable-use/fraud, tax/receipt language. Marked as operating draft requiring counsel review before broad scale.

## Financial integrity and Stripe lifecycle

- Checkout requires authenticated user, current donor terms, published mission, verified mission owner, transfer-ready payout account, no high/critical risk hold, and per-user rate limit.
- Checkout stores donor/mission/giving-plan/donation metadata and supports one-time + monthly giving.
- Recurring Checkout preserves/reuses Stripe customer identifiers when available.
- Webhook reconciliation handles Checkout completed/async success/async failure/expiry, recurring invoices, failed/action-required invoices, subscription update/cancel, PaymentIntent failures, refunds, disputes, and transfer reversals/updates.
- Partial refunds reduce both Mission 365 mission funding and business sponsorship funded totals by the actual refunded delta.
- Payouts use approve → release → reverse controls with cleared-proceeds calculation, risk holds, transfer-readiness refresh, idempotent Stripe transfers, and transfer reversals.
- Stripe Accounts v2 recipient service supports account creation, status refresh, hosted onboarding links, embedded Account Sessions, and Express Dashboard links once the Mission 365 restricted key is installed.
- Canonical live Stripe webhook endpoint remains enabled on `2026-06-24.dahlia` with the expanded production event set.

## Security and operations

- Private evidence stays in `mission365-private`; reviewer access uses short-lived signed URLs.
- Authorization decisions use server-side membership/reviewer records or Supabase app metadata, not user-editable metadata.
- RLS remains enabled; intentionally internal tables are deny-by-default to ordinary clients.
- Checkout has server-side rate limiting.
- Browser security headers include HSTS, clickjacking protection, MIME sniffing protection, referrer policy, permissions policy, and COOP.
- Private account/workspace routes are excluded from robots indexing; sitemap includes public Mission 365 pages and published mission URLs.
- Global route recovery warns users not to infer financial success/failure from a UI error.
- `/api/health` reports live/degraded backend readiness rather than a static success response.
- Notification records automatically queue in-app/email/SMS delivery according to user preference. Provider dispatcher is ready for Resend/Twilio credentials.
- Risk scan covers duplicate organization identity, donation velocity/large gifts, and payout requirements due.

## QA evidence

- Production dependency audit: passed at high severity threshold.
- TypeScript validation: passed.
- Next.js optimized production build: passed.
- Launch accounting QA passed with disposable records removed:
  - $100 succeeded → mission + sponsorship funded $100.
  - $25 partial refund → mission + sponsorship net funded $75.
  - full refund → mission + sponsorship net funded $0.
- Current production database intentionally remains free of fake public activity: 0 published missions, 0 donations, 0 receipts, 0 sponsorships.
- Current real launch cohort remains 2 organizations `under_review`; no organization is falsely marked verified.
- Supabase security advisor currently reports INFO-only no-policy notices on intentionally server-only tables; no critical security lint is being ignored.

## Native/mobile state

- Capacitor no longer assumes the obsolete Next static `out/` directory.
- Native shell targets the live `https://mission-365.vercel.app` application with HTTPS-only navigation.
- No fake TestFlight or Android download is published.
- Store signing, Apple/Google distribution credentials, final native release verification, and push-notification provisioning remain account-owner release gates.

## Release automation

- `main` runs a production-release workflow that performs install, production dependency audit, TypeScript, and optimized build.
- The Vercel CLI deployment step is conditional and currently skips because repository secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` have not been installed.
- The legacy Vercel Git integration is still not creating deployments from merges.
- Until one of those deployment paths is repaired, production web promotion requires an authenticated Vercel deployment action.

## Real launch gates that must not be bypassed

1. Create a dedicated Mission 365 Stripe restricted live key in Stripe Dashboard and install it as the Supabase Edge secret `STRIPE_SECRET_KEY`. Do not use or expose a broad platform secret in application code.
2. Complete a controlled real Checkout → webhook → ledger → receipt → refund test, then a monthly recurring test.
3. Complete at least one real verified organization package; current Sole Exchange and Playmakers records have no uploaded evidence yet.
4. Create/complete that verified organization's Stripe recipient onboarding and confirm transfers are active.
5. Publish the first legitimate mission only after verification, payout readiness, milestones, reviewer approval, and no risk hold.
6. Activate the authorized Mission 365 admin user by completing normal Supabase email authentication for the pre-authorized reviewer email.
7. Add email/SMS provider credentials if outbound Resend/Twilio delivery is desired; in-app notifications work without them.
8. Install GitHub Vercel release secrets or repair the Vercel Git integration for permanent automatic deployment.
9. Complete Apple/Google signing and store distribution before mobile download links are exposed.
10. Obtain legal/tax counsel review before broad public scale, especially tax-deductibility, fundraising, privacy, refund, fee, and marketplace/payment obligations.

## Production identifiers

- Supabase project: `rwpcqeiukrektpjqkpdx`
- Vercel project: `prj_Tuq5y7kTRpAxgyvgfrT0jEQuqeOK`
- Canonical web target: `https://mission-365.vercel.app`
- GitHub repository: `dolodorsey/mission-365`
- Launch-completion main commit: `0dceb067c9caa72202b8b6cd060200d2137436f2`
