# spec repairs: not-found v18 + filterLcsetKeys D13

## Goal

2026-08-24 审计发现的两处测试问题修复（均为陈旧/错误 spec，非产品代码）。

## Requirements

- `not-found.component.spec.ts`：使用了 ngx-translate v18 已删除的 `TranslateModule`，导致 `ng test` 整个套件编译失败（`ng build` 不编译 spec 故未暴露）。改为 v18 写法：`imports: [TranslatePipe]` + `providers: [provideTranslateService()]`
- `bot-permission.service.spec.ts`：`filterLcsetKeys` 用例仍断言第六轮旧设计「P0 拿到 event 子集」，与 v2 D13 实现（P≤3 全空）矛盾；夹具含已废弃的 chevent/hide。重写为「P≤3 空 / P≥4 全量」，夹具换现存 key
- `bot-permission.service.ts`：注释「完整 19 项」改「完整 9 项」

## Acceptance Criteria

- [x] ng test 可编译并执行：NotFoundComponent 与 BotPermissionService 用例全绿
- [x] ng build 零 error

## Notes

- commit: 43c15cd
- 遗留（本任务不处理）：ng test 整体 56 失败/110 通过，全部为约 50 个无关组件 spec 的 TestBed 缺 provider（`_NgxIndexedDBService`/`_TranslateService`/`ActivatedRoute`/`NgbActiveModal`）-- 测试基建在 2026-08-24 之前就已损坏（D13 落地后 filterLcsetKeys 旧断言即矛盾，证明套件早已无人跑绿）
