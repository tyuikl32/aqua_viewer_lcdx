# 线上未生效核查（2026-10-12 02:20）

## 结论

**「已部署」的那次部署构建的是「已提交的代码」，而修法 A 当时还躺在工作区没提交**
⇒ 线上 `.liquefy-toast` 仍然是 `min-height: 4.1rem`，盒子依旧 65.6px、上下留白 1.7:1。

## 三方对比（同一时刻取证）

| 项 | 线上 `lcdxnet.am-allnet.com` | 本机 `dist/`（01:46 本地构建） | HEAD 提交 `8fdd6b3`（CI 构建的源） |
| --- | --- | --- | --- |
| 引用 CSS | `index-Cxd9SGKM.css` | **`index-B-CkFpsO.css`** | （构建产物） |
| 引用 JS | `index-CK0O2kd5.js` | `index-DO478Nay.js` | （构建产物） |
| `.liquefy-toast` 的 `min-height` | **`4.1rem`** | **`3.4rem`** ✅ | **`4.1rem`** ❌ |
| `min-height:3.4rem` 出现次数 | **0** | 1 | 0 |

线上 CSS 实拉取证（走 `127.0.0.1:7897` 代理）：

```bash
curl -x http://127.0.0.1:7897 -o /tmp/lcdx-prod.css https://lcdxnet.am-allnet.com/assets/index-Cxd9SGKM.css
grep -o "liquefy-toast{[^}]*}" /tmp/lcdx-prod.css | tail -1
#   → …{backdrop-filter:blur(22px)saturate(1.55);min-height:4.1rem;padding:1rem 1.1rem}
grep -c "min-height:3.4rem" /tmp/lcdx-prod.css   # → 0
```

## 时间线（对得上）

| 时间 | 事件 |
| --- | --- |
| 01:0x | 我在工作区把 `liquefy.css` 的 `min-height` 改成 `3.4rem`（**未提交**） |
| 01:46 | 本机 `npm run build` → `dist/assets/index-B-CkFpsO.css`（**含修复**） |
| 01:55 | `8fdd6b3`「chore(task): archive 10-12-preload-resilience」提交（仅归档文件，**不含修复**） |
| 02:03 | push → **CI #66 成功**（`head_sha 8fdd6b3`）→ scp → `docker cp … nginx:/var/www/portal` |
| 02:16 | 生产仍 65px（截图实测盒高 65px、左缘 x=18、四角 r≈16px —— 与修复前完全一致） |

旁证：线上 CSS 文件名 `index-Cxd9SGKM.css` 与「**未含修复**的构建」产物同名（CSS 哈希只由 CSS 内容决定），
而含修复的构建产物名是 `index-B-CkFpsO.css` —— 两者不同，说明线上绝不是那份新产物。

## 部署链路（`.github/workflows/deploy-test-server.yml`）

```
push master → npm ci → npm run build → tar dist → scp /root/ → ssh:
  rm -rf dist && tar -xzf dist.tar.gz && docker exec nginx rm -rf /var/www/portal
  && docker cp /root/dist nginx:/var/www/portal
```

## 让修复生效的两条路

**A. 走 CI（推荐、最干净）**
```bash
git add src/styles/theme/liquefy.css        # 只提这一处修复
git commit -m "fix(liquefy): toast 上下留白对称（min-height 4.1rem → 3.4rem）"
git push origin master                      # 触发 CI #67 → 自动构建+部署
```

**B. 手上有服务器权限，想立刻生效**
按 CI 的同样步骤把手上的 `dist/`（含 `index-B-CkFpsO.css`）覆盖上去：
`scp` 到 `/root/` → `docker exec nginx rm -rf /var/www/portal` → `docker cp /root/dist nginx:/var/www/portal`。

部署后建议 Ctrl+F5 硬刷新一次（PWA service worker 可能仍持有旧 `index.html`）。

## 复现量测（截图 `clipboard-2026-10-11T18-16-21-753Z-db3ed782.png`）

逐行扫 teal 掩码：盒子 y=13..77 → **高 65px**；左缘 x=18（y=25..67 恒定）；四角内收 10/11px（r≈16px）→
**与修复前 100% 一致**；若修复生效应为 **54.4px**（`3.4rem`）。
