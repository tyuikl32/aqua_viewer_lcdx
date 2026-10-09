# Implement — route document title localization

Order matters only for reviewability; all steps land in one branch.

## Step 1 — i18n keys first

Add the five new keys from design.md §3 to **all four** locale files:
`src/i18n/zh.json`, `src/i18n/en.json`, `public/assets/i18n/zh.json`, `public/assets/i18n/en.json`.
Keep each locale pair byte-identical per language (`src` copy and `public` copy of the same
language must stay identical) and keep alphabetical order inside the touched objects.

## Step 2 — `src/router.tsx`

Replace every `handle.title` value with the key from design.md §2. Do not touch `path`, `element`,
guards, `disableSidebar`, `accessLayout`. Add a one-line comment above `RouteHandle` noting
`title` is now an i18n key.

## Step 3 — `src/components/shell/AppShell.tsx`

Rewrite `BootEffects` per design.md §1: translate with `t()`, add `i18n.language` to the effect
dependencies. Nothing else in `AppShell` changes.

## Step 4 — Verification (must all pass before quality check)

```bash
# 4a. every handle.title resolves in zh + en, and both i18n copies agree
node - <<'EOF'
const fs = require('fs');
const src = fs.readFileSync('src/router.tsx', 'utf8');
const keys = [...src.matchAll(/title:\s*'([^']+)'/g)].map((m) => m[1]);
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) =>
  typeof v === 'object' && v ? flat(v, p + k + '.') : [p + k]);
const load = (f) => new Set(flat(JSON.parse(fs.readFileSync(f, 'utf8'))));
const zh = load('src/i18n/zh.json'), en = load('src/i18n/en.json');
const pzh = load('public/assets/i18n/zh.json'), pen = load('public/assets/i18n/en.json');
let bad = 0;
for (const k of keys) {
  for (const [name, set] of [['zh', zh], ['en', en], ['public/zh', pzh], ['public/en', pen]]) {
    if (!set.has(k)) { console.log('MISSING', name, k); bad++; }
  }
}
console.log(`checked ${keys.length} route titles, ${bad} missing`);
if (bad) process.exit(1);
EOF

# 4b. no raw English display token left in route handles
grep -n "title: '" src/router.tsx

# 4c. lint + build
npm run lint
npm run build
```

## Step 5 — Manual spot-check (dev server)

`npm run dev`, then confirm the tab text equals the page heading:

| URL | expected tab (zh) |
|---|---|
| `/dashboard` | `仪表板 \| NET` |
| `/mai2/profile` | `档案 - 舞萌DX \| NET` |
| `/mai2/locks` | `操作记录与授权 - 舞萌DX \| NET` |
| `/chuni/v2/userbox` | `收藏品 - 中二节奏NEW \| NET` |
| `/not-found` | `页面未找到 \| NET` |
| `/sign-in` | `登录 \| NET` |

And flip the footer language selector zh↔en on `/mai2/profile`: the tab must change to
`Profile - Maimai DX | NET` **without** reloading.

## Commit plan (incremental, no push)

1. `fix(i18n): localize route document titles` — `src/router.tsx`, `src/components/shell/AppShell.tsx`,
   the four locale JSON files.
2. `docs(trellis)`: planning artifacts / spec note / journal as they land.
