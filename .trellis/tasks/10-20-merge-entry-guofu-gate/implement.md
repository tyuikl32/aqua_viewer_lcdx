# 实施计划

> 顺序执行；每步后跑对应验证。**不 push**（push master 会触发自动部署）。提交按用户要求分批进行。

## 0. 前置

- 工作目录：`E:\ALL.Net\Project_LCDX_NET\aqua_viewer_lcdx`，分支 `master`（本地提交，不推送）。
- 提交一律**路径限定**（`git add <单个文件>`），禁止 `git add -A`（工作区常有其他会话的未提交文件）。

## 1. 判定模块

- [ ] 新建 `src/lib/guofuCard.ts`
  - `isGuofuCardNumber(cardNumber)`：`/^\d{20}$/` + 前缀 `2430443067` + `后10位 > 4579` + `(后10位 − 4579) % 83 === 0`
  - 文件头注释：`等价/镜像 LCDXNetApi/Services/UserService.cs 的 TryConvertCardIdToUserId（新方案 2430443067+pad10(u*83+4579)）`
- 验证：`npm run build` 的类型阶段通过（`tsc -b` 无 unused/参数报错）。

## 2. 设置页接线

- [ ] `src/features/mai2/Maimai2SettingPage.tsx`
  - 新增 `const [mergeEligible, setMergeEligible] = useState(false);`
  - 初始化 effect 中 `setMergeEligible(isGuofuCardNumber(luid))`
  - `loadMergeRequestStatus`：`94001` → `setMergeEligible(false)`
  - 引继卡片改为 `{mergeEligible && (…)}`
- 验证：`npm run build` 全绿。

## 3. 回归 spec

- [ ] `tests/lcdx-regression/settings.spec.ts`
  - 现有用例「binding uses the first card while merge uses the default card」：默认卡 `selected` 改成合法国服卡号（`24304430670830004579`），首卡保持非国服号（继续验证「绑定用首卡」）
  - 新增「非国服默认卡不渲染引继卡片」：默认卡 `50143954486701365311`，断言卡片标题不存在 **且** `lcdx/mergeRegistry/**` 请求计数为 0
  - 新增「旧方案卡号不渲染」：`24304430679911909652`
  - 新增「无卡不渲染」：`setup(page, 10, true, true, undefined, 'none')`（fixture 的 `unboundUser`）
- 验证：
  ```powershell
  ./node_modules/.bin/playwright test -c playwright.lcdx.config.ts settings.spec.ts --timeout=45000 *> test-run.log
  # 判据：test-results/lcdx-regression/ 为空 ⇔ 通过（Playwright 只为失败写产物）
  ```
  跑完如进程挂住，按 spec 记录手动 kill。

## 4. Spec 回写（Phase 3.3）

- [ ] `.trellis/spec/frontend/quality-guidelines.md` 的「Async snapshots…」小节补一条：
  「引继入口按 `defaultCard.luid` 的国服卡号格式门控（`src/lib/guofuCard.ts` 镜像后端 `TryConvertCardIdToUserId`）；非国服卡整块不渲染；后端 94001 兜底隐藏。绑定仍用 `cards[0].luid`。」

## 5. 提交（分批，不 push）

- [ ] C1 `chore(task): 建 merge-entry-guofu-gate 任务（PRD + 设计 + 实施计划）` —— 仅 `.trellis/tasks/10-20-merge-entry-guofu-gate/**`
- [ ] C2 `feat(mai2): 引继入口按国服卡号格式门控（非国服卡不渲染）` —— `src/lib/guofuCard.ts` + `Maimai2SettingPage.tsx`
- [ ] C3 `test(mai2): settings spec 覆盖国服卡号门控` —— `tests/lcdx-regression/settings.spec.ts`
- [ ] C4 `docs(spec): 记录引继入口的国服卡号门控约定` —— spec 文件

## 6. 收尾

- [ ] `task.json` 状态与 `task.py` 指针：`task.py start` 后进入 in_progress；完成后按用户节奏决定是否 `archive`（本任务默认留在 in_progress，等验收）
- [ ] 汇报：改动文件、验证证据（build 输出 + 定向 spec 结果）、未覆盖项

## 回滚点

- C1 之后：仅文档，删除任务目录即可。
- C2 之后：`git revert <C2>` 恢复「永远显示引继卡片」。
- C3 之后：spec 与代码一起 revert；若只回滚代码需同时回滚 spec 用例，否则新用例会红。
