# 登录成功 toast 上窄下宽排查

## Goal

查清用户报告的「'登录成功' 提示框上窄下宽，是不是多了个换行」的真实成因，并给出可执行的结论：
要么定位到产生该形态的具体规则，要么用证据链说明在当前 master 上不可复现。

本任务先做**诊断**，不擅自改代码（用户原话：「建 trellis 任务看看」）。

## Requirements

- 必须逐字节确认成功提示的文案资源，判定是否存在多余换行。
- 必须在**三个主题族**（liquefy / animal-island / legacy）× 明暗 × 桌面(1440)/移动(390) 下给出 toast 的真实几何（宽、高、消息行数、消息可用宽）。
- 若确认为缺陷：修在**主题作用域**内，不得动 Bootstrap 类名契约与其它主题。
- 若为「多了一行」类问题：必须在源头（i18n 资源或调用点）修，禁止用 CSS 掩盖。

## Acceptance Criteria

- [ ] 出结论：成功提示文案是否含换行（附文件路径 + 行列证据）
- [ ] 出结论：当前 master 在 3 主题 × 2 视口下能否复现「上窄下宽」（附实测数字/截图）
- [ ] 若能复现：定位到具体 CSS/DOM 规则，给出修复方案并回归
- [ ] 若不能复现：记录证据链、需用户补充的信息（主题族 / 视口 / 截图），归档或挂起

## Open Questions（当前阻塞）

1. 用户当时用的是哪个主题族？（默认 `liquefy`，另有 `animal-island`、`legacy`）
2. 视口情境？桌面浏览器窗口宽度？还是手机/PWA？
3. 能否提供截图？—— 描述与实测结果存在冲突（见 `research/toast-shape-forensics.md`），截图可一分钟定位。

## Notes

- 已核实：`SignInPage.LoginSuccessMessage` = `登录成功`（4 字，无换行），且 toast 容器最小可用宽 ≥ 350px，
  4 个汉字（≈60px）在任何主题族下都**不可能折行** —— 因此「上窄下宽」大概率不是换行造成的。
- 诊断证据与复现配方见 `research/toast-shape-forensics.md`；探针脚本在 `.artifacts/probe-toast-shape.*`（已 gitignore）。
- 附带发现一处**真实**几何缺陷（非本次症状）：移动端 390px 下 liquefy toast 左缘越界约 6px，
  见 forensics「附带发现」，待用户决定是否并入修复。
