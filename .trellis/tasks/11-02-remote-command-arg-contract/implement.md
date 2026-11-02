# 实施计划

## 顺序

1. **模型**：`src/features/mai2/cabinet-models.ts`
   - 把 `REMOTE_COMMANDS: { hasArg, argHintKey }[]` 换成 `RemoteCommandDef[]`（`arg?: RemoteCommandArg`）。
   - 增 `isArgInvalid` / `commandArgValue` / `argFormatKey` 三个导出纯函数。
   - 17 条指令按 `design.md` §3 映射。
   - `tsc` 会点亮所有旧 `hasArg` 引用（只有页面两处）。
2. **页面**：`src/features/mai2/Maimai2RemoteControlPage.tsx`
   - 加 `argTouched` / `paramsRef` / `argSpec` / `showArgError`。
   - 加切换清理 effect（依赖仅 `[selectedCommand]`）。
   - `send()` 前置校验 + 下发 `commandArgValue(...)`。
   - 渲染：`id`/`htmlFor`、`disabled={!argSpec}`、placeholder 回落、`is-invalid` + `.invalid-feedback d-block`、`aria-*`。
3. **i18n**：`src/i18n/{zh,en}.json` + `public/assets/i18n/{zh,en}.json` 四份，按字母序插入 7 个 key。
4. **测试**：新增 `tests/lcdx-regression/remote-args.spec.ts`。
5. **验证**：`npm run build`、`node scripts/audit-i18n.mjs`（错误集合 baseline diff）、定向 Playwright。
6. **提交**：分批 commit（不 push）。

## 验证命令

```powershell
cd E:\ALL.Net\Project_LCDX_NET\aqua_viewer_lcdx
npm run build
node scripts/audit-i18n.mjs > $env:TEMP\audit-after.json; type $env:TEMP\audit-after.json
./node_modules/.bin/playwright test -c playwright.lcdx.config.ts remote-args.spec.ts --timeout=45000
./node_modules/.bin/playwright test -c playwright.lcdx.config.ts cabinets.spec.ts --timeout=45000
```

- 本机整库跑会在 teardown 挂住；判据是 `test-results/lcdx-regression/` 是否新增失败目录，不看退出码。
- i18n 基线（改动前）：`missing-resource-key` 76 + `public-copy-drift` 76，key 全部是 `CardsPage.Qr*` / `PlayerQrPage.*` / `App.Sidebar.PlayerQr`。

## 提交批次

1. `feat(mai2): 远程控制指令参数契约模型` — `cabinet-models.ts` + 页面（模型与页面必须同一提交，否则中间态编译不过）。
2. `feat(i18n): 远程控制参数提示文案` — 四份 i18n JSON。
3. `test(lcdx): 远程控制参数契约回归` — spec 文件。
4. `chore(task): ...` — trellis 任务归档/日志（用户执行 finish-work 前）。

> 若第 1 批单独提交会破坏 i18n 审计（新 key 未加），则把 1、2 合并为一次提交。

## 回滚点

- 每批提交独立可 revert；无数据迁移、无配置变更。
- 回滚判据：若线上出现“无参指令下发空 `message` 导致机台异常”，单独 revert 第 1 批即可。
