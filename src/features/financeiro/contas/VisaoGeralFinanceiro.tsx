import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fluxoProjetado, lancamentos, porCategoria, estaVencido, saldoAberto } from '@/shared/api/financeiro'
import type { FiltroFinanceiro } from '@/shared/api/financeiro'
import { ChartCard, TabelaDoGrafico } from '@/shared/charts/ChartCard'
import { ChartTooltip } from '@/shared/charts/ChartTooltip'
import { eixoBase, useChartTokens } from '@/shared/charts/tokens'
import { Badge } from '@/shared/ui/Badge'
import { Card, CardHeader } from '@/shared/ui/Card'
import { cn } from '@/shared/lib/cn'
import { date, money, moneyCompact } from '@/shared/lib/format'

export function VisaoGeralFinanceiro({ filtro }: { filtro: FiltroFinanceiro }) {
  const t = useChartTokens()
  const { data: fluxo } = useQuery({ queryKey: ['fin-fluxo'], queryFn: () => fluxoProjetado(12) })
  const { data: despesas } = useQuery({ queryKey: ['fin-categoria-pagar', filtro], queryFn: () => porCategoria('pagar', filtro) })
  const { data: receitas } = useQuery({ queryKey: ['fin-categoria-receber', filtro], queryFn: () => porCategoria('receber', filtro) })

  // Próximos 10 vencimentos em aberto — a fila do que exige decisão hoje.
  const proximos = lancamentos
    .filter((l) => (l.status === 'pendente' || l.status === 'parcial') && new Date(l.vencimento) >= new Date(Date.now() - 30 * 86400000))
    .sort((a, b) => +new Date(a.vencimento) - +new Date(b.vencimento))
    .slice(0, 10)

  return (
    <div className="space-y-2 sm:space-y-4 lg:space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 sm:gap-4 lg:gap-6">
        {/* Entradas × saídas: barras divergentes em torno do zero. A saída é
            desenhada negativa porque é assim que ela pesa no caixa. */}
        <ChartCard
          titulo="Entradas e saídas por semana"
          descricao="Quatro semanas atrás e oito à frente"
          legenda={[
            { rotulo: 'Entradas', cor: t.serie[0] },
            { rotulo: 'Saídas', cor: t.serie[1] },
          ]}
          tabela={
            <TabelaDoGrafico
              colunas={['Semana', 'Entradas', 'Saídas']}
              linhas={(fluxo ?? []).map((f) => [f.semana, money(f.entradas), money(Math.abs(f.saidas))])}
            />
          }
        >
          <div className="h-64 w-full sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fluxo ?? []} margin={{ top: 16, right: 16, bottom: 4, left: 4 }} barCategoryGap="28%">
                <CartesianGrid stroke={t.grid} strokeWidth={1} vertical={false} />
                <XAxis dataKey="semana" {...eixoBase(t.textoMuted)} dy={6} interval={1} />
                <YAxis {...eixoBase(t.textoMuted)} width={58} tickFormatter={(v: number) => moneyCompact(Math.abs(v))} />
                <Tooltip cursor={{ fill: t.grid, fillOpacity: 0.3 }} content={<ChartTooltip formatar={(v) => money(Math.abs(v))} />} />
                <ReferenceLine y={0} stroke={t.textoMuted} strokeWidth={1} />
                <Bar dataKey="entradas" name="Entradas" fill={t.serie[0]} maxBarSize={18} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="saidas" name="Saídas" fill={t.serie[1]} maxBarSize={18} radius={[0, 0, 4, 4]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Saldo acumulado em gráfico PRÓPRIO: pendurar esta linha no gráfico
            acima exigiria um segundo eixo Y — e dois eixos inventam uma
            correlação que não está no dado. */}
        <ChartCard
          titulo="Saldo acumulado projetado"
          descricao="Saldo das contas somado ao previsto de cada semana"
          tabela={
            <TabelaDoGrafico
              colunas={['Semana', 'Saldo projetado']}
              linhas={(fluxo ?? []).map((f) => [f.semana, money(f.saldo)])}
            />
          }
        >
          <div className="h-64 w-full sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fluxo ?? []} margin={{ top: 16, right: 16, bottom: 4, left: 4 }}>
                <CartesianGrid stroke={t.grid} strokeWidth={1} vertical={false} />
                <XAxis dataKey="semana" {...eixoBase(t.textoMuted)} dy={6} interval={1} />
                <YAxis {...eixoBase(t.textoMuted)} width={58} tickFormatter={(v: number) => moneyCompact(v)} />
                <Tooltip cursor={{ stroke: t.grid, strokeWidth: 1 }} content={<ChartTooltip formatar={money} />} />
                <ReferenceLine y={0} stroke={t.critical} strokeWidth={1} />
                <Line
                  type="monotone"
                  dataKey="saldo"
                  name="Saldo projetado"
                  stroke={t.serie[0]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: t.superficie }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
        <Card className="xl:col-span-2">
          <CardHeader titulo="Próximos vencimentos" descricao="O que exige decisão nos próximos dias" />
          <ul className="divide-y divide-border">
            {proximos.map((l) => {
              const vencido = estaVencido(l)
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2 sm:px-5">
                  <span
                    aria-hidden
                    className={cn('h-8 w-1 shrink-0 rounded-full', l.tipo === 'receber' ? 'bg-good' : 'bg-critical')}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-text">{l.descricao}</p>
                    <p className="truncate text-[12px] text-text-muted">
                      {l.contraparte}
                      {l.parcela && <> · parcela {l.parcela.numero}/{l.parcela.de}</>}
                    </p>
                  </div>
                  <span className={cn('whitespace-nowrap text-[12px] tabular-nums', vencido ? 'font-semibold text-critical' : 'text-text-muted')}>
                    {date(l.vencimento)}
                  </span>
                  {vencido && <Badge tom="critical">Vencido</Badge>}
                  <span className={cn('w-28 text-right text-[13px] font-semibold tabular-nums', l.tipo === 'receber' ? 'text-good' : 'text-critical')}>
                    {l.tipo === 'receber' ? '+' : '−'} {money(saldoAberto(l))}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader titulo="Para onde vai o dinheiro" descricao="Despesas por categoria no período" />
          <ul className="divide-y divide-border">
            {(despesas ?? []).slice(0, 6).map((d) => {
              const maior = despesas?.[0]?.valor || 1
              return (
                <li key={d.categoria} className="px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13px] font-medium text-text">{d.categoria}</span>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-text">{money(d.valor)}</span>
                  </div>
                  <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-surface-3">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(d.valor / maior) * 100}%` }} />
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="border-t border-border px-4 py-2.5 text-[12px] text-text-muted">
            Receita no mesmo período: {money((receitas ?? []).reduce((s, r) => s + r.valor, 0))}
          </p>
        </Card>
      </div>
    </div>
  )
}
