# 冒烟测试报告 — 2026-10-10（CLL.Net + LCDXNetApi 已部署）

> 依据 `design.md` §5.2（LCDXNetApi 端点契约）、§2（数据模型）与 `implement.md` S5。
> 环境：生产。LCDXNetApi = `https://lcdxnet.am-allnet.com`；CLL.Net = `https://at.am-allnet.com`。

## 结论

**已部署版本行为完全符合设计。** 读路径 + playlog 入口 8/8 通过；
唯一未做的是"真实 playlog 写库 → 8th 出榜"，那需要真机且会写生产库。

## 明细

| # | 检查 | 预期 | 实测 | 结果 |
|---|---|---|---|---|
| 1 | `GET /lcdx/kop/current` | 200；20006 / KOP8th / 三曲 11810,11745,12025 / requiredLevel=3 / UTC 带 Z / `isOpen=false` | 完全一致 | ✅ |
| 2 | `GET /lcdx/kop/tournaments` | 200；`[20006(启用), 20004(有数据)]`，按 id 倒序（G15 并集） | 完全一致 | ✅ |
| 3 | `GET /lcdx/kop/rank`（无参） | `[]` —— 默认取当前启用届次 20006，而 8th 尚无成绩 | `[]` | ✅ **证明按届次过滤生效** |
| 4 | `GET /lcdx/kop/rank?tournamentId=20004&limit=3` | 6th 前三，含**新字段** `rank`/`kopNo`/`deluxScore`，`rankDate` **带 Z** | `[{"rank":1,"userId":10771777,...,"deluxScore":0,"tournamentId":20004,"kopNo":6,"rankDate":"2024-11-07T12:18:00Z"}, …]` | ✅ |
| 5 | `rank?limit=999` / `rank?limit=0` | 200 且不报错（内部夹到 200 / 1） | 200，无异常 | ✅ |
| 6 | `GET /kop6th/get/{6th 用户}`（3 个 id） | **200 + 空体** —— 新代码查当前届次 20006，6th 用户查不到 | 3/3 均为 200、size=0 | ✅ **届次化已上线**（旧代码会返回名次） |
| 7 | `POST /record/ReportUploadPlaylog` `{"content":[]}` | 200 `{"returnCode":1}` —— 新计分链跑通且不抛异常；空列表**不写库** | `{"returnCode":1}` | ✅ **新计分路径正向验证** |
| 8 | `GET /kop6th/get/`、`GET /definitely-not-a-route` | 404 —— 确认是该服务在响应 | 404 / 404 | ✅ |

### 关键证据（第 4 项原文）

```json
[{"rank":1,"userId":10771777,"currentUserName":"Ａｏｖ","score":3015007,"deluxScore":0,
  "tournamentId":20004,"kopNo":6,"rankDate":"2024-11-07T12:18:00Z"},
 {"rank":2,"userId":10245255,...,"score":3012332,...},
 {"rank":3,"userId":10891519,...,"score":3011606,...}]
```

- `rank` / `kopNo` / `deluxScore` = 本次新增字段 ✅
- `rankDate` 带 `Z` = UTC 口径迁移生效 ✅（日期 2024-11-07，6th 赛期内）
- `score=3015007` = **6th 的旧编码**（`Σ(达成率+(难度-3)×10000)`）✅ 符合 N2 决定"6th 保留旧值"
- `deluxScore=0` = 迁移回填默认值 ✅

### 关键证据（第 3 项 = 最有效的一条）

无参 `rank` 返回 `[]` 而不是 6th 的 30 条 —— 说明 `CurrentTournament()` 正确解析到
`IsEnabled=true` 的 **20006**，且 `Where(x => x.TournamentId == 20006)` 生效。
**旧版本会返回 6th 的榜**，所以这条有区分力。

## 未覆盖（需真机 / 会写库）

| 项 | 原因 |
|---|---|
| 单 credit 打 3 曲 → 真实 playlog → `KOPRankings(20006)` 出值 | 需真机；且会向生产库写入测试成绩 |
| `kop6th/get` 在有 8th 成绩后返回名次 | 依赖上一条 |
| 游戏内 The 8th 榜 + 第三曲解锁 | 需 `N021` option 包 + `LCTitleServer` 分发到机台 |

## 前端（2026-10-10 追加，已部署）

静态资源 + bundle 层验证（不需要登录即可做）：

| # | 检查 | 实测 | 结果 |
|---|---|---|---|
| 9 | `GET /` | 200 · `text/html` · 1 801 B | ✅ SPA 外壳 |
| 10 | `GET /mai2/kop`、`/mai2/rating` | 200（SPA fallback，同一外壳） | ✅ |
| 11 | `GET /assets/i18n/zh.json` | 200 · 59 083 B | ✅ |
| 12 | 主 bundle `/assets/index-BIhlLtIp.js`（1 530 951 B）内是否含 S3 新代码 | `kop/tournaments` ×1 · `kop/current` ×1 · `kop/rank` ×1 · `NoTournament` ×3 · `tournamentId` ×6 | ✅ **新版前端确认在线** |

> 前端与 LCDXNetApi **同域**（生产为同源 `'/'`，见 `.env`），
> 所以上面第 1–7 项的 `/lcdx/*` 探测就是在同一站点上做的。

### 未覆盖（前端）

- **登录后的实际渲染**：`mai2/kop` 菜单项带 `displayCondition: HasProfile`，页面需登录才能看到；
  本次只做到「资源与 bundle 层」验证，没有做带凭据的浏览器渲染检查。

## 侧边栏文案修正（本次一并做）

`App.Sidebar.KOP` 原为 `"KOP6th"`（写死第 6 届），而页面现在已按届次动态取数 → 改为届次中立：

| 资源 | 原值 | 新值 |
|---|---|---|
| `src/i18n/zh.json` · `public/assets/i18n/zh.json` | `KOP6th` | **`KOP 榜单`** |
| `src/i18n/en.json` · `public/assets/i18n/en.json` | `KOP6th` | **`KOP Ranking`** |

- 4 份资源同步修改；`src` 与 `public` 两份逐字节一致 ✅
- `node scripts/audit-i18n.mjs` → 4 资源各 **1290 key**，`errors: []` ✅
- 全仓已无 `KOP6th` 残留（仅剩一处代码注释提及历史）✅
- ⚠️ **需重新构建并部署前端才生效**（当前线上仍是旧文案）

## 复现命令

```bash
B1=https://lcdxnet.am-allnet.com     # LCDXNetApi
B2=https://at.am-allnet.com          # CLL.Net

curl -sS "$B1/lcdx/kop/current"
curl -sS "$B1/lcdx/kop/tournaments"
curl -sS "$B1/lcdx/kop/rank"                                  # 期望 []
curl -sS "$B1/lcdx/kop/rank?tournamentId=20004&limit=3"        # 期望 6th 前三
curl -sS -o /dev/null -w '%{http_code} %{size_download}\n' "$B2/kop6th/get/10771777"   # 期望 200 0
curl -sS -X POST -H 'Content-Type: application/json' -d '{"content":[]}' \
     "$B2/record/ReportUploadPlaylog"                          # 期望 {"returnCode":1}
```
