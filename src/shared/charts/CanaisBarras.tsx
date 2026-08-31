import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { number } from '@/shared/lib/format'
import { serieCanais } from '@/shared/api/mock-db'
import { ChartCard, TabelaDoGrafico } from './ChartCard'
import { ChartTooltip } from './ChartTooltip'
import { eixoBase, useChartTokens } from './tokens'

/**
 * Parte-do-todo por mês: barra empilhada com TRÊS séries (as três primeiras
 * matizes da ordem fixa — o trio que passa a validação em todos os pares).
 *
 * Segmentos são separados por um VÃO de 2px na cor da superfície, nunca por
 * uma borda desenhada em volta da marca.
 */
type SegmentoProps = {
  x?: number; y?: number; width?: number; height?: number; fill?: string; topo?: boolean
}

function Segmento({ x = 0, y = 0, width = 0, height = 0, fill, topo }: SegmentoProps) {
  if (height <= 0) return null
  const alturaVisivel = Math.max(height - 2, 0.5) // o vão de 2px vive aqui
  const r = topo ? 4 : 0                          // ponta arredondada só na extremidade do dado
  return <rect x={x} y={y + 2} width={width} height={alturaVisivel} rx={r} ry={r} fill={fill} />
}

export function CanaisBarras() {
  const t = useChartTokens()
  const series = [
    { key: 'organico', rotulo: 'Orgânico', cor: t.serie[0] },
    { key: 'indicacao', rotulo: 'Indicação', cor: t.serie[1] },
    { key: 'midiaPaga', rotulo: 'Mídia paga', cor: t.serie[2] },
  ] as const

  return (
    <ChartCard
      titulo="Aquisição por canal"
      descricao="Novos clientes por mês, por origem"
      legenda={series.map((s) => ({ rotulo: s.rotulo, cor: s.cor }))}
      tabela={
        <TabelaDoGrafico
          colunas={['Mês', 'Orgânico', 'Indicação', 'Mídia paga', 'Total']}
          linhas={serieCanais.map((l) => [
            l.mes, number(l.organico), number(l.indicacao), number(l.midiaPaga),
            number(l.organico + l.indicacao + l.midiaPaga),
          ])}
        />
      }
    >
      <div className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={serieCanais} margin={{ top: 16, right: 16, bottom: 4, left: 4 }} barCategoryGap="34%">
            <CartesianGrid stroke={t.grid} strokeWidth={1} vertical={false} />
            <XAxis dataKey="mes" {...eixoBase(t.textoMuted)} dy={6} />
            <YAxis {...eixoBase(t.textoMuted)} width={38} />
            <Tooltip cursor={{ fill: t.grid, fillOpacity: 0.35 }} content={<ChartTooltip formatar={number} />} />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.rotulo}
                stackId="canais"
                fill={s.cor}
                maxBarSize={24}
                isAnimationActive={false}
                shape={<Segmento topo={i === series.length - 1} />}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
