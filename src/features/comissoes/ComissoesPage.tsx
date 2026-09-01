import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  apuracaoPorVendedor, estornarComissao, liberarComissao, listarComissoes, pagarComissoes,
  planoVigente, totaisComissoes,
} from '@/shared/api/comissoes'
import type { Comissao, SituacaoComissao } from '@/shared/api/types'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { BotaoExportar } from '@/shared/ui/BotaoExportar'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { ConfirmarAcao } from '@/shared/ui/ConfirmarAcao'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Select } from '@/shared/ui/Field'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { CartaoResumo, GradeResumo } from '@/shared/ui/CartaoResumo'
import { date, money, number, percent } from '@/shared/lib/format'

const situacaoInfo: Record<SituacaoComissao, { tom: 'neutro' | 'info' | 'good' | 'critical'; rotulo: string; ajuda: string }> = {
  provisionada: { tom: 'neutro', rotulo: 'Provisionada', ajuda: 'venda faturada, cliente ainda não pagou' },
  liberada: { tom: 'info', rotulo: 'Liberada', ajuda: 'cliente pagou — entra no próximo fechamento' },
  paga: { tom: 'good', rotulo: 'Paga', ajuda: 'já saiu na folha' },
  estornada: { tom: 'critical', rotulo: 'Estornada', ajuda: 'venda caiu antes de a comissão ser paga' },
}

