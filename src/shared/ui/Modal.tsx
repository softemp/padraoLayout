import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/shared/lib/cn'

/**
 * Diálogo do kit: portal na raiz do <body>, fecha no Esc e no clique fora,
 * trava a rolagem de fundo e devolve o foco a quem o abriu. Um único lugar
 * com essas regras — modal reimplementado por tela é onde a acessibilidade
 * se perde.
 */
export function Modal({
  aberto, titulo, descricao, children, rodape, onFechar, largura = 'max-w-lg',
}: {
  aberto: boolean
  titulo: string
  descricao?: ReactNode
  children?: ReactNode
  rodape?: ReactNode
  onFechar: () => void
  largura?: string
}) {
  const caixa = useRef<HTMLDivElement>(null)
  const focoAnterior = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!aberto) return
    focoAnterior.current = document.activeElement as HTMLElement

    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
      // Foco preso dentro do diálogo enquanto ele estiver aberto.
      if (e.key === 'Tab' && caixa.current) {
        const focaveis = caixa.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (!focaveis.length) return
        const primeiro = focaveis[0]
        const ultimo = focaveis[focaveis.length - 1]
        if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus() }
        if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus() }
      }
    }

    const rolagem = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', tecla)

    const id = requestAnimationFrame(() =>
      caixa.current?.querySelector<HTMLElement>('[data-foco-inicial], input, button')?.focus(),
    )

    return () => {
      cancelAnimationFrame(id)
      document.removeEventListener('keydown', tecla)
      document.body.style.overflow = rolagem
      focoAnterior.current?.focus()
    }
  }, [aberto, onFechar])

  if (!aberto) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-overlay/55 animate-fade-in" onClick={onFechar} aria-hidden />

      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={cn(
          'relative w-full overflow-hidden rounded-t-2xl border border-border bg-surface shadow-pop',
          'animate-slide-down sm:rounded-2xl',
          largura,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-text">{titulo}</h2>
            {descricao && <div className="mt-1 text-[13px] text-text-muted">{descricao}</div>}
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="-mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        {children && <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>}
        {rodape && <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-surface-2/60 px-5 py-3.5">{rodape}</div>}
      </div>
    </div>,
    document.body,
  )
}
