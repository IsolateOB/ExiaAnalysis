# ESLint Setup And Plugin Warning Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 `ExiaAnalysis` 补齐可运行的 ESLint，并消除 `ExiaInvasion` 当前唯一的 React Fast Refresh warning。

**Architecture:** 在 `ExiaAnalysis` 中添加一套最小的 flat ESLint 配置和 `lint` script，覆盖 TS/TSX React 代码与浏览器环境。`ExiaInvasion` 不改规则，只调整 `src/main.jsx` 的入口写法，让它不再被 `react-refresh/only-export-components` 误判。

**Tech Stack:** ESLint flat config, TypeScript ESLint, React Hooks plugin, React Refresh plugin, Vite, React 19

---

### Task 1: Add ExiaAnalysis ESLint

**Files:**
- Modify: `D:\cloud\Eixa\ExiaAnalysis\package.json`
- Modify: `D:\cloud\Eixa\ExiaAnalysis\package-lock.json`
- Create: `D:\cloud\Eixa\ExiaAnalysis\eslint.config.js`

**Step 1: Write the failing check**

Run: `fnm exec --using .nvmrc -- cmd /c "npm run lint"`
Expected: fail because no `lint` script exists.

**Step 2: Install minimal ESLint dependencies**

Install:
- `eslint`
- `@eslint/js`
- `globals`
- `typescript-eslint`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`

**Step 3: Add minimal flat config**

Cover:
- browser globals
- TS/TSX parsing
- `@eslint/js` recommended
- `typescript-eslint` recommended
- `react-hooks` recommended
- `react-refresh/only-export-components`
- ignore `dist`

**Step 4: Add lint script**

Script:
- `lint: eslint .`

**Step 5: Run lint to verify green**

Run: `fnm exec --using .nvmrc -- cmd /c "npm run lint"`

### Task 2: Remove ExiaInvasion Warning

**Files:**
- Modify: `D:\cloud\Eixa\ExiaInvasion\exia-invasion\src\main.jsx`

**Step 1: Write the failing check**

Run: `fnm exec --using .nvmrc -- cmd /c "npm run lint -- --max-warnings 0"`
Expected: fail on `react-refresh/only-export-components`.

**Step 2: Apply minimal code fix**

Change the entry render logic so the file no longer defines a local uppercase JSX component alias like `Page`.

**Step 3: Run lint to verify green**

Run: `fnm exec --using .nvmrc -- cmd /c "npm run lint -- --max-warnings 0"`

### Task 3: Final Verification

**Files:**
- Verify only

**Step 1: Run ExiaAnalysis lint**

Run: `fnm exec --using .nvmrc -- cmd /c "npm run lint"`

**Step 2: Run ExiaInvasion lint**

Run: `fnm exec --using .nvmrc -- cmd /c "npm run lint -- --max-warnings 0"`

**Step 3: Report remaining issues honestly**

If either repo still reports errors, list them explicitly instead of claiming success.
