# 实施计划

> 顺序执行；每步后跑对应验证。**不 push**（push master 会触发自动部署）。提交按用户要求分批进行。

## 0. 前置

- 工作目录：`E:\ALL.Net\Project_LCDX_NET\aqua_viewer_lcdx`，分支 `master`（本地提交，不推送）。
- 提交一律**路径限定**（`git add <单个文件>`），禁止 `git add -A`（工作区常有其他会话的未提交文件）。

## 1. 判定模块

- [x] 新建 `src/lib/guofuCard.ts`
  - `isGuofuCardNumber(cardNumber)`：`/^\d{20}$/` + 前缀 `2430443067` + `后10位 > 4579` + `(后10位 − 4579) % 83 === 0`
  - 文件头注释：镜像 `LCDXNetApi/Services/UserService.cs` 的 `TryConvertCardIdToUserId`（新方案 `2430443067` + pad10(u×83+4579)），并说明旧方案刻意不放行
- 验证：`npm run build` 的类型阶段通过（`tsc -b` 无 unused/参数报错）。

## 2. 设置页接线

- [x] `src/features/mai2/Maimai2SettingPage.tsx`
  - 新增 `const [mergeEligible, setMergeEligible] = useState(false);`
  - 初始化 effect 中 `setMergeEligible(isGuofuCardNumber(mergeLuid))`
  - `loadMergeRequestStatus`：`resp.status.code === StatusCode.BAD_REQUEST (94001)` → `setMergeEligible(false)`
  - 引继卡片改为 `{mergeEligible && (…)}`；状态查询 effect 的门控改为 `mergeEligible && mergeCardId`
- 验证：`npm run build` 全绿。

## 3. 回归 spec

- [x] `tests/lcdx-regression/settings.spec.ts`
  - 现有用例「binding uses the first card while merge uses the default card」：默认卡 `selected` 换成 `24304430670830004579`（userId 10000000），首卡仍为非国服号（继续验证「绑定用首卡」）
  - 新增「实体 Aime 卡 → 不渲染且零请求」：默认卡 `50143954486701365311`，断言 `Set Merge` 按钮与 `CN Data Merge` 标题均 0 个，`mergeRegistry` 请求为空
  - 新增「旧方案 `24304430679911909652` → 不渲染」
  - 新增「无卡 → 不渲染」（fixture `cards: 'none'`）
  - 新增「后端 94001 → 自动隐藏」（R4 漂移兜底）
- 验证：
  ```powershell
  ./node_modules/.bin/playwright.cmd test -c playwright.lcdx.config.ts settings.spec.ts --timeout=45000
  # 判据：line reporter 输出 "N passed"；test-results/lcdx-regression/ 只会有 .last-run.json（非失败产物）
  ```

## 4. Spec 回写（Phase 3.3）

- [x] `.trellis/spec/frontend/quality-guidelines.md` 的「Async snapshots, initialization and request ownership」小节补一条「引继入口按 `defaultCard.luid` 的国服卡号格式门控」约定（含旧方案刻意拒绝、94001 兜底、回归用例位置）。

## 5. 提交（分批，不 push）

- [x] C1 `chore(task): 建 merge-entry-guofu-gate 任务（PRD + 设计 + 实施计划）` —— `1a783eb`
- [x] C2 `feat(mai2): 引继入口按国服卡号格式门控（非国服卡不渲染）` —— `c44c310`
- [x] C3 `test(mai2): settings spec 覆盖国服卡号门控（实体卡/旧方案/无卡/后端 94001）` —— `89457cd`
- [x] C4 `docs(spec): 记录引继入口的国服卡号门控约定` —— 见下一条提交

## 6. 收尾

- [x] `task.py start` → status `in_progress`（本机无 session identity，degraded 模式，指针未落盘，不影响状态）
- [ ] 是否 `archive` 留待验收后再定（默认留在 in_progress）

## 验证结果（2026-10-20）

- `npm run build`：**exit 0**（`tsc -b` + vite build 均通过，含改动后与 spec 改动后各一次）。
- 定向回归 `settings.spec.ts`：**7 passed (7.6s)，exit 0**（3 个既有用例 + 4 个新增用例）。
- 其它回归 spec 中没有任何一个访问 `/mai2/setting` 或断言 merge 入口（已 grep 全量 `tests/lcdx-regression`），故不受影响；未跑全量套件——按 spec 记录本机全量会挂死在 teardown。

## 回滚点

- C1 之后：仅文档，删除任务目录即可。
- C2 之后：`git revert <C2>` 恢复「永远显示引继卡片」。
- C3 之后：spec 与代码一起 revert；若只回滚代码需同时回滚 spec 用例，否则新用例会红。
