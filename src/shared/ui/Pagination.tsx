import { cn } from '@/shared/lib/cn'
import { number } from '@/shared/lib/format'

/** Janela de páginas com elipse — nunca 40 botões numa tela de 400 páginas. */
function janela(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const paginas: (number | '…')[] = [1]
  const inicio = Math.max(2, page - 1)
  const fim = Math.min(totalPages - 1, page + 1)
  if (inicio > 2) paginas.push('…')
  for (let p = inicio; p <= fim; p++) paginas.push(p)
  if (fim < totalPages - 1) paginas.push('…')
  paginas.push(totalPages)
  return paginas
}

export function Pagination({
  page, totalPages, total, perPage, onPage,
}: { page: number; totalPages: number; total: number; perPage: number; onPage: (p: number) => void }) {
  const primeiro = total === 0 ? 0 : (page - 1) * perPage + 1
  const ultimo = Math.min(page * perPage, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[13px] text-text-muted">
        <span className="font-medium text-text-secondary">{number(primeiro)}–{number(ultimo)}</span> de{' '}
        <span className="font-medium text-text-secondary">{number(total)}</span>
      </p>

      <nav aria-label="Paginação" className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
          className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-border px-2 text-[13px] text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <span aria-hidden>‹</span>
        </button>

        {janela(page, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} aria-hidden className="px-1 text-[13px] text-text-muted">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[13px] transition-colors',
                p === page
                  ? 'bg-primary font-semibold text-text-inverse'
                  : 'border border-border text-text-secondary hover:bg-surface-2',
              )}
            >
              {p}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          aria-label="Próxima página"
          className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-border px-2 text-[13px] text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <span aria-hidden>›</span>
        </button>
      </nav>
    </div>
  )
}
