# Team Template Local/Cloud Separation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove template conflict copies, separate cloud templates from local-only templates, and make offline-created templates stay local-only after login.

**Architecture:** TeamBuilder will treat cloud templates and local-only templates as separate lists with separate storage. Websocket snapshots will fully replace the cloud-template cache, while local-only templates remain untouched and are never auto-promoted to cloud or auto-deleted on login.

**Tech Stack:** React, TypeScript, localStorage, websocket realtime sync, node:test, ESLint, Vite

---

### Task 1: Add storage and reconciliation tests for local-only/cloud separation

**Files:**
- Modify: `D:/cloud/Eixa/ExiaAnalysis/tests/team-templates.test.mjs`
- Modify: `D:/cloud/Eixa/ExiaAnalysis/tests/team-builder-callbacks.test.mjs`
- Modify: `D:/cloud/Eixa/ExiaAnalysis/tests/team-template-realtime.test.mjs`

**Step 1: Write the failing tests**

- Add a test proving cloud snapshot replacement does not create conflict copies.
- Add a test proving local-only templates survive login snapshot replacement.
- Add a test proving TeamBuilder no longer references conflict-copy reconciliation.
- Add a test proving online deletes use cloud delete patches while local-only deletes stay local.

**Step 2: Run the focused tests to verify they fail**

Run: `fnm use 24; node --test tests/team-templates.test.mjs tests/team-builder-callbacks.test.mjs tests/team-template-realtime.test.mjs`

Expected: FAIL because the old conflict-copy and shared persistent-template logic is still present.

**Step 3: Commit**

```bash
git add tests/team-templates.test.mjs tests/team-builder-callbacks.test.mjs tests/team-template-realtime.test.mjs
git commit -m "test template local cloud separation"
```

### Task 2: Replace conflict-copy template storage with explicit cloud/local stores

**Files:**
- Modify: `D:/cloud/Eixa/ExiaAnalysis/src/utils/templates.ts`

**Step 1: Write minimal implementation**

- Add explicit local-only storage helpers.
- Keep temporary-copy storage separate.
- Remove conflict-copy generation, suffix stripping, and conflict-copy id logic.
- Add helpers for replacing cloud templates from snapshot and for combining visible local/cloud templates without conflict detection.

**Step 2: Run the focused tests**

Run: `fnm use 24; node --test tests/team-templates.test.mjs`

Expected: PASS

**Step 3: Commit**

```bash
git add src/utils/templates.ts tests/team-templates.test.mjs
git commit -m "refactor template storage separation"
```

### Task 3: Update TeamBuilder to use separate cloud/local template flows

**Files:**
- Modify: `D:/cloud/Eixa/ExiaAnalysis/src/components/TeamBuilder.tsx`
- Modify: `D:/cloud/Eixa/ExiaAnalysis/src/components/TeamBuilder/cloudRealtime.ts`

**Step 1: Write minimal implementation**

- Load cloud templates and local-only templates separately.
- Ensure local-only default template always exists and is undeletable.
- Keep cloud default undeletable when logged in.
- Make offline create/duplicate operations produce local-only templates.
- Make online create/duplicate of normal templates produce cloud templates.
- Make websocket snapshot handling replace cloud cache directly and leave local-only templates untouched.
- Remove conflict-copy display handling.
- Keep temporary copy local-only.

**Step 2: Run focused tests**

Run: `fnm use 24; node --test tests/team-builder-callbacks.test.mjs tests/team-template-realtime.test.mjs`

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/TeamBuilder.tsx src/components/TeamBuilder/cloudRealtime.ts tests/team-builder-callbacks.test.mjs tests/team-template-realtime.test.mjs
git commit -m "update team builder local and cloud flows"
```

### Task 4: Clean up i18n and verify end-to-end behavior

**Files:**
- Modify: `D:/cloud/Eixa/ExiaAnalysis/src/translations.ts`

**Step 1: Write minimal implementation**

- Remove unused conflict-copy translation keys if no longer referenced.
- Add any local-default naming keys only if needed.

**Step 2: Run full verification**

Run: `fnm use 24; node --test tests/*.mjs`
Expected: PASS

Run: `fnm use 24; npm run lint`
Expected: exit code 0

Run: `fnm use 24; npm run build`
Expected: exit code 0, with existing bundle-size warning allowed

**Step 3: Commit**

```bash
git add src/translations.ts
git commit -m "clean up team template sync copy"
```
