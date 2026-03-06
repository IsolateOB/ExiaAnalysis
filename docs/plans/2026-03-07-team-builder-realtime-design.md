# Team Builder Realtime Collaboration Design

**Problem**

当前队伍构建模板同步仍然是整包 `GET /team-template` 和整包 `POST /team-template`。这会带来几个问题：
- 登录后云端数据会直接覆盖本地，未登录用户切换登录态时有丢模板风险。
- 任意模板修改都会触发整份模板列表上传，冲突粒度过大。
- 联盟突袭“复制到队伍构建”目前会覆盖默认模板，临时复制内容和正式模板混在一起。
- 模板列表缺少“仅本地临时工作区”和“正常云端模板”的清晰边界。

**Goal**

将队伍构建模板改成和联盟突袭规划相同的 websocket 协作模型，但范围只覆盖正式模板：
- 正式模板通过 realtime snapshot + patch 同步到云端。
- 未登录用户的正式模板继续完整保存在本地，不因登录态切换丢失。
- 新增一个“临时复制模板”，只保存在本地，不参与 websocket、不落 D1。
- 联盟突袭复制时改写临时复制模板，不再覆盖默认模板。
- 模板选择器中临时复制模板有明确 UI 区分，但仍保留与普通模板一致的“复制模板”动作。

**Chosen Direction**

采用“双轨模板状态 + 单文档 websocket 同步”：
- `persistentTemplates`：正式模板列表，既能本地保底，也能通过 websocket 与 D1 同步。
- `temporaryCopyTemplate`：固定单份本地模板，独立 localStorage key，刷新后保留，但永远不上云。
- `visibleTemplates`：视图层合并结果，临时复制模板固定置顶，普通模板跟在后面。

这个方案比“把临时模板混进正式模板数组里再过滤”更安全，因为同步边界是结构层面的，而不是靠调用点记忆“这个 id 不要上传”。

## State Model

### Persistent Templates

正式模板保留现有 `TeamTemplate` 结构，继续包含：
- `id`
- `name`
- `createdAt`
- `totalDamageCoefficient`
- `members`

这部分状态在未登录时以本地 localStorage 为权威；登录后切换为“本地基线 + websocket 权威快照 + optimistic patch 队列”的模型。

### Temporary Copy Template

临时复制模板是一份独立的本地模板：
- 固定 id，例如 `__raid_copy__`
- 固定名称，例如 `临时复制模板`
- 使用单独 localStorage key
- 不进入 websocket snapshot
- 不参与 seed patch
- 不进入后端持久化

联盟突袭复制到队伍构建时，只覆盖这份模板并自动切换选中它。用户在队伍构建中继续编辑它时，也只改本地。

### Visible Template List

模板选择器展示的实际列表是：

```ts
visibleTemplates = temporaryCopyTemplate
  ? [temporaryCopyTemplate, ...persistentTemplates]
  : persistentTemplates
```

其中临时复制模板：
- 固定置顶
- 显示 `仅本地` 标签
- 不支持重命名
- 不支持删除
- 唯一保留的行内操作是“复制模板”，位置仍在“编辑”和“删除”之间

点击临时复制模板的“复制”后，会生成一个新的正式模板副本，并进入正常 websocket 同步流。

## Sync Scope

本次 websocket 只同步正式模板的以下操作：
- `template.create`
- `template.rename`
- `template.delete`
- `template.duplicate`
- `template.replaceMembers`

不同步：
- 当前选中的模板 id
- 模板下拉菜单开关状态
- 临时复制模板的任何字段
- 未提交到正式模板之外的其他临时 UI 状态

`template.replaceMembers` 采用整模板成员替换，而不是成员字段级 patch。队伍构建编辑一次通常会影响多个位置、角色和系数；对这个场景来说，整模板替换比碎 patch 更简单也更稳定。

## Login, Logout, and Merge Strategy

### Unauthenticated Users

未登录时：
- 正式模板完整保存在 `nikke_team_templates`
- 临时复制模板保存在独立 key
- 页面刷新后两类模板都能恢复

未登录用户不会启用 websocket，也不会失去任何本地模板能力。

### Login

登录时按下面顺序执行：
1. 读取本地正式模板，作为保底基线。
2. 建立 `team-template` websocket 连接并请求 snapshot。
3. 将云端正式模板与本地正式模板合并，不直接拿任意一边整体覆盖另一边。
4. 如果云端为空，则将本地正式模板 seed 到云端。
5. 临时复制模板始终只保留本地，不参与合并和 seed。

