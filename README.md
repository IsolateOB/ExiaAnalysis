# Nikke 伤害估算器

基于 React + Vite + Electron + TypeScript + Material UI 的 Nikke 伤害估算器桌面应用。

## 功能特性

- 🎮 Nikke 角色队伍构建
- 🔍 智能角色筛选系统
- 📊 伤害计算与强度分析
- 🎨 Material Design 风格界面
- 💻 跨平台桌面应用

## 技术栈

- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite
- **桌面框架**: Electron
- **UI 库**: Material UI (MUI)
- **图标**: Material Icons

## 项目结构

```
DamageEstimate/
├── src/                    # React 应用源码
│   ├── components/         # 组件
│   │   ├── CustomTitleBar.tsx    # 自定义标题栏
│   │   ├── TeamBuilder.tsx       # 队伍构建器
│   │   ├── CharacterCard.tsx     # 角色卡片
│   │   └── CharacterFilterDialog.tsx # 角色筛选弹窗
│   ├── types/              # 类型定义
│   ├── data/               # 数据文件
│   ├── App.tsx             # 主应用组件
│   └── main.tsx            # 应用入口
├── electron/               # Electron 主进程
│   ├── main.ts             # 主进程
│   └── preload.ts          # 预加载脚本
├── public/                 # 静态资源
└── dist/                   # 构建输出
```

## 开发指南

### 安装依赖

```bash
npm install
```

### 开发模式

启动 Vite 开发服务器：

```bash
npm run dev:vite
```

启动完整的 Electron 开发环境：

```bash
npm run dev
```

### 构建

构建 React 应用：

```bash
npm run build:vite
```

构建 Electron 主进程：

```bash
npm run build:electron-src
```

构建完整应用：

```bash
npm run build
```

### 预览

预览构建结果：

```bash
npm run preview
```

## 当前实现

### ✅ 已完成

1. **项目基础结构**

   - React + TypeScript + Vite 配置
   - Electron 集成
   - Material UI 主题配置

2. **自定义标题栏**

   - Material Design 风格
   - 窗口控制按钮（最小化、最大化、关闭）
   - 可拖拽区域

3. **角色队伍构建**

   - 5 个角色位置的纵向布局
   - 空位置显示添加按钮
   - 角色卡片展示详细信息

4. **角色筛选系统**

   - 搜索框支持中英文名称搜索
   - 多维度筛选条件：
     - 职业（火力型、防御型、支援型）
     - 代码（铁甲、燃烧、水冷、风压、电击）
     - 爆裂阶段（I、II、III 阶段，支持 AllStep）
     - 企业（极乐净土、米西利斯、泰特拉、朝圣者、反常）
     - 武器类型（AR、SMG、SG、SR、MG、RL）
   - 实时筛选结果显示

5. **角色信息展示**
   - 中英文名称
   - 彩色职业和代码标签
   - 爆裂阶段、武器类型、企业、稀有度信息
   - 排除稀有度的信息展示（按需求）

### 🚧 待实现

1. **伤害计算系统**

   - 伤害输入表单
   - 计算算法
   - 结果展示

2. **数据持久化**

   - 队伍配置保存
   - 角色数据管理

3. **更多功能**
   - 队伍导入/导出
   - 多队伍管理
   - 计算历史记录

## 使用说明

1. 启动应用后，左侧是角色队伍构建区域
2. 点击空的角色位置，会弹出角色筛选对话框
3. 可以通过搜索框搜索角色名称，或使用筛选条件
4. 选择角色后，会显示在队伍中
5. 已选择的角色会显示详细信息（职业、代码、企业等）
6. 可以点击删除按钮移除角色

## 角色数据说明

- **数据源**: 使用 `public/list.json` 文件中的真实角色数据
- **AllStep 角色特性**: 爆裂阶段为 AllStep 的角色（如小红帽）可以被任何阶段筛选条件匹配到
- **筛选逻辑**: 多个筛选条件之间是 AND 关系
- **搜索功能**: 支持角色的中英文名称模糊搜索
- **数据过滤**: 自动过滤掉不完整的角色数据，只显示包含完整信息的角色

## 开发注意事项

- 使用 ES Module 语法
- TypeScript 严格模式
- Material UI 主题定制
- Electron 无边框窗口设计
- 角色数据从 `public/list.json` 动态加载
