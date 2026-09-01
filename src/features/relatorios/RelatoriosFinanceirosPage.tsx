import { Fragment, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  obterAging, obterCurvaAbc, obterDre, obterFluxoMensal, obterInadimplencia, obterResultado,
  periodoDeMes, periodoAnterior, type Periodo,
} from '@/shared/api/relatorios-financeiros'
import { ChartCard, TabelaDoGrafico } from '@/shared/charts/ChartCard'
import { ChartTooltip } from '@/shared/charts/ChartTooltip'
import { eixoBase, useChartTokens } from '@/shared/charts/tokens'
import { Badge } from '@/shared/ui/Badge'
import { BotaoExportar } from '@/shared/ui/BotaoExportar'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Select } from '@/shared/ui/Field'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { money, moneyCompact, number, percent } from '@/shared/lib/format'

const ABAS = [
  { id: 'resultado', rotulo: 'Resultado', icone: '📊' },
  { id: 'fluxo', rotulo: 'Fluxo de caixa', icone: '💧' },
  { id: 'aging', rotulo: 'Idade dos saldos', icone: '⏳' },
  { id: 'abc', rotulo: 'Concentração', icone: '🎯' },
  { id: 'inadimplencia', rotulo: 'Inadimplência', icone: '🚩' },
] as const
type AbaId = (typeof ABAS)[number]['id']

function Variacao({ valor }: { valor: number | null }) {
  // Sem base de comparação não existe percentual: mostrar "100%" contra zero
  // é inventar um número que a pessoa vai levar para a reunião.
  if (valor === null) return <span className="text-[12px] text-text-muted">sem base</span>
  const sobe = valor >= 0
  return (
    <span className={cn('inline-flex items-center gap-1 text-[13px] font-medium tabular-nums', sobe ? 'text-good' : 'text-critical')}>
      <span aria-hidden>{sobe ? '↑' : '↓'}</span>
      {percent(Math.abs(valor))}
    </span>
  )
}

