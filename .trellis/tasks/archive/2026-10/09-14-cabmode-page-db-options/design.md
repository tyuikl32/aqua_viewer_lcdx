# Design — cabmode page DB options

## Data

```ts
interface CabModeItem { id: number; name: string; level: number }
```

- 来源：`ApiService.getLcdx('lcdx/cabinet/modes/' + userName)`
- `LC_MODES` 保留为 fallback（API 失败）

## Display filter

```
visibleModes = cabModes.filter(m => (info?.level ?? -Infinity) >= m.level)
```

切换机台时 `info` 刷新 → 过滤自动生效。

## Label formatting

```
displayWidth(s): CJK/fullwidth = 2, else 1
formatModeButtonLabel(name):
  if width <= 16 → name
  lastSpace = name.lastIndexOf(' ')
  if lastSpace > 0 → name.slice(0, lastSpace) + '\n' + name.slice(lastSpace+1)
  else → name
```

模板绑定 `{{ formatModeButtonLabel(m.name) }}`，按钮 `white-space: pre-line`。

## Current mode

```
currentModeLabel(): 
  id = info?.isSpecialMode
  name = cabModes.find(m => m.id === id)?.name
  name ? `${id}（${name}）` : String(id)
```

回退路径用 i18n Mode* key 取名。

## Files

| File | Change |
|---|---|
| `model/CabinetModels.ts` | + CabModeItem |
| `maimai2-cabmode.component.ts` | loadCabModes, filters, formatters |
| `maimai2-cabmode.component.html` | buttons + current mode |
| `maimai2-cabmode.component.css` | pre-line / max-width |
