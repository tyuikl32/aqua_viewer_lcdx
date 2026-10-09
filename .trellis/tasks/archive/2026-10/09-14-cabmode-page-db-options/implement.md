# Implement

1. [x] `CabModeItem` / `CabinetModesResponse` 模型
2. [x] `loadCabModes` + `visibleModes`（机台 level 过滤）
3. [x] `formatModeButtonLabel` 换行 + `currentModeLabel`
4. [x] 模板/按钮 CSS
5. [x] `npm run build` 通过
6. [x] commit —— `edc5b43`（feat: cabmode 选项由 CabmodeList 目录驱动）+ `b4c7767`（居中等 UI 打磨），
   均已在 `master`（2026-10-10 复核：`git merge-base --is-ancestor` 通过）。
   React 移植版对应物：`src/features/mai2/cabinet-models.ts`（CabmodeList/visibleModes）+
   `Maimai2CabmodePage.tsx`，已随 2026-10-09 master adoption 进入 master。

> 任务本体是 Angular 时代的实现（2026-09-14），其意图已在 React 版延续；
> 勾选与结项复核于 2026-10-10 完成，任务关闭。
