export const THEME_FAMILIES = [
  {
    id: 'legacy',
    labelKey: 'App.Footer.Legacy',
    statusBar: { light: '#f9fafa', dark: '#2a2f33' },
  },
  {
    id: 'liquefy',
    labelKey: 'App.Footer.Liquefy',
    statusBar: { light: '#eefbff', dark: '#101c28' },
  },
  {
    id: 'animal-island',
    labelKey: 'App.Footer.AnimalIsland',
    statusBar: { light: '#f8f8f0', dark: '#26251f' },
  },
] as const;

export type ThemeFamily = (typeof THEME_FAMILIES)[number]['id'];

export function isThemeFamily(value: unknown): value is ThemeFamily {
  return THEME_FAMILIES.some((theme) => theme.id === value);
}

export function getThemeFamily(family: ThemeFamily) {
  return THEME_FAMILIES.find((theme) => theme.id === family)!;
}
