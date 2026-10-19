# 设计：引继入口的国服卡号判定

## 1. 边界

- **只改前端**（`aqua_viewer_lcdx`）。后端 `LCDXNetApi` 一行不动，不新增端点，不改响应形状。
- 不跨项目建任务：旧方案卡号支持（`243044306799`）若要做，属 `LCDXNetApi` 侧独立任务。
- 不新增 i18n key：本任务只做「显不显示」，不产生新文案。

## 2. 判定规则（唯一事实源：后端 `UserService.TryConvertCardIdToUserId`）

| 项 | 后端（`LCDXNetApi/Services/UserService.cs:337`） | 前端镜像 |
|---|---|---|
| 长度 | `cardId.Length != 20` → 拒 | `length !== 20` → `false` |
| 字符 | `!cardId.All(char.IsDigit)` → 拒 | `/^\d{20}$/` → `false` |
| 前缀 | `StartsWith("2430443067")` | 同 |
| 算术 | `raw = suffix - 4579`；`raw < 0 || raw % 83 != 0` → 拒 | 同 |
| 旧方案 `243044306799…` | 算术不通过 → 拒 | **同样拒**（不额外放行） |
| 后缀长度 | `long.TryParse` | `Number()`，并加 `Number.isSafeInteger` 保护 |

> 卡号是 20 位；`2430443067` + 10 位，安全整数范围内，`Number` 足够（不引入 BigInt，避免与 `tsc` 目标库纠缠）。

**镜像落点**：`src/lib/guofuCard.ts`，导出

```ts
/** 20 位国服卡号 → true（镜像 LCDXNetApi UserService.TryConvertCardIdToUserId） */
export function isGuofuCardNumber(cardNumber: string | null | undefined): boolean;
```

纯函数、无 React 依赖、无 IO，符合 `src/lib/` 约定（"framework-free logic"）。文件头注释标注后端来源文件与行号，供规则漂移时对照。这与 `src/lib/botPermission.ts` 镜像 `PermissionLevels.cs` 是同一套先例。

## 3. 组件改动（`src/features/mai2/Maimai2SettingPage.tsx`）

现状：`mergeCardId = defaultCard.luid`，卡片无条件渲染，按钮 `disabled={!mergeCardId}`。

改成：

```
新增状态  mergeEligible: boolean（默认 false）

初始化 effect（现有 loadUser 之后）：
    luid = String(user?.defaultCard?.luid ?? '')
    setMergeCardId(luid)
    setMergeEligible(isGuofuCardNumber(luid))      // 同步判定，不额外发请求

loadMergeRequestStatus(cardId)：
    仅当 mergeEligible 才调用（沿用现有 effect 依赖 mergeCardId）
    resp.status.code === 94001  → setMergeEligible(false)   // R4 规则漂移兜底
    其它分支保持原样（isOk → 写状态，异常 → 现有 toast）

渲染：
    {mergeEligible && ( <div className="card mb-3">…引继卡片…</div> )}
```

要点：

- **不渲染**而非 `d-none`：避免留下空卡片外壳、避免被 `.card.mb-3` 计数类断言误伤（`ui-parity` 里有 `toHaveCount(4)` 的历史写法，虽然本 fork 不跑，但保持 DOM 干净更稳）。
- 判定同步完成，所以卡片**不会先出现再消失**。
- `mergeCardId` 仍保留：它是引继请求的卡号来源（`defaultCard.luid`），只是现在被判定门控。绑定卡片的 `cards[0].luid` 逻辑完全不动。
- 交互链路（loading / 确认弹窗 / 成功失败 toast / 取消）零改动。

## 4. 数据流

```
/api/user/me ──► user.cards[] / user.defaultCard
                     │
                     ├─ cards[0].luid ──► 绑定卡卡片（不变）
                     └─ defaultCard.luid ──► isGuofuCardNumber()
                                              ├─ false → 不渲染引继卡片；不发任何 mergeRegistry 请求
                                              └─ true  → 渲染 → GET  lcdx/mergeRegistry/{user}/{luid}
                                                                └─ 94001 → 转为不渲染（兜底）
                                                       → POST lcdx/mergeRegistry/(request|cancel)/{user}/{luid}
```

## 5. 兼容性 / 影响面

- 其它页面不 import 设置页逻辑，`src/lib/guofuCard.ts` 是新增文件，无改名、无删除导出。
- `tests/lcdx-regression/settings.spec.ts` 前两个用例只断言绑定卡行为，默认 fixture 卡号 `12345678901234567890` 非国服 → 引继卡片消失不影响它们。
- 第三个用例「binding uses the first card while merge uses the default card」**会被本改动打破**（它用一个非国服号 `2222…` 做默认卡并点引继）。处理：把 fixture 默认卡换成合法国服卡号，用例意图（合并用默认卡而非首卡）保持不变。
- 后端无需发版：可见性判断在前端，服务器行为完全不变。

## 6. 备选方案与被否原因

| 方案 | 结论 | 原因 |
|---|---|---|
| 用 `GET lcdx/mergeRegistry` 的 94001 决定可见性 | 否 | 异步 → 先闪后消失；断网/401 时把国服用户的框也藏掉；用错误码表达 UI 规则偏脆 |
| 后端新增 `isGuofu` 字段或新端点 | 否（本期） | 跨项目、要发版；用户明确不要跨项目建任务 |
| 前端接受旧方案 `243044306799` 并显示入口 | 否 | 后端仍拒 → 变成「能点但必失败」，比隐藏更糟 |
| 只禁用按钮 + 提示文案 | 否 | 仍占版面且要新增文案；用户要的是「不显示那个框」 |

## 7. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 后端规则变化导致前后端不一致 | ① 文件头注释指向后端文件与函数；② R4：后端 94001 兜底隐藏；③ 判定模块单点、单测式 e2e 覆盖四种卡号 |
| 玩家已有引继记录但卡号非国服（历史遗留） | 该账号当前也点不了；隐藏不改变后端行为，记录仍在库里 |
| `Number` 精度 | 20 位卡号只取后 10 位（≤ 9,999,999,999，安全整数内）；整体字符串仅做正则与前缀判断，不整体转数 |
| 回归套件在本机会挂住 | 按 spec：跑定向 spec，以 `test-results/lcdx-regression/` 是否为空判通过，跑完 kill |

## 8. 回滚

- 代码级：单提交可 `git revert`（无数据迁移、无后端契约变更、无缓存/存储写入）。
- 行为级：回滚后恢复「永远显示引继卡片」的现状，即非国服账号继续看到必然失败的按钮。
