# 执行计划 · 机台登入二维码加固（前端）

## 依赖与顺序

后端 `10-25-card-qr-hardening-backend` 先上线：它在响应里**新增** `expiresAt`（加法），
旧前端无感。前端对 `expiresAt` 缺失时必须优雅回退，因此**前端先上也不会炸**，
只是失去 P2-5 的精度改善。

## 步骤

### F1 · 错误态结构修复（P1-1 / R1、R2）

1. `src/features/cards/CardQrModal.tsx`
   - 抽出 `placeholder` 文案变量（busy / expired / failed 三态）
   - 渲染改为 `errorKey ? <错误文案> : <白框 + 占位>`，两者互斥
   - 删除容器外那条独立的 `{errorKey && ...}` 渲染

验证：`npx playwright test ... cards-qr.spec.ts`（现有用例应仍全绿）

### F2 · 文案（P2-1 / R4）

2. `src/i18n/zh.json` / `src/i18n/en.json`
   - `CardsPage.QrHint` 去掉「10 分钟 / 10 minutes」
   - `CardsPage.QrRenderFailed` 改为不承诺刷新的表述

### F3 · expiresAt（P2-5 / R6）

3. `src/lib/api/cardQr.ts` — `CardQrPayload` 增 `expiresAt?: string`
4. `src/features/cards/CardQrModal.tsx`
   - 新增 `remainingSeconds(data)`：优先 `expiresAt`，回退 `expiresInSeconds`，钳制 `[0, 540]`

### F4 · 测试（P1-1 / R3、R5 / R6）

5. `tests/lcdx-regression/cards-qr.spec.ts`
   - 新增参数化用例：4 种错误码 × 「通用失败文案 count === 0」
   - 新增暗色像素用例：`legacy` + `liquefy` 两族
   - 新增 `expiresAt` 起算用例

### F5 · 全量校验

```
npm run build
npx playwright test --config=playwright.lcdx.config.ts tests/lcdx-regression
```

既有 78 项必须全绿，新增用例全绿。

### F6 · spec 回填

6. `.trellis/spec/frontend/card-qr-entry.md` 追加两条易错规则：
   - 错误态与二维码容器必须互斥（不要再叠加第二条文案）
   - 倒计时以 `expiresAt` 为准，`expiresInSeconds` 仅作回退；`540` 不可改成 600

## 回滚点

| 阶段 | 回滚 |
|---|---|
| F1 | revert；错误态回到双消息（功能仍可用） |
| F2 | revert；文案回到 10 分钟表述 |
| F3 | revert；倒计时回到 `expiresInSeconds` |
| F4 | 随 F1–F3 一并回滚 |

## 提交纪律

- 一律 `git commit`，**不 push**（push `master` 会自动部署）。
- 不用 `--amend`。
- 只提交本任务产生的文件。

---

# 实际改动与结论

## 交付清单

| 文件 | 类型 | 说明 |
|---|---|---|
| `src/features/cards/CardQrModal.tsx` | 改 | 错误态与二维码容器互斥；`remainingSeconds()` 优先 `expiresAt` |
| `src/lib/api/cardQr.ts` | 改 | `CardQrPayload` 增可选 `expiresAt` |
| `src/i18n/zh.json` / `src/i18n/en.json` | 改 | `QrHint` 去掉「10 分钟」；`QrRenderFailed` 改为不承诺刷新 |
| `tests/lcdx-regression/cards-qr.spec.ts` | 改 | +8 用例：4×错误态唯一文案、2×暗色像素、2×倒计时来源 |
| `.trellis/spec/frontend/card-qr-entry.md` | 改 | 新增 §7 错误态互斥、§8 倒计时来源；补自动化守卫索引 |

## 验证结果

| 项 | 命令 | 结果 |
|---|---|---|
| 构建 | `npm run build` | 通过（819ms，`tsc -b` 无错） |
| 新增用例 | `npx playwright test … tests/lcdx-regression/cards-qr.spec.ts` | **13 passed**（原 5 + 新 8） |
| 全量回归 | `npx playwright test … tests/lcdx-regression` | **86 passed / 0 failed**（改前 78） |

## 修复前后对照（真实浏览器）

修复前，四条错误路径全部双消息：

```
--- 94032 throttled ---
  visible: "Failed to render, please refresh"
  visible: "Too frequent, please try again later."
```

修复后同一探针（用外部脚本驱动的 Chromium，非仓库内测试）：

```
--- 94032 throttled ---
  visible: "Too frequent, please try again later."
  visible: "For your account safetyDo not share this QR code."
  visible: "Aim your screen at the cabinet scanner before the countdown ends."
--- 94001 / 94031 / 95001 ---  均只有一条原因，无通用失败文案
```

## 实施中的偏差

| 计划 | 实际 | 原因 |
|---|---|---|
| 只让占位分支让位于 `errorKey` | 改为整块容器互斥 | 仅改条件会在白框里留下一条通用文案，且错误态会留一个 344×344 的空白白框 |
| 暗色用例覆盖 3 个主题族 | 覆盖 2 个（legacy/liquefy） | `animal-island` 有更多全局覆盖、收益低；已在 design.md 记录取舍 |
| — | 新增「旧后端无 `expiresAt` 时回退」用例 | 发布顺序要求前端能单独上线，必须有对应回归 |

## 仍未覆盖

- **实机扫码未验证**：前端只保证码的内容与样式。
- `animal-island` 主题族的二维码白底未纳入自动化断言。
- iOS Safari 对 `data:` URL 的 `download` 属性支持有限，「保存图片」在 iOS 上可能无效（既有行为，未在本任务处理）。

