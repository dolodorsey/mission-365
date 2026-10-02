# Read-only CRM preflight

This promotes the existing September 21 local preflight into the Mission365 repository and adds validation for the pending role-state migration's DELETE and TRANSFER payloads. It is not a deployed consumer and cannot write to GHL or consume outbox events.

Run `node scripts/crm/preflight.mjs snapshot.json result.json`. The input must contain the exact Mission365 project ID, an observation timestamp no older than five minutes, and pending outbox events joined to current account-scoped links, roles and applications. Never treat a supplied snapshot as authenticated or authoritative merely because it passes this checker. A future trusted adapter must load these records itself and recheck before any write.

Role events are reconciliation notifications. Normal events carry a nonempty role and status. DELETE carries null status and previous_status. TRANSFER has separate account-scoped `out` (null status) and `in` (current event status) events, each with previous_status. Unknown operations or malformed variants are held. The checker does not require both transfer halves in a batch: they can arrive separately and each reconciles only its own account. Current roles govern stage; event status does not. No deletion of a CRM contact or marketing enrollment is implied.

Historical events may disagree with current roles. Applications independently determine classification; account-only events remain account-only. Mission-owner routing is only a historical candidate requiring fresh verification. External consumer ownership, enrollment effects and person classification remain blocking in every result. Passing structural checks is not release approval.

Tests:

- `node --test scripts/crm/preflight.test.mjs`
- `python3 tests/mission365-crm-preflight-contract.py` (disposable socket-only PostgreSQL; defaults to Homebrew PostgreSQL 17, supports PG_TEST_BIN)

The integration fixture uses the actual pending SQL producer and current snapshot joins, but a minimal schema and no production data. It proves compatibility with this preflight only; compatibility with an unidentified external CRM consumer remains unverified.
