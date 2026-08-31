import { useState, type ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { Card, CardHeader } from '@/shared/ui/Card'

export type LegendaItem = { rotulo: string; cor: string }

/**
 * Moldura de gráfico com LEGENDA sempre presente (2+ séries) e alternância
 * gráfico ↔ tabela. A tabela não é enfeite: é a compensação exigida quando
 * uma cor de série fica abaixo de 3:1 na superfície clara, e é o caminho de
 * quem usa leitor de tela.
 */
export function ChartCard({
  titulo, descricao, legenda, acoes, tabela, className, children,
}: {
  titulo: string
  descricao?: string
  legenda?: LegendaItem[]
  acoes?: ReactNode
  tabela: ReactNode
  className?: string
  children: ReactNode
}) {
  const [modo, setModo] = useState<'grafico' | 'tabela'>('grafico')

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader
        titulo={titulo}
        descricao={descricao}
        acoes={
          <>
            {acoes}
            <div role="tablist" aria-label="Modo de exibição" className="flex rounded-lg border border-border p-0.5">
              {(['grafico', 'tabela'] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={modo === m}
                  onClick={() => setModo(m)}
                  className={cn(
                    'rounded-md px-2 py-1 text-[12px] font-medium transition-colors',
                    modo === m ? 'bg-surface-3 text-text' : 'text-text-muted hover:text-text',
                  )}
                >
                  {m === 'grafico' ? 'Gráfico' : 'Tabela'}
                </button>
              ))}
            </div>
          </>
        }
      />

      {legenda && legenda.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 pt-3 sm:px-5">
          {legenda.map((l) => (
            <span key={l.rotulo} className="inline-flex items-center gap-1.5 text-[12px] text-text-secondary">
              {/* Identidade vem do marcador colorido AO LADO do texto — o texto
                  nunca veste a cor da série. */}
              <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: l.cor }} />
              {l.rotulo}
            </span>
          ))}
        </div>
      )}

      <div className="flex-1 p-2 pt-3 sm:p-4">
        {modo === 'grafico' ? children : <div className="overflow-x-auto">{tabela}</div>}
      </div>
    </Card>
  )
}

/** Tabela-espelho do gráfico (mesmos números, sem depender de cor). */
export function TabelaDoGrafico({ colunas, linhas }: { colunas: string[]; linhas: (string | number)[][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border">
          {colunas.map((c, i) => (
            <th key={c} className={cn('px-2 py-2 text-[12px] font-semibold uppercase tracking-wide text-text-muted', i === 0 ? 'text-left' : 'text-right')}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map((linha, i) => (
          <tr key={i} className="border-b border-border/60 last:border-0">
            {linha.map((celula, j) => (
              <td key={j} className={cn('px-2 py-1.5 text-text-secondary', j === 0 ? 'text-left font-medium text-text' : 'text-right tabular-nums')}>
                {celula}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
