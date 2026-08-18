# MISSION 365 release evidence

Updated: 2026-08-18

## Product boundary

- MISSION 365 remains its own brand, repository, application, Supabase project, payment ledger, and runtime boundary.
- Production backend: dedicated `MISSION 365` Supabase project `rwpcqeiukrektpjqkpdx` in `us-east-1`.
- Web: Next.js on Vercel project `prj_Tuq5y7kTRpAxgyvgfrT0jEQuqeOK`.
- Canonical web target: `https://mission-365.vercel.app`.
- Repository: `dolodorsey/mission-365` on branch `main`.
- Production deployment is owned by the Vercel Git integration. Pushes to `main` are built and promoted by Vercel, and the production release workflow verifies that `/api/health` reports the exact pushed commit.

## Current production state

- Production web is healthy and serving from the Git-linked Vercel project.
- `/api/health` reads the dedicated Supabase launch-status endpoint instead of returning a static success response.
- Production runtime coverage includes applications/RLS, verification, checkout, Stripe webhook reconciliation, Connect, payouts, refunds, registry/vendor settlement, risk, notifications, role entry, volunteer participation, and mission-profile management.
- Current launch cohort: 5 organizations in verification.
- Current mission queue: 4 missions under review.
- Current legitimate fundraising activity remains 0 published fundraising missions, 0 donations, and 0 receipts.
- Current launch cohort has 0 accepted verification documents, 0 transfer-ready recipient accounts, and 0 mission milestones.
- No fake verification, milestones, donations, receipts, or public impact records should be inserted to manufacture launch readiness.

## Application surface

- Production route verification covers all 20 currently shipped routes, not only the original public landing surface.
- Public/product routes include `/`, `/missions`, `/missions/[slug]`, `/apply`, `/join`, `/login`, `/legal`, and `/download`.
- Authenticated application routes include `/app`, personal donor, business donor, Mission Owner, Mission Owner profile manager, Mission Owner registry, admin, vendor, and volunteer workspaces.
- `/api/health`, `/robots.txt`, and `/sitemap.xml` are part of the release contract.
- The homepage reads live launch health instead of hard-coding public giving totals or launch readiness.

## Authentication and authorization

- Private user/admin/finance Edge Functions require Supabase platform JWT verification and also retain their in-function authorization checks.
- Authorization decisions use server-controlled memberships, reviewer records, or `app_metadata`; user-editable metadata is not used for authorization.
- The Stripe webhook remains intentionally public at the Supabase gateway because Stripe does not send Supabase user JWTs; the function verifies Stripe's signature before processing an event.
- The launch-status endpoint remains intentionally public and returns readiness/count data only.
- Financial donation detail in the protected admin queue is limited to `admin` and `finance` roles; ordinary reviewers retain verification access without donor/payment detail.

## Volunteer publication hardening

- Public volunteer discovery is restricted to opportunities whose parent Mission 365 profile is explicitly public and published.
- Authenticated volunteer signup inserts are restricted to the signed-in user, an open opportunity, and a public/published parent mission profile.
- Volunteer signup read/update/delete access remains owner-scoped.
- The `mission365-entry` Edge Function independently enforces the same public/published parent-profile gate before registration, so direct API use cannot bypass the database policy.

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
- Stripe webhook signing and the restricted Mission 365 Stripe API credential are present in the protected runtime.
- Current production health reports `stripeApi: true`, `webhook: true`, and `liveGiving: true` for the payment rail itself.
- Payment-rail readiness does **not** bypass mission publication gates. There are currently 0 published fundraising missions and 0 transfer-ready recipient accounts, so real public giving remains closed at the mission level.
- Mission Owner and registry-vendor recipient onboarding use Stripe Connect recipient/Express account flows and remain gated behind verified organizations and transfer-ready connected accounts.

## Verification and publication gates

An organization cannot be approved without the required accepted verification documents. A fundraising mission cannot be published until its organization is verified, the payout destination is transfer-ready, at least one measurable milestone exists, and no open high/critical risk event blocks release.

Current real launch work therefore remains:

