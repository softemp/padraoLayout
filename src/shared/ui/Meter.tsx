import { cn } from '@/shared/lib/cn'
import { percent } from '@/shared/lib/format'

/**
 * Razão contra um limite: barra de progresso, não pizza de duas fatias.
 * O trilho é um degrau mais claro da MESMA rampa (azul sobre azul).
 */
export function Meter({
  rotulo, valor, total, formatar, className,
}: { rotulo: string; valor: number; total: number; formatar: (n: number) => string; className?: string }) {
  const razao = total > 0 ? valor / total : 0
  const largura = Math.min(razao, 1) * 100
  const atingiu = razao >= 1

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-text-secondary">{rotulo}</span>
        <span className="text-[13px] font-semibold tabular-nums text-text">{percent(razao)}</span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={Math.round(razao * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={rotulo}
        className="h-2 w-full overflow-hidden rounded-full bg-primary-soft"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', atingiu ? 'bg-good' : 'bg-primary')}
          style={{ width: `${largura}%` }}
        />
      </div>

      <p className="text-[12px] text-text-muted">
        <span className="font-medium text-text-secondary">{formatar(valor)}</span> de {formatar(total)}
        {atingiu && <span className="ml-1.5 font-medium text-good">· meta batida ✔</span>}
      </p>
    </div>
  )
}
