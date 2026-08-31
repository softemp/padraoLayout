import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { listarRecebimentos, serieRecebimentos } from '@/shared/api/operacao'
import { ChartCard, TabelaDoGrafico } from '@/shared/charts/ChartCard'
import { ChartTooltip } from '@/shared/charts/ChartTooltip'
import { eixoBase, useChartTokens } from '@/shared/charts/tokens'
import { Badge } from '@/shared/ui/Badge'
import { BotaoExportar } from '@/shared/ui/BotaoExportar'
import { Card, CardHeader } from '@/shared/ui/Card'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { date, money, moneyCompact, number } from '@/shared/lib/format'
import type { Recebimento } from '@/shared/api/types'

export function RecebimentosPage() {
  const t = useChartTokens()
  const { data, isLoading } = useQuery({ queryKey: ['recebimentos'], queryFn: listarRecebimentos })

  const total = data?.reduce((s, r) => s + r.valor, 0) ?? 0
  const noPeriodo = serieRecebimentos.reduce((s, d) => s + d.valor, 0)
  const porMeio = (data ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.meio] = (acc[r.meio] ?? 0) + r.valor
    return acc
  }, {})

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        titulo="Recebimentos"
        descricao="O dinheiro que entrou: por dia, por meio de pagamento e por conta."
        acoes={
          <BotaoExportar
            nomeArquivo="recebimentos"
            titulo="Recebimentos"
            subtitulo="Últimos 30 dias"
            rodape="Painel SoftEmp · valores em reais"
            colunas={[
              { chave: 'data', cabecalho: 'Data', peso: 1, valor: (r: Recebimento) => date(r.data), valorCsv: (r: Recebimento) => r.data.slice(0, 10) },
              { chave: 'cliente', cabecalho: 'Cliente', peso: 2.2, valor: (r: Recebimento) => r.cliente },
              { chave: 'fatura', cabecalho: 'Fatura', peso: 1.1, valor: (r: Recebimento) => r.faturaNumero },
              { chave: 'meio', cabecalho: 'Meio', peso: 1, valor: (r: Recebimento) => r.meio },
              { chave: 'conta', cabecalho: 'Conta', peso: 1.4, valor: (r: Recebimento) => r.conta },
              { chave: 'valor', cabecalho: 'Valor', peso: 1.1, alinhamento: 'direita', valor: (r: Recebimento) => money(r.valor), valorCsv: (r: Recebimento) => r.valor },
            ]}
            buscarLinhas={() => data ?? []}
          />
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[
          { rotulo: 'Recebido em 30 dias', valor: money(noPeriodo) },
          { rotulo: 'Recebimentos', valor: number(data?.length ?? 0) },
          { rotulo: 'Ticket médio', valor: data?.length ? money(total / data.length) : money(0) },
          { rotulo: 'Maior entrada', valor: data?.length ? money(Math.max(...data.map((r) => r.valor))) : money(0) },
        ].map((item) => (
          <div key={item.rotulo} className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <p className="text-[13px] font-medium text-text-muted">{item.rotulo}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-text lg:text-2xl">{item.valor}</p>
          </div>
        ))}
      </section>

      <ChartCard
        titulo="Entradas por dia"
        descricao="Últimos 30 dias"
        tabela={
          <TabelaDoGrafico
            colunas={['Dia', 'Recebido']}
            linhas={serieRecebimentos.map((d) => [d.dia, money(d.valor)])}
          />
        }
      >
        <div className="h-56 w-full sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serieRecebimentos} margin={{ top: 16, right: 16, bottom: 4, left: 4 }}>
              <defs>
                <linearGradient id="grad-receb" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.serie[2]} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={t.serie[2]} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={t.grid} strokeWidth={1} vertical={false} />
              <XAxis dataKey="dia" {...eixoBase(t.textoMuted)} dy={6} interval={4} />
              <YAxis {...eixoBase(t.textoMuted)} width={54} tickFormatter={(v: number) => moneyCompact(v)} />
              <Tooltip cursor={{ stroke: t.grid, strokeWidth: 1 }} content={<ChartTooltip formatar={money} />} />
              <Area
                type="monotone"
                dataKey="valor"
                name="Recebido"
                stroke={t.serie[2]}
                strokeWidth={2}
                fill="url(#grad-receb)"
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: t.superficie }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader titulo="Últimos recebimentos" descricao="Da entrada mais recente para a mais antiga" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-2.5 text-left font-semibold">Data</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Cliente</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Fatura</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Conta</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={5} className="px-4 py-4"><Skeleton className="h-24 w-full" /></td></tr>
                )}
                {data?.slice(0, 12).map((r) => (
                  <tr key={r.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2">
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-text-secondary">{date(r.data)}</td>
                    <td className="px-3 py-2.5 font-medium text-text">{r.cliente}</td>
                    <td className="px-3 py-2.5 font-mono text-[12px] text-text-secondary">{r.faturaNumero}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{r.conta}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-good">{money(r.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader titulo="Por meio de pagamento" descricao="Participação no período" />
          <ul className="divide-y divide-border">
            {Object.entries(porMeio)
              .sort((a, b) => b[1] - a[1])
              .map(([meio, valor]) => (
                <li key={meio} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-text">{meio}</span>
                    <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-surface-3">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${(valor / total) * 100}%` }} />
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[13px] font-semibold tabular-nums text-text">{money(valor)}</span>
                    <Badge tom="neutro">{Math.round((valor / total) * 100)}%</Badge>
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
