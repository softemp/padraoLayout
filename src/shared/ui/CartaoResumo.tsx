import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { Skeleton } from './Skeleton'

/**
 * O cartão de número que abre quase toda página de módulo.
 *
 * Existia copiado em 14 telas — e foi exatamente por isso que o espaçamento
 * derivou (p-4 aqui, p-3 ali, gap-3 numa grade e gap-4 na outra). Superfície
 * repetida é superfície que diverge: a régua canônica 2 → 4 → 6 só se sustenta
 * quando mora em UM componente.
 */
export function GradeResumo({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn('grid grid-cols-2 gap-2 sm:gap-4 lg:gap-6 xl:grid-cols-4', className)}
      {...props}
    />
  )
}

export function CartaoResumo({
  rotulo, valor, nota, destaque, larguraSkeleton = 'w-24', className,
}: {
  rotulo: ReactNode
  /** `null`/`undefined` = ainda carregando: o cartão mostra o esqueleto no lugar do número. */
  valor: ReactNode
  nota?: ReactNode
  /** Classe de cor do número (`text-good`, `text-critical`…). */
  destaque?: string
  larguraSkeleton?: string
  className?: string
}) {
  return (
    <div className={cn('rounded-xl border border-border bg-surface p-2 shadow-card sm:p-4 lg:p-6', className)}>
      <p className="text-[13px] font-medium text-text-muted">{rotulo}</p>
      {valor === null || valor === undefined ? (
        <Skeleton className={cn('mt-2 h-7', larguraSkeleton)} />
      ) : (
        <p className={cn('mt-1 text-xl font-semibold tabular-nums lg:text-2xl', destaque ?? 'text-text')}>{valor}</p>
      )}
      {nota && <p className="mt-1 text-[12px] text-text-muted">{nota}</p>}
    </div>
  )
}
