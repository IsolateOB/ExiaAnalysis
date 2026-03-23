# Account List Raid Plan Workbook Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an account-list export button that writes an Excel workbook with a human-readable union raid planning sheet, and extend account-list upload so the same workbook can re-import planning by IDs.

**Architecture:** Keep workbook parsing and sheet generation in a dedicated utility so `App.tsx` stays thin and testable. `App.tsx` will own file import/export, while `UnionRaidStats.tsx` will expose the current visible planning snapshot upward for export and accept parsed planning entries downward for import, persisting them through the existing local or realtime planning flows.

**Tech Stack:** React, TypeScript, MUI, `xlsx`, Node test runner, existing union raid planning helpers.

---

### Task 1: Add workbook tests for export/import format

**Files:**
- Create: `D:\cloud\Eixa\ExiaAnalysis\tests\account-list-workbook.test.mjs`
- Test: `D:\cloud\Eixa\ExiaAnalysis\src\utils\accountListWorkbook.ts`

**Step 1: Write the failing test**

Cover:
- exporting two sheets named `Accounts` and `UnionRaidPlans`
- writing account names plus localized character names
- parsing the planning sheet back into `game_uid + plans`

**Step 2: Run test to verify it fails**

Run: `fnm use 24; node --test tests/account-list-workbook.test.mjs`
Expected: FAIL because the workbook utility does not exist yet.

**Step 3: Write minimal implementation**

Create a workbook utility that:
- builds `Accounts` and `UnionRaidPlans` sheet rows
- exports current plan rows with `plan_name`, `step`, `predicted_damage`, `character_ids`, `character_names`
- parses imported planning rows using IDs only

**Step 4: Run test to verify it passes**

Run: `fnm use 24; node --test tests/account-list-workbook.test.mjs`
Expected: PASS

### Task 2: Add integration tests for App and UnionRaidStats wiring

**Files:**
- Create: `D:\cloud\Eixa\ExiaAnalysis\tests\account-list-raid-plan-integration.test.mjs`
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\App.tsx`
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\components\UnionRaidStats.tsx`

**Step 1: Write the failing test**

Cover:
- App renders a dedicated export button next to upload
- App passes workbook planning import/export props to `UnionRaidStats`
- `UnionRaidStats` accepts imported planning events and export snapshot callbacks

**Step 2: Run test to verify it fails**

Run: `fnm use 24; node --test tests/account-list-raid-plan-integration.test.mjs`
Expected: FAIL because the props and handler wiring are missing.

**Step 3: Write minimal implementation**

Implement:
- export button and handler in `App.tsx`
- optional planning import/export props in `UnionRaidStats.tsx`
- event-based planning import processing and upward snapshot reporting

**Step 4: Run test to verify it passes**

Run: `fnm use 24; node --test tests/account-list-raid-plan-integration.test.mjs`
Expected: PASS

### Task 3: Hook upload/export UI to the workbook utility

**Files:**
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\App.tsx`
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\translations.ts`
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\components\UnionRaidStats.tsx`
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\components\UnionRaid\useUnionRaidPlanning.ts`

**Step 1: Write the failing test**

Extend the workbook and integration tests so they expect:
- upload to parse `UnionRaidPlans`
- import to emit planning notifications
- export button to use translation keys

**Step 2: Run test to verify it fails**

Run: `fnm use 24; node --test tests/account-list-workbook.test.mjs tests/account-list-raid-plan-integration.test.mjs`
Expected: FAIL until upload/export wiring is complete.

**Step 3: Write minimal implementation**

Implement:
- upload parsing of optional planning rows
- current-plan export from `UnionRaidStats`
- import path that updates local planning or queues realtime patches
- new translation keys for button text and import/export status

**Step 4: Run test to verify it passes**

Run: `fnm use 24; node --test tests/account-list-workbook.test.mjs tests/account-list-raid-plan-integration.test.mjs`
Expected: PASS

### Task 4: Full verification

**Files:**
- Verify only

**Step 1: Run targeted tests**

Run: `fnm use 24; node --test tests/account-list-workbook.test.mjs tests/account-list-raid-plan-integration.test.mjs`

**Step 2: Run full test suite**

Run: `fnm use 24; node --test tests/*.mjs`

**Step 3: Run lint**

Run: `fnm use 24; npm run lint`

**Step 4: Run build**

Run: `fnm use 24; npm run build`

**Step 5: Commit**

Only if the user asks for a commit or push.
