# Interactive Selector Refactor and ESLint Tightening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将四个高交互选择器切换到稳定的 `Popover/List` 实现，并把 `ExiaAnalysis` 与 `ExiaInvasion` 都收敛到 strict recommended 的 ESLint 基线且命令行全绿。

**Architecture:** 前端交互层从 `Select + MenuItem` 迁移为“触发区 + Popover + List”两层结构，尽量不改变现有外观和按钮布局。Lint 层收紧到 official recommended 组合后，逐项修复真实代码问题，不用全局关闭规则绕过。

**Tech Stack:** React 19, TypeScript, JavaScript, MUI 7, Vite, ESLint 9, typescript-eslint

---

### Task 1: 收紧 ExiaAnalysis 的 ESLint 配置到 recommended 基线

**Files:**
- Modify: `D:\cloud\Eixa\ExiaAnalysis\eslint.config.mjs`
- Modify: `D:\cloud\Eixa\ExiaAnalysis\package.json`

**Step 1: Write the failing test**

把当前放水规则移除，让 lint 真实暴露问题：

```js
const sharedTsRules = {
  // delete these overrides
}
```

**Step 2: Run test to verify it fails**

Run:

```powershell
fnm exec --using .nvmrc -- cmd /c "npm run lint"
```

Expected: FAIL with recommended-rule violations in `src/`.

**Step 3: Write minimal implementation**

在 `eslint.config.mjs` 中：
- 移除 `@typescript-eslint/no-explicit-any` 的关闭
- 移除 `@typescript-eslint/no-unused-vars` 和 `no-unused-vars` 的关闭
- 移除 `no-empty` 的关闭
- 让 `react-hooks` 和 `react-refresh` 使用 recommended 组合而不是手工宽松配置

**Step 4: Run test to verify it passes enough to reveal real backlog**

Run:

```powershell
fnm exec --using .nvmrc -- cmd /c "npm run lint"
```

Expected: FAIL, but now only because真实代码问题存在，而不是配置不可运行。

**Step 5: Commit**

```powershell
git -C D:\cloud\Eixa\ExiaAnalysis add eslint.config.mjs package.json
git -C D:\cloud\Eixa\ExiaAnalysis commit -m "chore: tighten analysis eslint baseline"
```

### Task 2: 修复 ExiaAnalysis 第一批 lint 问题并保持构建稳定

**Files:**
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\App.tsx`
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\components\AccountsAnalyzer.tsx`
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\components\TeamBuilder.tsx`
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\i18n.tsx`

**Step 1: Write the failing test**

直接以 lint 作为红灯测试：

```powershell
fnm exec --using .nvmrc -- cmd /c "npm run lint"
```

**Step 2: Run test to verify it fails**

Expected: FAIL with `no-explicit-any`、`no-unused-vars`、hook 依赖或 purity 相关问题。

**Step 3: Write minimal implementation**

逐文件修复：
- 用具体类型替代 `any`
- 删除未使用变量或改为真正使用
- 修复 effect 依赖、纯度和 state-in-effect 问题
- 只在确有必要且合理的局部位置保留最小例外

**Step 4: Run test to verify it passes**

Run:

```powershell
fnm exec --using .nvmrc -- cmd /c "npm run lint"
fnm exec --using .nvmrc -- cmd /c "npm run build"
```

Expected: PASS

**Step 5: Commit**

```powershell
git -C D:\cloud\Eixa\ExiaAnalysis add src/App.tsx src/components/AccountsAnalyzer.tsx src/components/TeamBuilder.tsx src/i18n.tsx
git -C D:\cloud\Eixa\ExiaAnalysis commit -m "refactor: fix analysis eslint recommended issues"
```

### Task 3: 为 ExiaAnalysis 提取稳定的交互型选择器组件

