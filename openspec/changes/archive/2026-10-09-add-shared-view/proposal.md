# Proposal

## Why

Two people book NLB library seats and discussion rooms under separate myLibrary accounts. They cannot
easily see each other's bookings, so they duplicate rooms and seats for the same time slot.
NLB has no sharing feature and no public API. The users rejected storing NLB passwords or tokens on
a server (NLB ToS §6).

## What Changes

- **Push from the NLB page.** A bookmarklet, plus an optional userscript, runs on the logged-in NLB
  "My Bookings" page.
  - It reads the user's own bookings through NLB's same-origin API, keeping booking fields only.
  - It pushes them to our Worker: a form POST for the bookmarklet, `GM_xmlhttpRequest` for the userscript.
- **Board.** A Cloudflare Worker plus one Durable Object stores the latest snapshot per person.
  - It never contacts NLB and stores no NLB credentials.
- **Shared view.** A page on a secret URL shows Today and Tomorrow for both people:
  - a two-lane timeline, with rooms spanning both lanes;
  - a detail list;
  - overlap badges;
  - "pushed X min ago", and an "unverified" badge after a check-in deadline passes without a newer push.
  - It updates live while visible.
- **Setup and deployment.**
  - A setup page generates each person's bookmarklet and userscript for this deployment.
  - An `init-secrets` script generates per-deployment secrets.
  - The repo stays safe to publish publicly.
  - Search-engine and Referer leak protections apply.

## Capabilities

### New Capabilities
- `booking-push`: how a person's bookings get from the NLB page to the board, and what is accepted or rejected.
- `shared-view`: what both people see on the secret-URL page and how it stays current.
- `deployment-privacy`: per-deployment secrets, setup page, and non-discoverability guarantees.

### Modified Capabilities
(none, greenfield)

## Impact

- **New code:**
  - `shared/` (domain lib)
  - `worker/` (Worker + Durable Object)
  - `web/` (viewer)
  - `push/` (bookmarklet + userscript)
  - `scripts/init-secrets.mjs`
- **New dependencies (dev):** wrangler, typescript, vitest, @cloudflare/vitest-pool-workers, esbuild.
- **Hosting:** the deployer's own Cloudflare account, free plan.
- **No external systems are called by the server.**
