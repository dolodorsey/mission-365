# MISSION 365 — Fundraising Database Checkpoint

**Saved:** September 30, 2026
**Status:** Phase 1 complete
**Supabase:** rwpcqeiukrektpjqkpdx
**Repository:** dolodorsey/mission-365

## Current database state

MISSION 365 now has a private fundraising sourcing layer that is intentionally separate from verified organizations.

Tables:
- private.mission365_fundraising_organizers
- private.mission365_fundraising_initiatives
- private.mission365_fundraising_sources

Current counts:
- 41 organizers
- 50 fundraising initiatives
- 50 evidence/source records
- 31 Tier A organizers
- 47 Tier A initiatives
- 8 currently active initiatives
- 45 initiatives within the next 90 days
- 46 initiatives backed by official sources
- 42 sponsor-ready opportunities
- 49 volunteer-ready opportunities
- 50 donation-ready opportunities
- 50 recurring/annual initiatives

## Core rule

Sourced prospect != verified Mission 365 organization.

Flow:
SOURCE -> SCORE -> QUALIFY -> CONTACT -> APPLICATION -> DOCUMENTS -> VERIFICATION -> APPROVED ORGANIZATION -> MISSION -> FUNDRAISING -> IMPACT PROOF -> RENEWAL

Jojo owns mission-owner acquisition and organizer progression.
Q owns sponsor / CSR / business-partner progression.

## Top current acquisition cohort

1. Building Family Unity
2. Lift Up Atlanta
3. Ready Set Dream Big Community Outreach
4. Faith in Fatherhood
5. Moving in the Spirit
6. Furnish with Love
7. Decatur Education Foundation
8. North Atlanta Church of Christ
9. Santa's Toy Run
10. Reaching Clarity Foundation
11. Atlanta Toys for Tots
12. Empty Stocking Fund

## Next execution phase

1. Expand Atlanta from 41 organizers to 250+.
2. Prioritize churches, schools/PTAs, youth sports, fraternities/sororities, foundations, neighborhood groups, booster clubs, veteran groups, professional associations and grassroots nonprofits.
3. Enrich Tier A targets with decision-maker name/title, public email, phone, Instagram, LinkedIn, preferred channel, current fundraiser, deadline and exact Mission 365 fit reason.
4. Build the outreach queue while keeping NOT_CONTACTED separate from QUEUED.
5. Route accepted prospects into Mission Owner onboarding instead of manually treating prospects as verified organizations.
6. Address existing Supabase security warnings in a separate hardening lane.

## Source-control reference

Migration:
supabase/migrations/20260930105532_mission365_fundraising_sourcing_layer.sql

Migration commit:
81e6720ea7331255ca19a59baec03489f9a071de

## Resume instruction

When this work resumes, start from this checkpoint and continue Phase 2. Do not restart the database or re-source the Phase 1 cohort from scratch.
