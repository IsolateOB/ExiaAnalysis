# Union Raid Realtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Union Raid full-document polling sync with a pure realtime collaboration flow using Durable Objects, revisioned WebSocket patches, and backend event logging.

**Architecture:** The frontend connects directly to a realtime channel, sends `hello`, and receives either a `snapshot` or replayed patches. Durable Objects serialize per-document patch application and broadcast, while D1 stores the current snapshot plus a recent patch window for reconnect recovery.

**Tech Stack:** React 19, TypeScript, Vite, Rust, Cloudflare Workers, D1, Node built-in test runner

---

### Task 1: Add backend schema for revisioned realtime sync

**Files:**
- Create: `D:\cloud\Eixa\ExiaBackend\migrations\003_raid_plan_realtime.sql`
- Modify: `D:\cloud\Eixa\ExiaBackend\migrations\001_init.sql`

**Step 1: Write the failing test**

Document a manual verification query set for the new tables:
- raid document revision storage
- raid patch event log
- indexes for `(user_id, revision)`

**Step 2: Run test to verify it fails**

Run the migration locally against the existing D1 setup.
Expected: FAIL because the new schema does not exist yet.

**Step 3: Write minimal implementation**

Add:
- document-level revision storage
- patch event log table
- indexes for replay lookups

**Step 4: Run test to verify it passes**

Run the migration again and verify the tables/indexes exist.

### Task 2: Add backend data structures and patch application helpers

**Files:**
- Modify: `D:\cloud\Eixa\ExiaBackend\src\models\requests.rs`
- Modify: `D:\cloud\Eixa\ExiaBackend\src\models\mod.rs`
- Modify: `D:\cloud\Eixa\ExiaBackend\src\handlers\raid.rs`
- Create: `D:\cloud\Eixa\ExiaBackend\src\handlers\raid_realtime.rs`

**Step 1: Write the failing test**

Add or scaffold handler-level test cases for:
- `slot.updateField` patch application
- field-level merge behavior
- conflicting same-field writes ordered by revision

**Step 2: Run test to verify it fails**

Run the backend test target.
Expected: FAIL because the patch request types and helpers do not exist yet.

**Step 3: Write minimal implementation**

Add:
- request/response structs for hello, snapshot, patch, ack
- patch validation and normalization
- patch-to-D1 application helper
- revision increment helper

**Step 4: Run test to verify it passes**

Run the backend tests again.
Expected: PASS

### Task 3: Expose realtime backend realtime entrypoint

**Files:**
- Modify: `D:\cloud\Eixa\ExiaBackend\src\lib.rs`
- Modify: `D:\cloud\Eixa\ExiaBackend\src\handlers\mod.rs`
- Modify: `D:\cloud\Eixa\ExiaBackend\src\handlers\raid.rs`
- Create: `D:\cloud\Eixa\ExiaBackend\src\handlers\raid_realtime.rs`

**Step 1: Write the failing test**

Add a verification checklist covering:
- realtime endpoint accepts `hello`
- first connection returns `snapshot`
- patch returns `ack` with incremented revision
- reconnect can receive replay or `snapshot_required`

**Step 2: Run test to verify it fails**

Call the new realtime endpoint before implementation.
Expected: FAIL / route not found.

**Step 3: Write minimal implementation**

Add:
- Durable Object definition and binding
- realtime connection endpoint
- `hello` handling with `snapshot` response path
- replay / `snapshot_required` fallback response path

**Step 4: Run test to verify it passes**

Exercise the endpoint manually or with handler tests.
Expected: PASS

### Task 4: Add frontend realtime protocol helpers

**Files:**
- Create: `D:\cloud\Eixa\ExiaAnalysis\src\components\UnionRaid\cloudRealtime.ts`
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\components\UnionRaid\cloudSync.ts`
- Create: `D:\cloud\Eixa\ExiaAnalysis\tests\union-raid-realtime.test.mjs`

**Step 1: Write the failing test**

Add tests for:
- building `slot.updateField` patches
- applying `patch_broadcast` to local plans
- merging different-field updates in one slot
- preserving optimistic local state until ack

**Step 2: Run test to verify it fails**

Run: `node --test tests/union-raid-realtime.test.mjs`
Expected: FAIL because realtime helpers do not exist yet.

**Step 3: Write minimal implementation**

Create:
- websocket message types
- patch encoder/decoder
- local patch apply helper
- revision reconciliation helper

**Step 4: Run test to verify it passes**

Run the same test again.
Expected: PASS

### Task 5: Replace Union Raid polling sync with realtime frontend orchestration

**Files:**
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\components\UnionRaidStats.tsx`
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\components\UnionRaid\useUnionRaidPlanning.ts`
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\services\api.ts`

**Step 1: Write the failing test**

Extend `tests/union-raid-realtime.test.mjs` with flow tests for:
- initial `hello -> snapshot` load
- local optimistic edit
- ack confirmation
- remote patch broadcast applying without deleting local unrelated fields

**Step 2: Run test to verify it fails**

Run: `node --test tests/union-raid-realtime.test.mjs`
Expected: FAIL on the unimplemented orchestration flow.

**Step 3: Write minimal implementation**

Update the component to:
- open realtime connection immediately after auth
- load initial state from `snapshot`
- send field-level patches on edit
- remove the current “edit then full GET/POST” autosync loop
- reconcile revision and pending mutations from ack/broadcast

**Step 4: Run test to verify it passes**

Run the frontend realtime tests again.
Expected: PASS

### Task 6: Verify end-to-end behavior

**Files:**
- Test: `D:\cloud\Eixa\ExiaAnalysis\tests\team-templates.test.mjs`
- Test: `D:\cloud\Eixa\ExiaAnalysis\tests\union-raid-sync.test.mjs`
- Test: `D:\cloud\Eixa\ExiaAnalysis\tests\union-raid-realtime.test.mjs`
- Modify: `D:\cloud\Eixa\ExiaAnalysis\docs\plans\2026-03-07-union-raid-realtime-design.md`

**Step 1: Run the frontend targeted tests**

Run: `node --test tests/team-templates.test.mjs tests/union-raid-sync.test.mjs tests/union-raid-realtime.test.mjs`
Expected: all PASS

**Step 2: Build the frontend**

Run: `npm run build`
Expected: build succeeds

**Step 3: Verify backend behavior**

Run the backend checks for:
- initial realtime snapshot output
- patch apply
- reconnect replay or snapshot fallback

Expected: PASS
