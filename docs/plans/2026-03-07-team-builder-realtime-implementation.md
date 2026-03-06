# Team Builder Realtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将队伍构建正式模板切换到 websocket 实时同步，同时新增一个仅本地持久化的临时复制模板，供联盟突袭复制写入。

**Architecture:** 前端把模板状态拆成“正式模板”和“临时复制模板”两轨；正式模板通过 `hello -> snapshot -> patch/ack` 与后端 Durable Object 协作，临时复制模板通过独立 localStorage key 本地持久化。后端新增队伍模板 realtime 文档、patch 日志和 websocket 入口，但只持久化正式模板。

**Tech Stack:** React 19, TypeScript, Vite, Node built-in test runner, Rust, Cloudflare Workers, Durable Objects, D1

---

### Task 1: 增加前端模板状态工具，拆分正式模板与临时复制模板

**Files:**
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\utils\templates.ts`
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\utils\teamTemplateState.ts`
- Test: `D:\cloud\Eixa\ExiaAnalysis\tests\team-templates.test.mjs`

**Step 1: Write the failing test**

为以下行为补测试：

```js
test('temporary copy template persists in its own localStorage key', () => {
  // save temp template -> reload helpers -> assert temp still exists
})

test('merge keeps newer template and turns older conflicting one into a copy', () => {
  // same id, different updatedAt/content
})
```

**Step 2: Run test to verify it fails**

Run:

```powershell
fnm exec --using .nvmrc node --test tests/team-templates.test.mjs
```

Expected: FAIL because temp-template helpers and merge helpers do not exist yet.

**Step 3: Write minimal implementation**

实现最小工具层：
- 正式模板 localStorage 读写继续走 `nikke_team_templates`
- 新增临时复制模板 localStorage key
- 增加 `mergePersistentTemplates`、`createConflictTemplateCopy`、`buildTemporaryCopyTemplate`
- 保证现有默认模板逻辑不再承担联盟突袭复制落点

**Step 4: Run test to verify it passes**

Run:

```powershell
fnm exec --using .nvmrc node --test tests/team-templates.test.mjs
```

Expected: PASS

**Step 5: Commit**

```powershell
git -C D:\cloud\Eixa\ExiaAnalysis add src/utils/templates.ts src/utils/teamTemplateState.ts tests/team-templates.test.mjs
git -C D:\cloud\Eixa\ExiaAnalysis commit -m "feat: split persistent and temporary team templates"
```

### Task 2: 增加前端队伍模板 realtime 协议与 optimistic helper

**Files:**
- Create: `D:\cloud\Eixa\ExiaAnalysis\src\components\TeamBuilder\cloudRealtime.ts`
- Create: `D:\cloud\Eixa\ExiaAnalysis\tests\team-template-realtime.test.mjs`

**Step 1: Write the failing test**

增加以下测试：

```js
test('buildTemplateCreatePatch creates a realtime create payload', () => {})
test('reconcileTemplateAck clears the in-flight mutation', () => {})
test('seed patches never include the temporary copy template', () => {})
test('getNextDispatchableMutation sends only one patch at a time', () => {})
```

**Step 2: Run test to verify it fails**

Run:

```powershell
fnm exec --using .nvmrc node --test tests/team-template-realtime.test.mjs
```

Expected: FAIL because the realtime helpers do not exist yet.

**Step 3: Write minimal implementation**

实现：
- websocket 消息类型
- `template.create` / `template.rename` / `template.delete` / `template.duplicate` / `template.replaceMembers`
- optimistic state 容器
- ack / broadcast reconcile
- 过滤临时复制模板的 seed builder

**Step 4: Run test to verify it passes**

Run:

```powershell
fnm exec --using .nvmrc node --test tests/team-template-realtime.test.mjs
```

Expected: PASS

**Step 5: Commit**

```powershell
git -C D:\cloud\Eixa\ExiaAnalysis add src/components/TeamBuilder/cloudRealtime.ts tests/team-template-realtime.test.mjs
git -C D:\cloud\Eixa\ExiaAnalysis commit -m "feat: add team template realtime helpers"
```

### Task 3: 为后端新增队伍模板 realtime schema 与 handler

**Files:**
- Create: `D:\cloud\Eixa\ExiaBackend\migrations\004_team_template_realtime.sql`
- Create: `D:\cloud\Eixa\ExiaBackend\src\handlers\team_realtime.rs`
- Modify: `D:\cloud\Eixa\ExiaBackend\src\handlers\mod.rs`
- Modify: `D:\cloud\Eixa\ExiaBackend\src\lib.rs`

**Step 1: Write the failing test**

在后端 handler 内联测试中覆盖：

```rust
#[test]
fn apply_template_replace_members_updates_only_one_template() {}

#[test]
fn duplicate_template_creates_a_new_template_with_new_metadata() {}

#[test]
fn replay_and_snapshot_only_include_persistent_templates() {}
```

**Step 2: Run test to verify it fails**

Run:

```powershell
cargo test
```

Expected: FAIL because the migration, types, and handler do not exist yet.

**Step 3: Write minimal implementation**

实现：
- `team_template_documents`
- `team_template_patch_events`
- `GET /team-template/realtime`
- `hello -> snapshot`
- patch apply / revision / ack / replay
- 只持久化正式模板，不支持任何临时复制模板语义

**Step 4: Run test to verify it passes**

Run:

```powershell
cargo test
```

Expected: PASS

**Step 5: Commit**

```powershell
git -C D:\cloud\Eixa\ExiaBackend add migrations/004_team_template_realtime.sql src/handlers/team_realtime.rs src/handlers/mod.rs src/lib.rs
git -C D:\cloud\Eixa\ExiaBackend commit -m "feat: add team template realtime backend"
```

