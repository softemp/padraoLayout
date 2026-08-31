import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside'

/**
 * Menu suspenso acessível: fecha ao clicar fora, no Esc e ao navegar;
 * `aria-expanded` no gatilho e navegação por ↑/↓ nos itens.
 */
export function Dropdown({
  gatilho, children, align = 'right', largura = 'w-64', rotuloGatilho,
}: {
  gatilho: (aberto: boolean) => ReactNode
  children: (fechar: () => void) => ReactNode
  align?: 'left' | 'right'
  largura?: string
  rotuloGatilho: string
}) {
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const painel = useRef<HTMLDivElement>(null)

  useOnClickOutside(raiz, () => setAberto(false), aberto)

  // ↑/↓ percorre os itens do painel; Esc devolve o foco ao gatilho.
  useEffect(() => {
    if (!aberto) return
    const nav = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const itens = painel.current?.querySelectorAll<HTMLElement>('[data-item]')
      if (!itens?.length) return
      e.preventDefault()
      const atual = Array.from(itens).indexOf(document.activeElement as HTMLElement)
      const proximo = e.key === 'ArrowDown' ? (atual + 1) % itens.length : (atual - 1 + itens.length) % itens.length
      itens[proximo]?.focus()
    }
    document.addEventListener('keydown', nav)
    return () => document.removeEventListener('keydown', nav)
  }, [aberto])

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={rotuloGatilho}
        onClick={() => setAberto((v) => !v)}
        className="flex items-center rounded-lg outline-none transition-colors"
      >
        {gatilho(aberto)}
      </button>

      {aberto && (
        <div
          ref={painel}
          role="menu"
          className={cn(
            'absolute z-40 mt-2 origin-top overflow-hidden rounded-xl border border-border',
            'bg-surface shadow-pop animate-slide-down',
            align === 'right' ? 'right-0' : 'left-0',
            largura,
            // No mobile o painel nunca ultrapassa a viewport.
            'max-w-[calc(100vw-1.5rem)]',
          )}
        >
          {children(() => setAberto(false))}
        </div>
      )}
    </div>
  )
}

export function DropdownItem({
  icone, children, onClick, tom = 'padrao',
}: { icone?: string; children: ReactNode; onClick?: () => void; tom?: 'padrao' | 'critico' }) {
  return (
    <button
      type="button"
      data-item
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
        tom === 'critico'
          ? 'text-critical hover:bg-critical/10'
          : 'text-text-secondary hover:bg-surface-2 hover:text-text',
      )}
    >
      {icone && <span aria-hidden className="w-4 text-center text-[13px]">{icone}</span>}
      {children}
    </button>
  )
}
