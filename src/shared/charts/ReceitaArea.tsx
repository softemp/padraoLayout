import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { moneyCompact, money } from '@/shared/lib/format'
import { serieReceita } from '@/shared/api/mock-db'
import { ChartCard, TabelaDoGrafico } from './ChartCard'
import { ChartTooltip } from './ChartTooltip'
import { eixoBase, useChartTokens } from './tokens'

/**
 * Tendência no tempo: UMA série é o assunto (receita) e a meta é contexto —
 * padrão de ÊNFASE (1 matiz + cinza), não duas séries competindo por atenção.
 * Um eixo só: nunca dois eixos y no mesmo gráfico.
 */
export function ReceitaArea() {
  const t = useChartTokens()
  const ultimo = serieReceita[serieReceita.length - 1]

  return (
    <ChartCard
      titulo="Receita mensal"
      descricao="Últimos 12 meses · realizado contra a meta"
      legenda={[
        { rotulo: 'Receita realizada', cor: t.serie[0] },
        { rotulo: 'Meta', cor: t.serieMuted },
      ]}
      tabela={
        <TabelaDoGrafico
          colunas={['Mês', 'Receita', 'Meta']}
          linhas={serieReceita.map((l) => [l.mes, money(l.receita), money(l.meta)])}
        />
      }
    >
      <div className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={serieReceita} margin={{ top: 16, right: 16, bottom: 4, left: 4 }}>
            <defs>
              {/* Área é um leve véu (~10%), nunca um bloco saturado. */}
              <linearGradient id="grad-receita" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={t.serie[0]} stopOpacity={0.16} />
                <stop offset="100%" stopColor={t.serie[0]} stopOpacity={0.01} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke={t.grid} strokeWidth={1} vertical={false} />
            <XAxis dataKey="mes" {...eixoBase(t.textoMuted)} dy={6} />
            <YAxis
              {...eixoBase(t.textoMuted)}
              width={58}
              tickFormatter={(v: number) => moneyCompact(v)}
            />
            <Tooltip
              cursor={{ stroke: t.grid, strokeWidth: 1 }}
              content={<ChartTooltip formatar={money} />}
            />

            <Area
              type="monotone"
              dataKey="receita"
              name="Receita realizada"
              stroke={t.serie[0]}
              strokeWidth={2}
              fill="url(#grad-receita)"
              // Animação de entrada em SVG grande é o gatilho da distorção de
              // GPU em WebView — desligada por padrão.
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: t.superficie }}
            />
            <Line
              type="monotone"
              dataKey="meta"
              name="Meta"
              stroke={t.serieMuted}
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Rótulo direto: só o ponto que importa (o último), nunca em todo ponto. */}
      <p className="px-2 pt-1 text-[12px] text-text-muted">
        Agosto fechou em <span className="font-semibold text-text">{money(ultimo.receita)}</span> ·{' '}
        {ultimo.receita >= ultimo.meta ? 'acima' : 'abaixo'} da meta de {money(ultimo.meta)}
      </p>
    </ChartCard>
  )
}
