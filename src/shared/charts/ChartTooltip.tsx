import type { TooltipProps } from 'recharts'

/**
 * Tooltip própria: a do Recharts vem com fundo branco fixo (quebra no tema
 * escuro) e sem controle tipográfico.
 */
export function ChartTooltip({
  active, payload, label, formatar,
}: TooltipProps<number, string> & { formatar?: (v: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="pointer-events-none rounded-lg border border-border bg-surface px-3 py-2 shadow-pop">
      {label != null && <p className="mb-1 text-[12px] font-semibold text-text">{String(label)}</p>}
      <ul className="space-y-0.5">
        {payload.map((item) => (
          <li key={String(item.dataKey)} className="flex items-center gap-2 text-[12px] text-text-secondary">
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: item.color }} />
            <span className="mr-3">{item.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-text">
              {formatar ? formatar(Number(item.value)) : item.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
