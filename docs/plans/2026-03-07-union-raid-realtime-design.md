# Union Raid Realtime Collaboration Design

**Problem**

现有公会战规划同步使用整份文档的 HTTP 读写。刷新、多人并发、以及客户端状态不完整时，前端容易把远端完整数据误判为“旧数据”或反过来用残缺本地快照覆盖云端，导致规划被删除或回退。

**Goal**

将公会战规划改成接近云文档的实时协作模式：
- 首次进入页面时通过实时通道获取完整快照
- 页面建立长连接，后续同步以字段级 patch 为主
- 不同字段的并发修改自动合并
- 相同字段冲突按服务端修订顺序决胜
- 断线重连后可以按 revision 补齐缺失变更，必要时退回全量快照

**Chosen Direction**

采用 `WebSocket + 字段级 patch + revision + event log`。

前端不再在每次编辑时整份 `GET/POST /raid-plan`。页面建立实时连接后，先通过 `hello -> snapshot` 获取权威状态；本地编辑先乐观更新 UI，再通过 WebSocket 发送 patch。后端将 patch 应用到当前规划文档，生成新的 `revision`，持久化后广播给其他在线会话。这样可以同时满足：
- 实时性
- 多端同步
- 不同字段自动合并
- 断线恢复

**Why Not Keep HTTP Polling**

HTTP 轮询或整份 HTTP 保存只能做到“发现变化后再整份拉取/覆盖”。即使前端加很多保护规则，也会持续面临：
- 整份快照误覆盖
- 冲突粒度过大
- 高频请求
- 本地与远端状态判断复杂且脆弱

这些问题正是这次回归的根源，所以不继续在整份轮询模型上打补丁。

**Document Model**

文档主对象仍然是规划列表 `plans`，每个规划包含：
- `id`
- `name`
- `updatedAt`
- `data`

其中 `data` 仍按：
- `accountKey`
- `slotIndex`

索引到具体出刀槽位。每个槽位支持的字段：
- `step`
- `predictedDamage`
- `characterIds`

本次并发合并只做到字段级，不再拆到 `characterIds` 的单个元素级别。也就是说：
- A 改 `predictedDamage`
- B 改 `characterIds`
可自动合并

但如果：
- A 和 B 同时改 `predictedDamage`
则按服务端接收后产生的较新 revision 覆盖较旧值。

**Protocol**

连接建立后，客户端发送 `hello`：
- `token`
- `documentId`，当前可固定为 `raid-plan`
- `lastRevision`
- `sessionId`

服务端响应以下两类之一：
- `snapshot`
  - `revision`
  - `plans`
- `patch_replay`
  - `patches`
- `revision`

之后客户端发送最小 patch：
- `clientMutationId`
- `baseRevision`
- `op`
- `payload`

`op` 分为：
- `slot.updateField`
- `plan.rename`
- `plan.create`
- `plan.delete`
- `plan.duplicate`

其中 `slot.updateField` 的 payload 包括：
- `planId`
- `accountKey`
- `slotIndex`
- `field`
- `value`

服务端应用成功后返回：
- `ack`
- `revision`
- `clientMutationId`
- `appliedPatch`

并向同用户其他在线连接广播：
- `patch_broadcast`
- `revision`
- `patch`
- `sessionId`

**Conflict Semantics**

按字段合并，规则如下：
- 不同字段并发修改，全部保留
- 相同字段并发修改，以较新的服务端 revision 为准
- 删除规划与修改该规划冲突时，删除优先
- 删除槽位内容与字段修改冲突时，后到达服务端的操作生效

客户端只做乐观更新，不自行裁决最终冲突结果。最终权威状态以服务端 `ack`/`patch_broadcast` 为准。

**Persistence**

后端保留当前完整状态表，并新增两类数据：

1. 文档修订
- 在 `raid_plans` 级别增加 `revision`
- 或单独维护用户级 raid 文档 revision

2. Patch 事件日志
- `user_id`
- `revision`
- `client_mutation_id`
- `session_id`
- `op`
- `patch_json`
- `created_at`

事件日志只需保留最近一段窗口，用于断线补偿；超出窗口时重连客户端退回全量 `snapshot`。

**Frontend Flow**

1. 页面初始化时：
- 建立 WebSocket
- 发送 `hello`
- 服务端返回 `snapshot` 或 `patch_replay`

2. 本地编辑时：
- 立即更新本地 Zustand/React state
- 记录 pending mutation
- 发送 patch

3. 收到 `ack` 时：
- 标记对应 mutation 已确认
- 更新 `lastRevision`

4. 收到别的会话广播时：
- 若 `sessionId` 不同，应用 patch
- 若本地该字段仍有未确认 mutation，则按 revision 重新对账

5. 断线重连时：
- 带 `lastRevision`
- 服务端能补 patch 就补
- 不能补则下发新 snapshot

**Backend Flow**

1. 鉴权连接
2. 读取当前 revision
3. 接收 patch
4. 在事务内：
- 验证 patch
- 读取当前字段状态
- 应用 patch
- 增加 revision
- 写入事件日志
- 更新当前文档表
5. 返回 ack
6. 广播 patch_broadcast

**Failure Handling**

- 非法 patch：返回 error，不改本地权威状态
- baseRevision 落后很多：服务端仍按当前状态应用；若无法安全应用，返回 `snapshot_required`
- WebSocket 断开：前端切换为“离线编辑待同步”状态，重连后再对账
- 事件日志缺失：强制重新通过实时通道获取 snapshot

**Migration Strategy**

分阶段迁移：

1. 后端增加 revision、patch apply、事件日志与 Durable Object 实时协调器
2. 前端切到“hello -> snapshot + ws patch/ack”模式
3. 后端接入多连接广播与断线补偿
4. 前端接入其他会话广播与重连对账
5. 删除旧的整份 HTTP 上传/下载逻辑

由于不再考虑兼容旧同步模型，本次迁移直接以纯实时方案落地，减少双轨维护复杂度。
