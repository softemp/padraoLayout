import { useLocation } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { useUi } from '@/store/ui'
import { NotificationBell } from './NotificationBell'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'
import { ehPai, navegacao } from '@/app/navigation'

/** Título da página derivado da navegação (uma fonte só para menu e navbar). */
function tituloDaRota(pathname: string) {
  for (const secao of navegacao) {
    for (const item of secao.itens) {
      if (!ehPai(item)) {
        if (item.rota.split('?')[0] === pathname) return item.rotulo
      } else {
        const filho = item.filhos.find((f) => f.rota.split('?')[0] === pathname)
        if (filho) return `${item.rotulo} · ${filho.rotulo}`
      }
    }
  }
  return 'Painel'
}

export function Navbar() {
  const { pathname } = useLocation()
  const setSidebarOpen = useUi((s) => s.setSidebarOpen)

  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border',
        'bg-surface/85 px-2 backdrop-blur-sm sm:px-4 lg:px-6',
      )}
    >
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        aria-label="Abrir menu"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-2 hover:text-text md:hidden"
      >
        <span aria-hidden>☰</span>
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-tight text-text">{tituloDaRota(pathname)}</p>
      </div>

      {/* Busca global — some no mobile, onde o espaço vale mais que o atalho. */}
      <label className="relative hidden lg:block">
        <span className="sr-only">Buscar no sistema</span>
        <span aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-text-muted">🔍</span>
        <input
          type="search"
          placeholder="Buscar…"
          className="h-9 w-56 rounded-lg border border-border bg-surface-2 pl-8 pr-3 text-[13px] text-text placeholder:text-text-muted focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/25 xl:w-72"
        />
      </label>

      <div className="flex items-center gap-0.5 sm:gap-1">
        <ThemeToggle />
        <NotificationBell />
        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
        <UserMenu />
      </div>
    </header>
  )
}
