# 实施清单（前端）

1. `src/features/mai2/Maimai2LocksPage.tsx`
   - `const ACTIONS = [...]` 追加 `'dxnum-query'`
2. 验证：`npm run build` → 定向 Playwright（`dxnum.spec.ts guards.spec.ts permissions.spec.ts`，用 Start-Process + WaitForExit + Kill 包裹）
3. 提交：路径限定 `git add src/features/mai2/Maimai2LocksPage.tsx`（不 push）