**Files:**
- Create: `D:\cloud\Eixa\ExiaAnalysis\src\components\shared\InteractiveSelector.tsx`
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\components\TeamBuilder.tsx`
- Modify: `D:\cloud\Eixa\ExiaAnalysis\src\components\UnionRaidStats.tsx`

**Step 1: Write the failing test**

如果现有测试不足，先为最关键的纯函数/可复用交互补测试；否则至少用手动复现场景固定红灯标准：

```text
Open TeamBuilder template selector -> page becomes unresponsive
```

**Step 2: Run test to verify it fails**

Run:

```powershell
fnm exec --using .nvmrc -- cmd /c "npm run build"
```

Expected: 当前构建通过，但手动打开选择器仍会卡死，说明需要行为修复。

**Step 3: Write minimal implementation**

实现一个轻量 `InteractiveSelector`：
- 触发区负责显示当前值和展开状态
- `Popover` 负责承载列表
- 每行支持普通态和重命名态
- 行内按钮点击不触发选中
- 支持自定义标签与禁用操作占位

然后让以下两处接入：
- `TeamBuilder` 模板选择器
- `UnionRaidStats` 规划选择器

**Step 4: Run test to verify it passes**

Run:

```powershell
fnm exec --using .nvmrc -- cmd /c "npm run lint"
fnm exec --using .nvmrc -- cmd /c "npm run build"
```

Expected: PASS, and selector can be opened without freezing.

**Step 5: Commit**

```powershell
git -C D:\cloud\Eixa\ExiaAnalysis add src/components/shared/InteractiveSelector.tsx src/components/TeamBuilder.tsx src/components/UnionRaidStats.tsx
git -C D:\cloud\Eixa\ExiaAnalysis commit -m "refactor: replace analysis interactive selectors"
```

### Task 4: 为 ExiaInvasion 收紧并验证 ESLint 基线

**Files:**
- Modify: `D:\cloud\Eixa\ExiaInvasion\exia-invasion\eslint.config.js`

**Step 1: Write the failing test**

将配置与 official recommended 对齐，并确保 warning 也视为失败：

```powershell
fnm exec --using .nvmrc -- cmd /c "npm run lint -- --max-warnings 0"
```

**Step 2: Run test to verify it fails**

Expected: 如果暴露出历史问题则 FAIL。

**Step 3: Write minimal implementation**

在 `eslint.config.js` 中：
- 保持 `@eslint/js` recommended
- 保持 `react-hooks` recommended
- 保持 `react-refresh` recommended
- 不引入额外放水项

**Step 4: Run test to verify it passes**

Run:

```powershell
fnm exec --using .nvmrc -- cmd /c "npm run lint -- --max-warnings 0"
```

Expected: PASS

**Step 5: Commit**

```powershell
git -C D:\cloud\Eixa\ExiaInvasion\exia-invasion add eslint.config.js
git -C D:\cloud\Eixa\ExiaInvasion\exia-invasion commit -m "chore: tighten invasion eslint baseline"
```

### Task 5: 为 ExiaInvasion 提取交互型模板选择器并替换两处管理页列表

**Files:**
- Create: `D:\cloud\Eixa\ExiaInvasion\exia-invasion\src\components\common\InteractiveSelector.jsx`
- Modify: `D:\cloud\Eixa\ExiaInvasion\exia-invasion\src\components\management\AccountTabContent.jsx`
- Modify: `D:\cloud\Eixa\ExiaInvasion\exia-invasion\src\components\management\CharacterTabContent.jsx`

**Step 1: Write the failing test**

至少固定手动红灯场景：

```text
Open template selector in management page and interact with rename/copy/delete inline actions
```

**Step 2: Run test to verify it fails**

Run:

```powershell
fnm exec --using .nvmrc -- cmd /c "npm run build"
```

Expected: 当前构建通过，但交互模型仍是 `Select`。

**Step 3: Write minimal implementation**

实现 JS 版 `InteractiveSelector`：
- 触发区与列表分层
- 行内按钮和重命名输入框独立交互
- 默认模板禁删逻辑保持不变

接入：
- 账号模板列表
- 妮姬模板列表

**Step 4: Run test to verify it passes**

Run:

```powershell
fnm exec --using .nvmrc -- cmd /c "npm run lint -- --max-warnings 0"
fnm exec --using .nvmrc -- cmd /c "npm run build"
```

Expected: PASS

**Step 5: Commit**

```powershell
git -C D:\cloud\Eixa\ExiaInvasion\exia-invasion add src/components/common/InteractiveSelector.jsx src/components/management/AccountTabContent.jsx src/components/management/CharacterTabContent.jsx
git -C D:\cloud\Eixa\ExiaInvasion\exia-invasion commit -m "refactor: replace invasion interactive selectors"
```

### Task 6: 全量回归验证

**Files:**
- Test: `D:\cloud\Eixa\ExiaAnalysis\src\components\TeamBuilder.tsx`
- Test: `D:\cloud\Eixa\ExiaAnalysis\src\components\UnionRaidStats.tsx`
- Test: `D:\cloud\Eixa\ExiaInvasion\exia-invasion\src\components\management\AccountTabContent.jsx`
- Test: `D:\cloud\Eixa\ExiaInvasion\exia-invasion\src\components\management\CharacterTabContent.jsx`

**Step 1: Run ExiaAnalysis lint**

Run:

```powershell
fnm exec --using .nvmrc -- cmd /c "npm run lint"
```

Expected: PASS

**Step 2: Run ExiaAnalysis build**

Run:

```powershell
fnm exec --using .nvmrc -- cmd /c "npm run build"
```

Expected: PASS

**Step 3: Run ExiaInvasion lint**

Run:

```powershell
fnm exec --using .nvmrc -- cmd /c "npm run lint -- --max-warnings 0"
```

Expected: PASS

**Step 4: Run ExiaInvasion build**

Run:

```powershell
fnm exec --using .nvmrc -- cmd /c "npm run build"
```

Expected: PASS

**Step 5: Manual smoke verification**

Verify:
- 点开 `TeamBuilder` 模板选择器不再卡死
- 点开联盟突袭规划选择器可以正常重命名、复制、删除
- 插件管理页账号模板列表和妮姬模板列表可稳定打开与操作
- 临时复制模板的 `仅本地` 标签和按钮约束保持不变

**Step 6: Commit**

```powershell
git -C D:\cloud\Eixa\ExiaAnalysis add docs/plans/2026-03-07-interactive-selector-and-eslint-design.md docs/plans/2026-03-07-interactive-selector-and-eslint-implementation.md
git -C D:\cloud\Eixa\ExiaAnalysis commit -m "docs: add selector refactor and eslint plan"
```
