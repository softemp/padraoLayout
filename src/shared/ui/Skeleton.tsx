import { cn } from '@/shared/lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4 w-full', className)} />
}

export function SkeletonLinhas({ linhas = 5, colunas = 5 }: { linhas?: number; colunas?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: colunas }).map((_, j) => (
            <Skeleton key={j} className={cn('h-5', j === 0 ? 'w-1/3' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  )
}
