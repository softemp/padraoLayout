import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { money, moneyCompact } from '@/shared/lib/format'
import { categorias } from '@/shared/api/mock-db'
import { ChartCard, TabelaDoGrafico } from './ChartCard'
import { ChartTooltip } from './ChartTooltip'
import { eixoBase, useChartTokens } from './tokens'

/**
 * Comparação de magnitude entre categorias nominais: UMA cor para todas as
 * barras. Pintar cada barra de um tom diferente (ou mais escura onde é maior)
 * gasta o canal de cor repetindo o que o comprimento já diz.
 * Horizontal porque os rótulos são longos.
 */
export function CategoriasBarras() {
  const t = useChartTokens()
  const dados = [...categorias].sort((a, b) => b.valor - a.valor)

  return (
    <ChartCard
      titulo="Receita por linha de produto"
      descricao="Mês corrente"
      tabela={<TabelaDoGrafico colunas={['Linha', 'Receita']} linhas={dados.map((d) => [d.categoria, money(d.valor)])} />}
    >
      <div className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 62, bottom: 4, left: 4 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="categoria"
              {...eixoBase(t.textoMuted)}
              width={104}
              interval={0}
            />
            <Tooltip cursor={{ fill: t.grid, fillOpacity: 0.35 }} content={<ChartTooltip formatar={money} />} />
            <Bar
              dataKey="valor"
              name="Receita"
              fill={t.serie[0]}
              radius={[0, 4, 4, 0]}
              maxBarSize={22}
              isAnimationActive={false}
            >
              {/* Valor na ponta da barra (fora dela): nunca cortado pela marca. */}
              <LabelList
                dataKey="valor"
                position="right"
                offset={8}
                formatter={(v: number) => moneyCompact(v)}
                style={{ fill: t.textoMuted, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