export function RelatoriosFinanceirosPage() {
  const t = useChartTokens()
  const [params, setParams] = useSearchParams()
  const aba = (params.get('aba') ?? 'resultado') as AbaId

  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth())
  const [ano, setAno] = useState(hoje.getFullYear())
  const periodo: Periodo = useMemo(() => periodoDeMes(ano, mes), [ano, mes])
  const anterior = useMemo(() => periodoAnterior(periodo), [periodo])

  const { data: resultado } = useQuery({ queryKey: ['rel-resultado', ano, mes], queryFn: () => obterResultado(periodo) })
  const { data: dre } = useQuery({ queryKey: ['rel-dre', ano, mes], queryFn: () => obterDre(periodo) })
  const { data: fluxo } = useQuery({ queryKey: ['rel-fluxo'], queryFn: () => obterFluxoMensal(8) })
  const { data: agingReceber } = useQuery({ queryKey: ['rel-aging-receber'], queryFn: () => obterAging('receber') })
  const { data: agingPagar } = useQuery({ queryKey: ['rel-aging-pagar'], queryFn: () => obterAging('pagar') })
  const { data: abc } = useQuery({ queryKey: ['rel-abc', ano, mes], queryFn: () => obterCurvaAbc('receber', periodo) })
  const { data: inadimplencia } = useQuery({ queryKey: ['rel-inadimplencia'], queryFn: () => obterInadimplencia(6) })

  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

  const receitas = dre?.filter((l) => l.tipo === 'receber') ?? []
  const despesas = dre?.filter((l) => l.tipo === 'pagar') ?? []
  const totalReceitas = receitas.reduce((s, l) => s + l.atual, 0)
  const totalDespesas = despesas.reduce((s, l) => s + l.atual, 0)

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        titulo="Relatórios financeiros"
        descricao="Os mesmos lançamentos das telas de contas, lidos por eixos diferentes."
        acoes={
          <div className="flex flex-wrap items-center gap-2">
            <Select aria-label="Mês" value={mes} onChange={(e) => setMes(Number(e.target.value))} className="w-36">
              {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </Select>
            <Select aria-label="Ano" value={ano} onChange={(e) => setAno(Number(e.target.value))} className="w-28">
              {[hoje.getFullYear(), hoje.getFullYear() - 1].map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
          </div>
        }
      />

      <div role="tablist" aria-label="Relatórios" className="flex flex-wrap items-center gap-1 border-b border-border">
        {ABAS.map((item) => {
          const ativa = aba === item.id
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={ativa}
              onClick={() => setParams({ aba: item.id }, { replace: true })}
              className={cn(
                '-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors',
                ativa ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:border-border-strong hover:text-text',
              )}
            >
              <span aria-hidden>{item.icone}</span>
              {item.rotulo}
            </button>
          )
        })}
      </div>

      {aba === 'resultado' && (
        <div className="space-y-4 sm:space-y-5">
          {/* TRÊS ÓTICAS lado a lado. Elas respondem perguntas diferentes e
              podem discordar sem nenhuma estar errada — mostrar só uma como
              "o resultado" é o jeito clássico de enganar a si mesmo. */}
          <section className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
            {[
              {
                titulo: 'Competência',
                pergunta: 'O mês deu lucro?',
                detalhe: 'Receita menos despesa pelo vencimento — o que o contador enxerga.',
                dados: resultado?.atual.competencia,
                a: 'receita', b: 'despesa',
                anterior: resultado?.anterior.competencia.resultado,
              },
              {
                titulo: 'Caixa',
                pergunta: 'Sobrou dinheiro?',
                detalhe: 'Recebido menos pago pela data do pagamento — o que entrou na conta.',
                dados: resultado?.atual.caixa,
                a: 'recebido', b: 'pago',
                anterior: resultado?.anterior.caixa.resultado,
              },
              {
                titulo: 'Em aberto',
                pergunta: 'O que ainda vai acontecer?',
                detalhe: 'A receber menos a pagar do período — o saldo que ainda não virou dinheiro.',
                dados: resultado?.atual.aberto,
                a: 'aReceber', b: 'aPagar',
                anterior: resultado?.anterior.aberto.resultado,
              },
            ].map((otica) => {
              const valores = otica.dados as Record<string, number> | undefined
              const res = valores?.resultado ?? 0
              const variacao = otica.anterior ? (res - otica.anterior) / Math.abs(otica.anterior) : null
              return (
                <Card key={otica.titulo}>
                  <CardBody className="space-y-3">
                    <div>
                      <p className="text-[13px] font-semibold text-text">{otica.titulo}</p>
                      <p className="text-[12px] text-text-muted">{otica.pergunta}</p>
                    </div>

                    {!valores ? (
                      <Skeleton className="h-8 w-32" />
                    ) : (
                      <>
                        <p className={cn('text-2xl font-semibold tabular-nums', res >= 0 ? 'text-text' : 'text-critical')}>
                          {money(res)}
                        </p>
                        <div className="flex items-center gap-2">
                          <Variacao valor={variacao} />
                          <span className="text-[12px] text-text-muted">vs. {anterior.rotulo}</span>
                        </div>
                        <dl className="grid grid-cols-2 gap-2 border-t border-border pt-2.5 text-[12px]">
                          <div>
                            <dt className="text-text-muted">Entradas</dt>
                            <dd className="font-semibold tabular-nums text-good">{money(valores[otica.a])}</dd>
                          </div>
                          <div>
                            <dt className="text-text-muted">Saídas</dt>
                            <dd className="font-semibold tabular-nums text-critical">{money(valores[otica.b])}</dd>
                          </div>
                        </dl>
                      </>
                    )}

                    <p className="text-[12px] leading-relaxed text-text-muted">{otica.detalhe}</p>
                  </CardBody>
                </Card>
              )
            })}
          </section>

          <p className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-[13px] text-text-secondary">
            <strong className="text-text">As três podem discordar sem nenhuma estar errada.</strong> Um mês
            pode fechar com lucro por competência e caixa negativo — receita reconhecida que ainda não foi
            paga. Escolher uma só como "o resultado" esconde justamente a diferença que explica o mês.
          </p>

          <Card>
            <CardHeader
              titulo="Resultado por categoria"
              descricao={`${periodo.rotulo} comparado a ${anterior.rotulo}`}
              acoes={
                <BotaoExportar
                  nomeArquivo="resultado-por-categoria"
                  titulo="Resultado por categoria"
                  subtitulo={`${periodo.rotulo} × ${anterior.rotulo}`}
                  orientacao="retrato"
                  tamanho="sm"
                  colunas={[
                    { chave: 'categoria', cabecalho: 'Categoria', peso: 2.4, valor: (l: { categoria: string }) => l.categoria },
                    { chave: 'tipo', cabecalho: 'Tipo', peso: 1, valor: (l: { tipo: string }) => (l.tipo === 'receber' ? 'Receita' : 'Despesa') },
                    { chave: 'atual', cabecalho: 'Período', peso: 1.2, alinhamento: 'direita', valor: (l: { atual: number }) => money(l.atual), valorCsv: (l: { atual: number }) => l.atual },
                    { chave: 'anterior', cabecalho: 'Anterior', peso: 1.2, alinhamento: 'direita', valor: (l: { anterior: number }) => money(l.anterior), valorCsv: (l: { anterior: number }) => l.anterior },
                  ]}
                  buscarLinhas={() => dre ?? []}
                />
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[38rem] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-text-muted">
                    <th className="px-4 py-2.5 text-left font-semibold">Categoria</th>
                    <th className="px-3 py-2.5 text-right font-semibold">{periodo.rotulo}</th>
                    <th className="px-3 py-2.5 text-right font-semibold">{anterior.rotulo}</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { rotulo: 'Receitas', linhas: receitas, total: totalReceitas, cor: 'text-good' },
                    { rotulo: 'Despesas', linhas: despesas, total: totalDespesas, cor: 'text-critical' },
                  ].map((grupo) => (
                    // A chave vive no Fragment: sem isso o React reclama do
                    // grupo inteiro, não da linha.
                    <Fragment key={grupo.rotulo}>
                      <tr className="border-b border-border bg-surface-2/40">
                        <th scope="rowgroup" className="px-4 py-2 text-left text-[12px] font-semibold uppercase tracking-wide text-text-secondary">
                          {grupo.rotulo}
                        </th>
                        <td className={cn('px-3 py-2 text-right font-semibold tabular-nums', grupo.cor)}>{money(grupo.total)}</td>
                        <td colSpan={2} />
                      </tr>
                      {grupo.linhas.map((linha) => (
                        <tr key={linha.categoria} className="border-b border-border/60 transition-colors hover:bg-surface-2">
                          <td className="px-4 py-2.5 pl-8 text-text-secondary">{linha.categoria}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-text">{money(linha.atual)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-text-muted">{money(linha.anterior)}</td>
                          <td className="px-4 py-2.5 text-right"><Variacao valor={linha.variacao} /></td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                  <tr className="border-t-2 border-border bg-surface-2/60">
                    <th scope="row" className="px-4 py-3 text-left text-[13px] font-semibold text-text">Resultado do período</th>
                    <td className={cn('px-3 py-3 text-right text-[15px] font-semibold tabular-nums', totalReceitas - totalDespesas >= 0 ? 'text-text' : 'text-critical')}>
                      {money(totalReceitas - totalDespesas)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {aba === 'fluxo' && (
        <div className="space-y-4">
          <ChartCard
            titulo="Fluxo de caixa mensal"
            descricao="Meses passados pelo realizado; os próximos, pelo previsto"
            legenda={[
              { rotulo: 'Entradas', cor: t.serie[0] },
              { rotulo: 'Saídas', cor: t.serie[1] },
            ]}
            tabela={
              <TabelaDoGrafico
                colunas={['Mês', 'Entradas', 'Saídas', 'Saldo final']}
                linhas={(fluxo ?? []).map((f) => [f.mes, money(f.entradas), money(f.saidas), money(f.saldoFinal)])}
              />
            }
          >
            <div className="h-64 w-full sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fluxo ?? []} margin={{ top: 16, right: 16, bottom: 4, left: 4 }} barCategoryGap="30%">
                  <CartesianGrid stroke={t.grid} strokeWidth={1} vertical={false} />
                  <XAxis dataKey="mes" {...eixoBase(t.textoMuted)} dy={6} />
                  <YAxis {...eixoBase(t.textoMuted)} width={58} tickFormatter={(v: number) => moneyCompact(v)} />
                  <Tooltip cursor={{ fill: t.grid, fillOpacity: 0.3 }} content={<ChartTooltip formatar={money} />} />
                  <Bar dataKey="entradas" name="Entradas" maxBarSize={20} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    {(fluxo ?? []).map((f, i) => (
                      // Mês projetado fica mais claro: previsão desenhada igual
                      // ao realizado vira previsão tratada como fato.
                      <Cell key={i} fill={t.serie[0]} fillOpacity={f.projetado ? 0.45 : 1} />
                    ))}
                  </Bar>
                  <Bar dataKey="saidas" name="Saídas" maxBarSize={20} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    {(fluxo ?? []).map((f, i) => (
                      <Cell key={i} fill={t.serie[1]} fillOpacity={f.projetado ? 0.45 : 1} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <Card>
            <CardHeader titulo="Saldo mês a mês" descricao="Saldo inicial, movimento e saldo final" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-text-muted">
                    <th className="px-4 py-2.5 text-left font-semibold">Mês</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Saldo inicial</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Entradas</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Saídas</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Saldo final</th>
                  </tr>
                </thead>
                <tbody>
                  {fluxo?.map((f) => (
                    <tr key={f.mes} className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2">
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2 text-text">
                          {f.mes}
                          {f.projetado && <Badge tom="neutro">previsto</Badge>}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-text-secondary">{money(f.saldoInicial)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-good">{money(f.entradas)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-critical">{money(f.saidas)}</td>
                      <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums', f.saldoFinal >= 0 ? 'text-text' : 'text-critical')}>
                        {money(f.saldoFinal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {aba === 'aging' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[
            { titulo: 'A receber por idade', dados: agingReceber, cor: t.serie[0] },
            { titulo: 'A pagar por idade', dados: agingPagar, cor: t.serie[1] },
          ].map((bloco) => {
            const total = bloco.dados?.reduce((s, f) => s + f.valor, 0) ?? 0
            const vencido = bloco.dados?.filter((f) => f.vencida).reduce((s, f) => s + f.valor, 0) ?? 0
            return (
              <Card key={bloco.titulo}>
                <CardHeader
                  titulo={bloco.titulo}
                  descricao={`${money(total)} em aberto · ${percent(total ? vencido / total : 0)} vencido`}
                />
                <CardBody className="space-y-3">
                  {bloco.dados?.map((faixa) => (
                    <div key={faixa.faixa}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className={cn('text-[13px]', faixa.vencida ? 'font-medium text-text' : 'text-text-secondary')}>
                          {faixa.faixa}
                          <span className="ml-1.5 text-[12px] text-text-muted">({number(faixa.quantidade)})</span>
                        </span>
                        <span className="text-[13px] font-semibold tabular-nums text-text">{money(faixa.valor)}</span>
                      </div>
                      <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                        <span
                          className={cn('block h-full rounded-full', faixa.vencida ? 'bg-critical' : 'bg-primary')}
                          style={{ width: `${total ? (faixa.valor / total) * 100 : 0}%` }}
                        />
                      </span>
                    </div>
                  )) ?? <Skeleton className="h-32 w-full" />}
                </CardBody>
                <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted">
                  Quanto mais à direita o saldo se acumula, menor a chance de receber — a idade da dívida
                  prevê melhor que o valor dela.
                </p>
              </Card>
            )
          })}
        </div>
      )}

      {aba === 'abc' && (
        <Card>
          <CardHeader
            titulo="Concentração de receita por cliente"
            descricao={`${periodo.rotulo} · classe A responde por até 80% do total`}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-2.5 text-left font-semibold">Cliente</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Classe</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Receita</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Participação</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {abc?.map((linha) => (
                  <tr key={linha.contraparte} className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2">
                    <td className="px-4 py-2.5 font-medium text-text">{linha.contraparte}</td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge tom={linha.classe === 'A' ? 'critical' : linha.classe === 'B' ? 'warning' : 'neutro'}>
                        {linha.classe}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-text">{money(linha.valor)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-text-secondary">{percent(linha.participacao)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-text-muted">{percent(linha.acumulado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted">
            Classe <strong className="text-text-secondary">A</strong> é o grupo que sustenta o faturamento —
            e por isso é também o risco: perder um cliente A não é perder uma linha da tabela, é perder uma
            fatia do mês.
          </p>
        </Card>
      )}

      {aba === 'inadimplencia' && (
        <ChartCard
          titulo="Inadimplência sobre o faturado"
          descricao="Últimos 6 meses · saldo vencido dividido pelo faturado de cada mês"
          tabela={
            <TabelaDoGrafico
              colunas={['Mês', 'Faturado', 'Vencido em aberto', 'Taxa']}
              linhas={(inadimplencia ?? []).map((m) => [m.mes, money(m.faturado), money(m.inadimplente), percent(m.taxa)])}
            />
          }
        >
          <div className="h-64 w-full sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={inadimplencia ?? []} margin={{ top: 16, right: 16, bottom: 4, left: 4 }}>
                <CartesianGrid stroke={t.grid} strokeWidth={1} vertical={false} />
                <XAxis dataKey="mes" {...eixoBase(t.textoMuted)} dy={6} />
                <YAxis {...eixoBase(t.textoMuted)} width={52} tickFormatter={(v: number) => percent(v)} />
                <Tooltip cursor={{ stroke: t.grid, strokeWidth: 1 }} content={<ChartTooltip formatar={(v) => percent(v)} />} />
                <ReferenceLine y={0.05} stroke={t.critical} strokeWidth={1} />
                <Line
                  type="monotone"
                  dataKey="taxa"
                  name="Taxa de inadimplência"
                  stroke={t.serie[0]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: t.superficie }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="px-2 pt-1 text-[12px] text-text-muted">
            A linha marca o limite de 5% combinado com a diretoria. Taxa medida sobre o faturado do
            próprio mês — comparar com o faturamento total do ano dilui e esconde a piora.
          </p>
        </ChartCard>
      )}
    </div>
  )
}
