import type { ReactNode } from 'react'

export function EmptyState({
  icone = '🗂️', titulo, descricao, acao,
}: { icone?: string; titulo: string; descricao?: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span aria-hidden className="text-3xl opacity-80">{icone}</span>
      <div className="space-y-1">
        <p className="text-[15px] font-semibold text-text">{titulo}</p>
        {descricao && <p className="mx-auto max-w-prose text-sm text-text-muted">{descricao}</p>}
      </div>
      {acao}
    </div>
  )
}
