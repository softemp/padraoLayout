import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface shadow-card',
        'transition-shadow duration-200 hover:shadow-pop',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({
  titulo, descricao, acoes, className,
}: { titulo: ReactNode; descricao?: ReactNode; acoes?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5', className)}>
      <div className="min-w-0">
        <h3 className="truncate text-[15px] font-semibold tracking-tight text-text">{titulo}</h3>
        {descricao && <p className="mt-0.5 text-[13px] text-text-muted">{descricao}</p>}
      </div>
      {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
    </div>
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 sm:p-5', className)} {...props} />
}
