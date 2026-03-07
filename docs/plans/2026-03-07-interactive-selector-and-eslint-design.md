# Interactive Selector Refactor and ESLint Tightening Design

**Problem**

`ExiaAnalysis` 和 `ExiaInvasion` 里有 4 个高交互选择器目前都基于 `MUI Select + MenuItem`，但每个选项里又塞进了重命名输入框、复制按钮、删除按钮和工具提示。这种实现把“选择一个值”和“在选项内部继续交互”混在一起，容易导致焦点冲突、事件冒泡混乱，已经在 `TeamBuilder` 模板选择器上表现为“只要点开就卡死”。

同时，`ExiaAnalysis` 现在的 ESLint 配置为了先跑起来，关闭了多条 recommended 规则，包括 `@typescript-eslint/no-explicit-any`、`@typescript-eslint/no-unused-vars` 和 `no-empty`。这让 lint 结果不能真实反映代码质量，也不满足“按严格 recommended 收敛”的目标。

**Goal**

这次改动同时完成两件事：
- 将 4 个交互型选择器从 `Select` 底层切换到更稳定的 `Popover/List` 结构，同时尽量保持现有视觉、按钮位置和功能不变。
- 将 `ExiaAnalysis` 和 `ExiaInvasion` 都收敛到不放水的 official recommended ESLint 组合，并把代码修到命令行下 0 error、0 warning。

**Chosen Direction**

采用“保留 UI 外观，替换底层交互模型”的做法：
- 不改变当前模板/规划/列表选择器的整体视觉方向。
- 触发层改为按钮式展示区域，浮层改为 `Popover` 内部的 `List`。
- 每一行继续保留现有的名称展示、重命名、复制、删除等操作。
- 普通筛选型下拉框不纳入本次改造范围，只改这 4 个交互型选择器。

ESLint 采用官方 recommended 组合，不额外启用更重的 typed strict 规则，也不再用本地关闭项绕过推荐规则。

## Scope

### In Scope

本次改造只覆盖下列 4 个交互型选择器：
- `D:\cloud\Eixa\ExiaAnalysis\src\components\TeamBuilder.tsx`
- `D:\cloud\Eixa\ExiaAnalysis\src\components\UnionRaidStats.tsx`
- `D:\cloud\Eixa\ExiaInvasion\exia-invasion\src\components\management\AccountTabContent.jsx`
- `D:\cloud\Eixa\ExiaInvasion\exia-invasion\src\components\management\CharacterTabContent.jsx`

本次 lint 收敛覆盖：
- `D:\cloud\Eixa\ExiaAnalysis`
- `D:\cloud\Eixa\ExiaInvasion\exia-invasion`

### Out of Scope

本次不改：
- 联盟突袭页面里的普通筛选 `Select`，例如 `level` 和 `step`
- 队伍构建和联盟突袭的 websocket 协议行为
- 选择器的视觉重设计
- 超出 recommended 范围的更严格 typed lint 规则

## Selector Architecture

### Trigger Layer

每个交互型选择器都会改成一个显式的触发区域，而不是依赖 `Select` 自带的选中逻辑。触发区域负责：
- 显示当前选中项
- 显示标签，例如 `仅本地`
- 显示展开箭头
- 打开和关闭 `Popover`

这层在视觉上保持和现在的下拉框类似，但行为上更像“带菜单的按钮”。

### Popover Layer

点击触发区域后，使用 `Popover` 展示可滚动的 `List`。列表项分成两种状态：
- 普通展示态：名称 + 行内操作按钮
- 重命名态：输入框 + 确认/取消按钮

由于不再由 `Select` 控制焦点和选中行为，列表项内的输入框和按钮可以独立交互，避免点开即卡死、误关闭菜单、焦点抢占等问题。

### Shared Pattern, Repo-Local Implementation

两个项目都会统一交互模型，但不强制抽成跨仓库共享组件：
- `ExiaAnalysis` 保持 TypeScript 组件边界
- `ExiaInvasion` 保持 JavaScript 组件边界

这样可以减少跨仓库复用带来的类型和构建耦合，同时让两边共享同一套行为规范。

## Affected Selector Behavior

### Team Builder Template Selector

保留现有行为：
- 临时复制模板固定置顶
- `仅本地` 标签保留
- 临时模板只保留复制动作
- 普通模板保留重命名、复制、删除

变化点只在底层实现，不改变现有按钮位置和主要外观。

### Union Raid Plan Selector

保留现有行为：
- 规划列表切换
- 规划重命名、复制、删除
- 与 `cloudLoading` 配合显示同步状态

底层改成 `Popover/List` 后，规划重命名输入框不会再和下拉自身的焦点机制冲突。

### ExiaInvasion Account and Character Template Selectors

两个模板列表保留现有管理页体验：
- 当前模板显示
- 新建模板
- 重命名、复制、删除
- 默认模板不可删除

底层替换后，管理页会获得和前端同样稳定的交互模型。

## ESLint Strategy

### ExiaAnalysis

`D:\cloud\Eixa\ExiaAnalysis\eslint.config.mjs` 将收敛到：
- `@eslint/js` recommended
- `typescript-eslint` recommended
- `eslint-plugin-react-hooks` recommended
- `eslint-plugin-react-refresh` recommended

移除当前本地放水项：
- `@typescript-eslint/no-explicit-any`
- `@typescript-eslint/no-unused-vars`
- `no-unused-vars`
- `no-empty`

代码层面将按实际问题修复，而不是通过全局关闭规则解决。

### ExiaInvasion

`D:\cloud\Eixa\ExiaInvasion\exia-invasion\eslint.config.js` 会保持 official recommended 组合，并继续满足：
- `npm run lint -- --max-warnings 0`

如果因为规则收紧暴露出新问题，同样通过修代码解决。

## Testing and Verification

### Selector Regression Checks

需要验证：
- `TeamBuilder` 模板选择器点击后不再卡死
- 4 个交互型选择器都能正常打开
- 行内重命名输入框可获得焦点并提交
- 复制和删除操作不误触发选中
- 点击空白处可以稳定关闭浮层

### Lint and Build Verification

必须通过：
- `fnm exec --using .nvmrc -- cmd /c "npm run lint"` in `D:\cloud\Eixa\ExiaAnalysis`
- `fnm exec --using .nvmrc -- cmd /c "npm run build"` in `D:\cloud\Eixa\ExiaAnalysis`
- `fnm exec --using .nvmrc -- cmd /c "npm run lint -- --max-warnings 0"` in `D:\cloud\Eixa\ExiaInvasion\exia-invasion`
- `fnm exec --using .nvmrc -- cmd /c "npm run build"` in `D:\cloud\Eixa\ExiaInvasion\exia-invasion`

## Risks

- `ExiaAnalysis` 当前关闭规则较多，恢复 recommended 后可能暴露大量历史问题，需要分批修复并避免顺手引入行为回归。
- 选择器替换涉及焦点、键盘和点击关闭行为，必须谨慎验证重命名态和普通态切换。
- `UnionRaidStats.tsx` 和 `TeamBuilder.tsx` 已经承担较多状态逻辑，若直接在原文件内追加大量 `Popover` 代码，可读性会继续下降，因此实现时优先考虑拆出轻量子组件。