### Task 4: 将 TeamBuilder 切到正式模板 websocket，同步登录合并与断线重连

**Files:**
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\components\TeamBuilder.tsx`
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\utils\templates.ts`
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\utils\teamTemplateState.ts`
- Test: `D:\cloud\Eixa\ExiaAnalysis\tests\team-template-realtime.test.mjs`

**Step 1: Write the failing test**

新增流程测试：

```js
test('login merges local persistent templates with cloud snapshot instead of overwriting', () => {})
test('empty cloud snapshot seeds only persistent templates', () => {})
test('editing a persistent template queues replaceMembers and keeps optimistic UI', () => {})
test('logout leaves local templates intact', () => {})
```

**Step 2: Run test to verify it fails**

Run:

```powershell
fnm exec --using .nvmrc node --test tests/team-template-realtime.test.mjs tests/team-templates.test.mjs
```

Expected: FAIL on the unimplemented TeamBuilder orchestration path.

**Step 3: Write minimal implementation**

在 `TeamBuilder.tsx` 中：
- 移除现有整包 GET/POST 自动同步主路径
- 建立 websocket 连接
- 维护 `persistentTemplates`、`temporaryCopyTemplate`、`visibleTemplates`
- 登录时执行本地/云端正式模板合并
- 空云端时 seed 正式模板
- 普通模板编辑时发送 `template.replaceMembers`
- 临时复制模板编辑时只写本地

**Step 4: Run test to verify it passes**

Run:

```powershell
fnm exec --using .nvmrc node --test tests/team-template-realtime.test.mjs tests/team-templates.test.mjs
```

Expected: PASS

**Step 5: Commit**

```powershell
git -C D:\cloud\Eixa\ExiaAnalysis add src/components/TeamBuilder.tsx src/utils/templates.ts src/utils/teamTemplateState.ts tests/team-template-realtime.test.mjs tests/team-templates.test.mjs
git -C D:\cloud\Eixa\ExiaAnalysis commit -m "feat: switch team builder to realtime sync"
```

### Task 5: 接入联盟突袭复制到临时复制模板，并完成模板选择器 UI 改造

**Files:**
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\components\TeamBuilder.tsx`
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\components\UnionRaidStats.tsx`
- Test: `D:\cloud\Eixa\ExiaAnalysis\tests\team-templates.test.mjs`

**Step 1: Write the failing test**

补以下测试：

```js
test('union raid copy updates the temporary copy template instead of the default template', () => {})
test('temporary copy template renders with local-only badge and copy action only', () => {})
test('duplicating the temporary copy template creates a persistent template', () => {})
```

**Step 2: Run test to verify it fails**

Run:

```powershell
fnm exec --using .nvmrc node --test tests/team-templates.test.mjs tests/team-template-realtime.test.mjs
```

Expected: FAIL because union-raid copy still targets the old template path and the selector UI does not distinguish the temp template yet.

**Step 3: Write minimal implementation**

实现：
- 联盟突袭复制只更新临时复制模板
- 自动选中临时复制模板
- 临时复制模板显示 `仅本地` 标签
- 临时复制模板只显示复制按钮，位置保持在编辑和删除之间
- 复制临时复制模板时创建一个正式模板并进入 websocket 同步

**Step 4: Run test to verify it passes**

Run:

```powershell
fnm exec --using .nvmrc node --test tests/team-templates.test.mjs tests/team-template-realtime.test.mjs
```

Expected: PASS

**Step 5: Commit**

```powershell
git -C D:\cloud\Eixa\ExiaAnalysis add src/components/TeamBuilder.tsx src/components/UnionRaidStats.tsx tests/team-templates.test.mjs tests/team-template-realtime.test.mjs
git -C D:\cloud\Eixa\ExiaAnalysis commit -m "feat: add local-only copied team template"
```

### Task 6: 端到端验证与兼容回归

**Files:**
- Test: `D:\cloud\Eixa\ExiaAnalysis\tests\team-templates.test.mjs`
- Test: `D:\cloud\Eixa\ExiaAnalysis\tests\team-template-realtime.test.mjs`
- Test: `D:\cloud\Eixa\ExiaAnalysis\tests\union-raid-realtime.test.mjs`
- Modify: `D:\cloud\Eixa\ExiaAnalysis\docs\plans\2026-03-07-team-builder-realtime-design.md`

**Step 1: Run the frontend targeted tests**

Run:

```powershell
fnm exec --using .nvmrc node --test tests/team-templates.test.mjs tests/team-template-realtime.test.mjs tests/union-raid-realtime.test.mjs
```

Expected: all PASS

**Step 2: Build the frontend**

Run:

```powershell
fnm exec --using .nvmrc -- cmd /c "npm run build"
```

Expected: build succeeds

**Step 3: Run backend tests**

Run:

```powershell
cargo test
```

Expected: PASS

**Step 4: Manual websocket smoke test**

Verify:
- 登录后普通模板能收到 snapshot
- 普通模板编辑能收到 ack
- 临时复制模板不会出现在 websocket snapshot 中
- 联盟突袭复制后只改临时复制模板
- 复制临时复制模板后会出现新的正式模板

**Step 5: Commit**

```powershell
git -C D:\cloud\Eixa\ExiaAnalysis add docs/plans/2026-03-07-team-builder-realtime-design.md docs/plans/2026-03-07-team-builder-realtime-implementation.md
git -C D:\cloud\Eixa\ExiaAnalysis commit -m "docs: add team builder realtime plan"
```