export function ComissoesPage() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const aba = (params.get('aba') ?? 'apuracao') as 'apuracao' | 'lancamentos' | 'plano'
  const [situacao, setSituacao] = useState<SituacaoComissao | ''>('')
  const [pagando, setPagando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const { data: totais } = useQuery({ queryKey: ['comissoes-totais'], queryFn: totaisComissoes })
  const { data: apuracao, isLoading } = useQuery({ queryKey: ['comissoes-apuracao'], queryFn: apuracaoPorVendedor })
  const { data: lista } = useQuery({
    queryKey: ['comissoes-lista', situacao],
    queryFn: () => listarComissoes(situacao ? { situacao } : undefined),
    enabled: aba === 'lancamentos',
  })

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['comissoes-totais'] })
    void qc.invalidateQueries({ queryKey: ['comissoes-apuracao'] })
    void qc.invalidateQueries({ queryKey: ['comissoes-lista'] })
  }

  const liberar = useMutation({
    mutationFn: liberarComissao,
    onSuccess: () => { invalidar(); setErro(null) },
    onError: (e: Error) => setErro(e.message),
  })
  const pagar = useMutation({
    mutationFn: pagarComissoes,
    onSuccess: () => { invalidar(); setPagando(null); setErro(null) },
    onError: (e: Error) => { setErro(e.message); setPagando(null) },
  })
  const estornar = useMutation({
    mutationFn: (id: number) => estornarComissao(id, 'Venda cancelada'),
    onSuccess: () => { invalidar(); setErro(null) },
    onError: (e: Error) => setErro(e.message),
  })

  const cartoes = [
    { rotulo: 'Provisionado', valor: totais ? money(totais.provisionado) : null, nota: totais ? `${number(totais.aguardandoRecebimento)} vendas sem pagamento` : undefined },
    { rotulo: 'Liberado a pagar', valor: totais ? money(totais.liberado) : null, destaque: 'text-good', nota: 'cliente já pagou' },
    { rotulo: 'Pago no período', valor: totais ? money(totais.pago) : null },
    { rotulo: 'Estornado', valor: totais ? money(totais.estornado) : null, destaque: 'text-critical', nota: 'venda caiu antes do pagamento' },
  ]

  return (
    <div className="space-y-2 sm:space-y-4 lg:space-y-6">
      <PageHeader
        titulo="Comissões"
        descricao="Nasce na venda, é devida no recebimento — e é aí que ela pode ser paga."
        acoes={
          <BotaoExportar
            nomeArquivo="comissoes"
            titulo="Apuração de comissões"
            orientacao="paisagem"
            colunas={[
              { chave: 'vendedor', cabecalho: 'Vendedor', peso: 1.8, valor: (a: { vendedor: string }) => a.vendedor },
              { chave: 'vendas', cabecalho: 'Vendas', peso: 0.8, alinhamento: 'direita', valor: (a: { vendas: number }) => number(a.vendas), valorCsv: (a: { vendas: number }) => a.vendas },
              { chave: 'provisionado', cabecalho: 'Provisionado', peso: 1.2, alinhamento: 'direita', valor: (a: { provisionado: number }) => money(a.provisionado), valorCsv: (a: { provisionado: number }) => a.provisionado },
              { chave: 'liberado', cabecalho: 'Liberado', peso: 1.2, alinhamento: 'direita', valor: (a: { liberado: number }) => money(a.liberado), valorCsv: (a: { liberado: number }) => a.liberado },
              { chave: 'pago', cabecalho: 'Pago', peso: 1.2, alinhamento: 'direita', valor: (a: { pago: number }) => money(a.pago), valorCsv: (a: { pago: number }) => a.pago },
            ]}
            buscarLinhas={() => apuracao ?? []}
          />
        }
      />

      <GradeResumo>
        {cartoes.map((c) => (
          <CartaoResumo
            key={c.rotulo}
            rotulo={c.rotulo}
            valor={c.valor}
            nota={c.nota}
            destaque={c.destaque}
          />
        ))}
      </GradeResumo>

      {erro && (
        <p role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-text-secondary">
          <span><span aria-hidden>⚠️ </span>{erro}</span>
          <button type="button" onClick={() => setErro(null)} className="font-medium text-primary hover:underline">entendi</button>
        </p>
      )}

      <Card>
        <CardHeader
          titulo="Provisionado não é devido"
          descricao="A comissão nasce quando a venda é faturada e só se torna devida quando o cliente paga. Pagar antes parece generoso e é caro: venda que não entra vira cobrança ao vendedor — e cobrar de volta estraga mais do que segurar teria estragado."
        />
      </Card>

      <div role="tablist" aria-label="Seções de comissões" className="flex flex-wrap items-center gap-1 border-b border-border">
        {([
          { id: 'apuracao', rotulo: 'Apuração por vendedor', icone: '🧮' },
          { id: 'lancamentos', rotulo: 'Lançamentos', icone: '📄' },
          { id: 'plano', rotulo: 'Plano de comissão', icone: '📐' },
        ] as const).map((item) => {
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
              <span aria-hidden>{item.icone}</span>{item.rotulo}
            </button>
          )
        })}
      </div>

      {aba === 'apuracao' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4 lg:gap-6">
          {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          {apuracao?.map((a) => (
            <Card key={a.vendedor}>
              <CardBody className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar nome={a.vendedor} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-text">{a.vendedor}</p>
                    <p className="text-[12px] text-text-muted">
                      {number(a.vendas)} vendas · ticket {money(a.ticketMedio)} · margem {percent(a.margemMedia)}
                    </p>
                  </div>
                </div>

                <dl className="grid grid-cols-4 gap-2 rounded-lg bg-surface-2 p-2 sm:p-4 text-center">
                  {[
                    ['Provisionado', money(a.provisionado), 'text-text-secondary'],
                    ['Liberado', money(a.liberado), 'text-good'],
                    ['Pago', money(a.pago), 'text-text'],
                    ['Estornado', money(a.estornado), 'text-critical'],
                  ].map(([rotulo, valor, cor]) => (
                    <div key={rotulo}>
                      <dt className="text-[10px] uppercase tracking-wide text-text-muted">{rotulo}</dt>
                      <dd className={cn('mt-0.5 text-[13px] font-semibold tabular-nums', cor)}>{valor}</dd>
                    </div>
                  ))}
                </dl>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    disabled={a.liberado <= 0}
                    onClick={() => setPagando(a.vendedor)}
                  >
                    Pagar {money(a.liberado)}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setParams({ aba: 'lancamentos' }, { replace: true })}>
                    Ver lançamentos
                  </Button>
                </div>
                {a.provisionado > 0 && (
                  <p className="text-[12px] text-text-muted">
                    <strong className="text-text-secondary">{money(a.provisionado)}</strong> aguardam o cliente pagar —
                    não entram neste fechamento.
                  </p>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {aba === 'lancamentos' && (
        <Card>
          <CardHeader
            titulo="Lançamentos de comissão"
            descricao="Um por venda, com a regra que valia no dia"
            acoes={
              <Select aria-label="Situação" value={situacao} onChange={(e) => setSituacao(e.target.value as SituacaoComissao | '')} className="w-44">
                <option value="">Todas as situações</option>
                <option value="provisionada">Provisionada</option>
                <option value="liberada">Liberada</option>
                <option value="paga">Paga</option>
                <option value="estornada">Estornada</option>
              </Select>
            }
          />
          {lista?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-text-muted">
                    <th className="px-4 py-2.5 text-left font-semibold">Venda</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Vendedor</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Base</th>
                    <th className="px-3 py-2.5 text-right font-semibold">%</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Comissão</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Situação</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.slice(0, 40).map((c: Comissao) => (
                    <tr key={c.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2">
                      <td className="px-4 py-2.5">
                        <Link to={`/vendas/${c.vendaId}`} className="font-mono text-[12px] font-medium text-text hover:underline">{c.numeroVenda}</Link>
                        <p className="truncate text-[11px] text-text-muted">{c.cliente} · {date(c.dataVenda)}</p>
                      </td>
                      <td className="px-3 py-2.5 text-text-secondary">{c.vendedor}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-text-secondary">
                        {money(c.valorBase)}
                        <span className="ml-1 text-[11px] text-text-muted">{c.baseCalculo === 'margem' ? 'margem' : 'faturam.'}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-text-secondary">{percent(c.percentualAplicado)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text">{money(c.valor)}</td>
                      <td className="px-3 py-2.5">
                        <Badge tom={situacaoInfo[c.situacao].tom}>{situacaoInfo[c.situacao].rotulo}</Badge>
                        <p className="mt-0.5 text-[11px] text-text-muted">{situacaoInfo[c.situacao].ajuda}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {c.situacao === 'provisionada' && (
                            <>
                              <Button size="sm" variant="ghost" loading={liberar.isPending && liberar.variables === c.id} onClick={() => liberar.mutate(c.id)}>
                                Liberar
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => estornar.mutate(c.id)}>Estornar</Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icone="📄" titulo="Nenhuma comissão nesse recorte" />
          )}
          <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted">
            O percentual fica <strong className="text-text-secondary">copiado no lançamento</strong>: revisar o plano
            de comissão não recalcula o que já foi vendido — senão a régua muda para trás e ninguém confere mais nada.
          </p>
        </Card>
      )}

      {aba === 'plano' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4 lg:gap-6">
          <Card>
            <CardHeader titulo={planoVigente.nome} descricao={`Vigente desde ${date(planoVigente.vigenteDesde)} · carência de ${planoVigente.carenciaDias} dias`} />
            <CardBody className="space-y-4">
              <div>
                <p className="text-[12px] uppercase tracking-wide text-text-muted">Base de cálculo</p>
                <p className="mt-0.5 text-[15px] font-semibold text-text">
                  {planoVigente.base === 'margem' ? 'Margem do pedido' : 'Faturamento'}
                </p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[12px] uppercase tracking-wide text-text-muted">
                    <th className="py-2 text-left font-semibold">Faixa acumulada no período</th>
                    <th className="py-2 text-right font-semibold">Percentual</th>
                  </tr>
                </thead>
                <tbody>
                  {planoVigente.faixas.map((f, i) => (
                    <tr key={i} className="border-b border-border/60 last:border-0">
                      <td className="py-2 text-text-secondary">
                        {i === 0 ? `até ${money(f.ate)}` : f.ate === Infinity ? `acima de ${money(planoVigente.faixas[i - 1].ate)}` : `${money(planoVigente.faixas[i - 1].ate)} a ${money(f.ate)}`}
                      </td>
                      <td className="py-2 text-right font-semibold tabular-nums text-text">{percent(f.percentual)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>

          {/* A decisão que molda o comportamento do time inteiro. */}
          <Card className="border-primary/30">
            <CardHeader titulo="Por que sobre margem, e não sobre faturamento" />
            <CardBody className="space-y-3 text-[13px] leading-relaxed text-text-secondary">
              <p>
                Comissão sobre <strong className="text-text">faturamento</strong> paga o vendedor por vender —
                inclusive vendendo com desconto, porque o desconto sai da margem da empresa e não da comissão dele.
                O incentivo é fechar a qualquer preço.
              </p>
              <p>
                Comissão sobre <strong className="text-text">margem</strong> alinha os dois lados: o desconto que o
                vendedor dá reduz a própria comissão, e defender o preço passa a valer a pena para ele também.
              </p>
              <p className="rounded-lg bg-surface-2 p-2 sm:p-4 text-[12px]">
                Exemplo: pedido de {money(10_000)} com custo de {money(7_000)}. Sobre faturamento, 6% = {money(600)};
                sobre margem, 6% de {money(3_000)} = {money(180)}. Dando 10% de desconto, a comissão sobre faturamento
                cai só {money(60)} — mas a margem da empresa cai {money(1_000)}.
              </p>
              <p className="text-[12px] text-text-muted">
                É o mesmo raciocínio do piso de aprovação de desconto: medir na grandeza que importa, não na que é
                fácil de ler.
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      <ConfirmarAcao
        aberto={!!pagando}
        titulo="Pagar comissões liberadas"
        rotuloConfirmar="Confirmar pagamento"
        tom="primary"
        carregando={pagar.isPending}
        onCancelar={() => setPagando(null)}
        onConfirmar={() => pagando && pagar.mutate(pagando)}
        mensagem={
          <>
            Serão pagas todas as comissões <strong className="font-semibold text-text">liberadas</strong> de{' '}
            <strong className="font-semibold text-text">{pagando}</strong> — as provisionadas ficam, porque o cliente
            ainda não pagou. Comissão paga não volta por aqui: se a venda cair depois, vira débito no próximo
            fechamento.
          </>
        }
      />
    </div>
  )
}
