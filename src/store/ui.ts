import { create } from 'zustand'
import { applyTheme, readPrefs, writePrefs, type ThemeChoice } from '@/shared/lib/ui-prefs'

/**
 * Estado GLOBAL DE UI apenas (Zustand). Dado de servidor mora no TanStack Query —
 * misturar os dois é a dívida clássica de cache duplicado.
 */
type UiState = {
  theme: ThemeChoice
  resolvedTheme: 'light' | 'dark'
  sidebarCollapsed: boolean   // desktop: faixa de ícones
  sidebarOpen: boolean        // mobile: drawer
  setTheme: (t: ThemeChoice) => void
  toggleTheme: () => void
  toggleCollapsed: () => void
  setSidebarOpen: (open: boolean) => void
}

const prefs = readPrefs()

export const useUi = create<UiState>((set, get) => ({
  theme: prefs.theme,
  resolvedTheme: applyTheme(prefs.theme),
  sidebarCollapsed: prefs.sidebarCollapsed,
  sidebarOpen: false,

  setTheme: (theme) => {
    const resolvedTheme = applyTheme(theme)
    writePrefs({ theme })
    set({ theme, resolvedTheme })
  },
  toggleTheme: () => get().setTheme(get().resolvedTheme === 'dark' ? 'light' : 'dark'),
  toggleCollapsed: () =>
    set((s) => {
      writePrefs({ sidebarCollapsed: !s.sidebarCollapsed })
      return { sidebarCollapsed: !s.sidebarCollapsed }
    }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}))

/** Quem escolheu 'system' acompanha a troca do SO em tempo real. */
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { theme, setTheme } = useUi.getState()
    if (theme === 'system') setTheme('system')
  })
}
