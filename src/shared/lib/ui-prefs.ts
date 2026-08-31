/**
 * ÚNICO ponto de acesso ao localStorage do projeto.
 * Preferência cosmética (tema, sidebar) pode persistir; TOKEN NUNCA.
 * Centralizar aqui é o que torna a regra verificável por lint/grep.
 */
export type ThemeChoice = 'light' | 'dark' | 'system'

export type UiPrefs = {
  theme: ThemeChoice
  sidebarCollapsed: boolean
  tablePageSize: number
}

const KEY = 'ui-prefs'
const DEFAULTS: UiPrefs = { theme: 'system', sidebarCollapsed: false, tablePageSize: 10 }

export function readPrefs(): UiPrefs {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<UiPrefs>) }
  } catch {
    return DEFAULTS
  }
}

export function writePrefs(patch: Partial<UiPrefs>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readPrefs(), ...patch }))
  } catch {
    /* storage indisponível (aba anônima, cota) — a UI segue com o default */
  }
}

/** Resolve 'system' contra o SO e carimba data-theme no <html>. */
export function applyTheme(choice: ThemeChoice) {
  const dark =
    choice === 'dark' ||
    (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  return dark ? 'dark' : 'light'
}
