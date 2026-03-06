# Union Raid Cloud Sync Safety Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent Union Raid planning refresh/login flows from uploading truncated local data, while safely incorporating remote changes made by other users.

**Architecture:** Extract the cloud-sync decision logic into a small pure module that compares local and remote plan snapshots, detects suspicious shrinkage, and decides whether to pull, merge, upload, or block. Keep the React component responsible for orchestration only: load remote plans, track the last synced snapshot, and re-fetch before upload to avoid overwriting concurrent edits.

**Tech Stack:** React 19, TypeScript, Vite, Node built-in test runner

---

### Task 1: Add failing tests for sync safety decisions

**Files:**
- Create: `D:\cloud\Eixa\ExiaAnalysis\tests\union-raid-sync.test.mjs`
- Test: `D:\cloud\Eixa\ExiaAnalysis\tests\union-raid-sync.test.mjs`

**Step 1: Write the failing test**

Add tests that cover:
- initial refresh with partial local planning must prefer remote data and skip upload
- upload attempt must merge in newer remote edits made after last sync
- suspicious local shrinkage must be blocked from upload

**Step 2: Run test to verify it fails**

Run: `node --test tests/union-raid-sync.test.mjs`
Expected: FAIL because the sync helpers do not exist yet.

**Step 3: Write minimal implementation**

Create a pure helper module for snapshot normalization, remote-vs-local comparison, safe merge, and upload blocking.

**Step 4: Run test to verify it passes**

Run: `node --test tests/union-raid-sync.test.mjs`
Expected: PASS

### Task 2: Integrate the safety logic into Union Raid cloud sync

**Files:**
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\components\UnionRaidStats.tsx`
- Create: `D:\cloud\Eixa\ExiaAnalysis\src\components\UnionRaid\cloudSync.ts`

**Step 1: Write the failing test**

Extend the pure helper tests to encode the exact component decisions needed by the UI orchestration.

**Step 2: Run test to verify it fails**

Run: `node --test tests/union-raid-sync.test.mjs`
Expected: FAIL on the newly added case.

**Step 3: Write minimal implementation**

Update the component to:
- normalize cloud data when loading
- record the last remote snapshot that was safely applied
- avoid marking freshly loaded remote data as a local edit
- re-fetch remote data before upload
- merge newer remote changes when possible
- skip upload and notify on suspicious shrinkage/conflicts

**Step 4: Run test to verify it passes**

Run: `node --test tests/union-raid-sync.test.mjs`
Expected: PASS

### Task 3: Verify no regressions in existing lightweight tests

**Files:**
- Test: `D:\cloud\Eixa\ExiaAnalysis\tests\team-templates.test.mjs`
- Test: `D:\cloud\Eixa\ExiaAnalysis\tests\union-raid-sync.test.mjs`

**Step 1: Run the targeted test suite**

Run: `node --test tests/team-templates.test.mjs tests/union-raid-sync.test.mjs`
Expected: all PASS

**Step 2: Build the app**

Run: `npm run build`
Expected: build succeeds without TypeScript or bundling errors
