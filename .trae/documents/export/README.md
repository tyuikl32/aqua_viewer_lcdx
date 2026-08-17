# 舞萌DX 机台管理 —— 设计文档导出包

> 导出时间：2026-08-17（对应主文档**第五轮**版本：入口探测 EP-18/EP-19 + L2 Admin 超集修正）
> 项目状态：**设计阶段（未实施）**——所有代码仓库工作区干净，尚未编写任何实现代码。
> 本导出包为团队协作快照；后续修订以工作区内源文档为准。

## 文档结构

```
export/
├── README.md                                # 本导读
├── 01-总体设计-mai2-cabinet-management-v3.md # 单一事实源（五轮 grill 审查 + 第六轮定案）
├── 02-后端任务-LCDXNetApi/                   # 后端 Trellis 任务三件套
│   ├── prd.md                               # 需求与验收标准
│   ├── design.md                            # 文件结构与实现约束
│   └── implement.md                         # 13 步执行清单
└── 03-前端任务-aqua_viewer_lcdx/             # 前端 Trellis 任务三件套
    ├── prd.md / design.md / implement.md
```

## 按角色阅读顺序

| 角色 | 阅读顺序 |
|---|---|
| 全员 | README → 01 总体设计 §1（范围）§4（功能×权限矩阵）§8（前端 4 页） |
| 后端开发 | 01 全文 → 02 三件套（重点 §3 数据模型 / §5 Remoteware / §6 endpoint / §12 测试矩阵） |
| 前端开发 | 01 §6（endpoint 契约）§8 → 03 三件套 |
| 运维/部署 | 01 §5.2（Remoteware 配置）§10（部署前置：三表 DDL / Bootstrap 管理员 / 出站放行 / 单实例约束） |

## 设计核心速览

- **范围**：全部新后端能力并入 LCDXNetApi；QQBot / CLL.Net / BmDaemon 三项目零改动；前端 aqua_viewer_lcdx 新增 4 页
- **数据模型**：cll.net 库新表 LCDXMembers（身份）/ LCDXCabinetGrants（1:N 授权，软吊销）/ UserRemoteLocks（操作审计，失败也落库）；零 bot 库依赖
- **鉴权三层**：L1 TokenAuth → L2 CabAuth（∃Enabled 授权行 **或** P≥10，Admin 为隐式超集）→ L3 Admin（P≥10）
- **细分下放**：lcset 普通用户仅 `event`（chevent 不下放）；Remoteware 普通用户仅 game-reboot/game-switch；**安全边界在后端白名单**
- **Endpoint 18 个**：EP-01（permission）/ EP-04..07（查询四卡）/ EP-08..11（写操作）/ EP-13+13R（Remoteware 调度与轮询）/ EP-12/14..17（Admin 查询与授权管理）/ **EP-18（hasManage 入口探测）/ EP-19（可操控机台清单）**——原 EP-02/03 已并入 EP-19 废弃
- **Remoteware 链路**：先登记后外呼、NetMQ SUB 单线程独占、4 帧契约、回执缓存 TTL 5min 懒清理、单实例约束

## 已审批决策（不可逆）

1. 审计失败语义 = 方案 A（审计写失败记日志放行，可用性优先）
2. lcset/rm 按子集下放（lcset→仅 event，第六轮 Q1 定案；rm→game-reboot/game-switch）
3. 17 条 Remoteware 指令对 Admin 全量开放
4. remote-cmd 命令原文保留于审计
5. 鉴权不再依赖 QQBotDbContext：LCDXUserV2 用户单元 + LCDXMember 身份记录 + LCDXCabinetGrants 授权关系（全部 cll.net 单库）
6. 实施阶段新代码必须编写单元测试（xUnit / Karma）

## 开工前确认项（第六轮已全部定案，主文档 §11）

1. lcset 普通子集 = **仅 `event`**（chevent 不下放）
2. EP-15..17 授权管理端点纳入本期：**确认**
3. LCDXMembers 初始管理员：**3413607143、2320812015**（两名，P10）
4. §5.8 单实例部署约束：**接受**；实现须遵循 ASP.NET Core DI 设计规范管理生命周期（主文档 §9.1）
5. Remoteware 执行结果回写审计：**不回写**（回执 message 不落库）
6. 截图 imageUrl 内嵌 HttpToken（仅 Admin 可见）：**接受**

## 源文档位置（修订以工作区为准）

| 文档 | 源位置 |
|---|---|
| 总体设计（单一事实源） | `E:\ALL.Net\Project_LCDX_NET\aqua_viewer_lcdx\.trae\documents\mai2-cabinet-management-v3-design.md` |
| 后端 Trellis 任务 | `E:\ALL.Net\Project_LCDX_NET\LCDXNetApi\.trellis\tasks\08-17-mai2-cabinet-backend\`（含 research/design-baseline.md 同步副本） |
| 前端 Trellis 任务 | `E:\ALL.Net\Project_LCDX_NET\aqua_viewer_lcdx\.trellis\tasks\08-16-mai2-cabinet-features\` |
