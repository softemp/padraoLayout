import { cn } from '@/shared/lib/cn'
import { money, number as numero, percent } from '@/shared/lib/format'
import type { Kpi } from '@/shared/api/types'
import { Sparkline } from './Sparkline'

const formatadores = { moeda: money, numero: numero, percentual: percent }

/**
 * Um número em destaque NÃO é um gráfico de uma barra: é um stat tile.
 * Contrato: rótulo · valor · variação (com período nomeado) · sparkline.
 * A cor do delta segue a DIREÇÃO combinada com o que é bom naquele indicador
 * (churn caindo é verde), e vem sempre com seta + texto — nunca cor sozinha.
 */
export function StatTile({ kpi }: { kpi: Kpi }) {
  const subiu = kpi.delta >= 0
  const bom = kpi.deltaBom === 'subir' ? subiu : !subiu
  const valor = formatadores[kpi.formato](kpi.valor)

  return (
    <div className="rounded-xl border border-border bg-surface p-2 shadow-card transition-shadow sm:p-4 lg:p-6 duration-200 hover:shadow-pop">
      <p className="truncate text-[13px] font-medium text-text-muted">{kpi.label}</p>

      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold tracking-tight text-text tabular-nums lg:text-[28px] lg:leading-8">
          {valor}
        </p>
        <Sparkline pontos={kpi.serie} positivo={bom} className="h-8 w-[86px] shrink-0" />
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 text-[13px]">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold tabular-nums',
            bom ? 'bg-good/12 text-good' : 'bg-critical/12 text-critical',
          )}
        >
          <span aria-hidden>{subiu ? '↑' : '↓'}</span>
          {percent(Math.abs(kpi.delta))}
        </span>
        <span className="truncate text-text-muted">vs. mês anterior</span>
      </div>
    </div>
  )
}