### Conflict Resolution

当本地正式模板与云端正式模板冲突时：
- 不同 id：直接保留两边。
- 相同 id 但内容不同：保留 `updatedAt` 较新的版本；较旧版本自动生成为一个冲突副本，避免静默丢数据。

这个规则同样适用于“未登录积累了一批本地模板，之后再登录”的场景。

### Logout

退出登录时：
- 关闭 websocket
- 保留本地正式模板
- 保留临时复制模板
- 不清空当前选中模板

这样用户无论是否登录，都不会因为认证状态切换丢模板。

## Realtime Protocol

### Endpoint

新增独立 realtime 入口：
- `GET /team-template/realtime`
- websocket `documentId` 固定为 `team-template`

保留现有 `GET /team-template` 和 `POST /team-template`：
- 用于历史兼容
- 用于紧急 fallback
- 新前端正常流程只依赖 websocket

### Snapshot

服务端首次连接返回：

```json
{
  "type": "snapshot",
  "revision": 3,
  "templates": []
}
```

`templates` 仅包含正式模板，不包含临时复制模板。

### Patch Ops

客户端发送以下 patch：

```json
{
  "type": "patch",
  "clientMutationId": "m-1",
  "sessionId": "session-1",
  "baseRevision": 3,
  "op": "template.rename",
  "payload": {
    "templateId": "tpl-1",
    "name": "模板2"
  }
}
```

支持的 `op`：
- `template.create`
- `template.rename`
- `template.delete`
- `template.duplicate`
- `template.replaceMembers`

其中 `template.replaceMembers` 的 payload 包含：
- `templateId`
- `members`
- `totalDamageCoefficient`

### Delivery Semantics

前端采用和联盟突袭一致的单补丁串行发送：
- 同一时刻只允许一个 in-flight patch
- 收到 `ack` 后才发送下一条
- 重连时只重发当前 in-flight patch

这样可以避免有依赖关系的 patch 在服务端并发交错处理。

## Backend Persistence

保留现有：
- `team_templates`
- `team_template_members`

新增 realtime 元数据表：
- `team_template_documents`
- `team_template_patch_events`

职责和联盟突袭一致：
- `team_template_documents` 保存用户文档级 `revision`
- `team_template_patch_events` 保存最近 patch 日志，用于重连 replay 和 mutation 去重

后端持久化时仍只写正式模板：
- 临时复制模板不会进入数据库
- `template.replaceMembers` 只重写目标模板成员，不会整表清空所有模板

## UI Design

模板选择器中的临时复制模板需要做到“看一眼就和正式模板不一样”，但不额外塞说明文案。

具体规则：
- 固定置顶
- 使用不同底色或边框强调
- 名称旁只显示一个标签：`仅本地`
- 保留行内复制按钮，位置与普通模板一致，仍在编辑和删除之间
- 不显示重命名入口
- 不显示删除入口

普通模板继续保持现有交互：
- 可重命名
- 可复制
- 可删除

联盟突袭复制到队伍构建后：
- 覆盖临时复制模板
- 自动切换选中它
- 不改默认模板

## Failure Handling

- websocket 断线：正式模板继续在本地编辑并入队待同步；临时复制模板不受影响。
- 云端空 snapshot：使用本地正式模板 seed 到云端，但不会把临时复制模板带上去。
- patch 应用失败：前端显示同步错误并停止发送后续 patch；保留本地状态供用户刷新后重试。
- replay 缺失：退回全量 snapshot，不清空临时复制模板。

## Migration Strategy

迁移按下面顺序进行：
1. 为队伍模板增加 realtime 文档与 patch 日志表。
2. 新增 `team-template/realtime` Durable Object 协作通道。
3. 前端抽离正式模板 websocket 同步层。
4. 前端引入独立的临时复制模板状态和 localStorage key。
5. 模板选择器合并展示临时模板与正式模板。
6. 联盟突袭复制逻辑切到临时复制模板。
7. 保留旧 HTTP 接口作为兼容和应急回退手段。

## Out of Scope

本次不做：
- 当前选中模板的跨端同步
- 临时复制模板上云
- 模板排序同步
- 模板字段级 member patch
- 旧 HTTP 同步逻辑的立刻删除