1. Upload legitimate verification evidence for a launch organization.
2. Review and accept the required evidence; then approve the organization.
3. Complete the organization's Stripe recipient onboarding and confirm transfers are active.
4. Add at least one legitimate measurable milestone to the first mission.
5. Review and publish the first legitimate fundraising mission.
6. Run controlled real payment QA against the published mission: one-time gift, recurring gift, receipt, refund, vendor-direct reversal where applicable, payout approval/release/reversal.

## Security and operations

- RLS is enabled across exposed application tables.
- Supabase security advisor reports INFO-only `RLS enabled/no policy` notices on intentionally server-only deny-by-default tables; no critical security lint is currently identified by the advisor.
- Private evidence remains in `mission365-private`; reviewer document access uses short-lived signed URLs.
- Browser security headers include HSTS, clickjacking protection, MIME sniffing protection, referrer policy, permissions policy, and COOP.
- Checkout and registry checkout have server-side rate limits.
- Risk controls cover duplicate organization identity, donation velocity/large gifts, payout requirements, disputes, and high-severity release holds.
- In-app notifications work without third-party provider credentials. Resend/Twilio credentials remain optional gates for outbound email/SMS delivery.
- Production dependency audit is clean at the configured high-severity release gate; the transitive `nanoid` override is pinned to the patched release.

## Source control and web release automation

- Production application code and critical Mission 365 Supabase Edge runtimes are source-controlled in this repository, including checkout, webhook, Connect, owner/donor/business dashboards, admin review, payout release, refund control, risk, notification dispatch, registry, entry, and profile-management functions.
- Financial reconciliation hardening is preserved as Supabase migration `20260815111722_mission365_financial_reconciliation_hardening.sql`.
- Volunteer publication hardening is preserved as `20260818143500_mission365_volunteer_publication_gate.sql`.
- `main` runs dependency audit, lint, TypeScript validation, tests, optimized build, 20-route verification, and production commit verification.
- Vercel Git deployment is operational; the prior manual-deployment/Git-integration blocker is closed.

## Native / TestFlight automation

- Native shell targets the live HTTPS production application with bundle ID `com.mission365.app`.
- The native status bar is configured for light foreground content against the dark Mission 365 shell.
- The repository now contains a repeatable iOS regeneration script. It recreates the Capacitor Xcode project on a GitHub-hosted macOS runner, restores Fastlane, enforces iOS 15.0+, syncs Capacitor, and rebuilds the AppIcon catalog from Mission 365 brand artwork rather than relying on an untracked local Xcode project.
- `.github/workflows/ios-testflight.yml` performs a full product quality gate, retrieves Apple signing material through a dedicated GitHub OIDC broker, imports the distribution identity into a temporary keychain, installs the App Store provisioning profile, builds with manual signing, and uploads through Fastlane.
- The dedicated broker is source-controlled in `dolodorsey/DR-MCP` and deployed as `github-mission365-apple-release-credentials` in the secured MCP Gateway Supabase runtime. It accepts only the Mission 365 repository, the exact Mission 365 TestFlight workflow on `main`, GitHub-hosted runners, and bundle ID `com.mission365.app`.
- No App Store Connect private key, distribution private key, certificate password, or provisioning-profile secret is stored in the Mission 365 repository.
- The first automated main-branch TestFlight run remains the proof gate for current Apple provisioning/profile acceptance. A successful run is required before signed iOS distribution is treated as complete.
- Android signing/Play Console release and push/deep-link verification on signed builds remain separate mobile release gates.

## Legal / policy gate

The policy hub is an operating draft. Broad public fundraising should receive legal/tax review, especially around tax deductibility/receipt language, fundraising obligations, privacy, refunds, platform fees, and marketplace/payment obligations.

## Definition of web live-giving readiness

MISSION 365 web should only be treated as live-giving ready when all of the following are true at the same time:

- restricted Stripe API credential present;
- Stripe webhook signing ready;
- at least one legitimate organization verified;
- that organization's recipient account transfer-ready;
- at least one mission has a measurable milestone and is approved/published;
- controlled real one-time and recurring payment tests pass through webhook, ledger, receipt, refund, and payout controls;
- no open high/critical risk hold blocks the launch mission.

The payment rail is ready, but the real-world verification and mission-publication gates are not yet complete. The current verification-first prelaunch state is therefore intentional.
