import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  contas as contasMock, criarLancamento, DuplicidadeError, extratoConta, listarCategorias,
  listarContas, totaisFinanceiro,
} from '@/shared/api/financeiro'
import type { BaseData, Lancamento, NovoLancamento, TipoLancamento } from '@/shared/api/types'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardHeader } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { date, money } from '@/shared/lib/format'
import { LancamentoFormModal } from './LancamentoFormModal'
import { ListaLancamentos } from './ListaLancamentos'
import { VisaoGeralFinanceiro } from './VisaoGeralFinanceiro'

const ABAS = [
  { id: 'visao', rotulo: 'Visão geral', icone: '📊' },
  { id: 'receber', rotulo: 'A receber', icone: '↓' },
  { id: 'pagar', rotulo: 'A pagar', icone: '↑' },
  { id: 'categorias', rotulo: 'Categorias', icone: '🏷️' },
  { id: 'contas', rotulo: 'Contas bancárias', icone: '🏦' },
] as const
type AbaId = (typeof ABAS)[number]['id']

/** Períodos prontos — o operador não deveria digitar duas datas para ver o mês. */
const PERIODOS = {
  mes: 'Mês corrente',
  proximos30: 'Próximos 30 dias',
  ultimos30: 'Últimos 30 dias',
  trimestre: 'Trimestre',
  ano: 'Ano corrente',
} as const
type PeriodoId = keyof typeof PERIODOS

function intervalo(periodo: PeriodoId): { de: string; ate: string } {
  const hoje = new Date()
  const iso = (d: Date) => d.toISOString()
  switch (periodo) {
    case 'proximos30':
      return { de: iso(hoje), ate: iso(new Date(Date.now() + 30 * 86400000)) }
    case 'ultimos30':
      return { de: iso(new Date(Date.now() - 30 * 86400000)), ate: iso(hoje) }
    case 'trimestre': {
      const inicio = new Date(hoje.getFullYear(), Math.floor(hoje.getMonth() / 3) * 3, 1)
      return { de: iso(inicio), ate: iso(new Date(inicio.getFullYear(), inicio.getMonth() + 3, 0)) }
    }
    case 'ano':
      return { de: iso(new Date(hoje.getFullYear(), 0, 1)), ate: iso(new Date(hoje.getFullYear(), 11, 31)) }
    default:
      return {
        de: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
        ate: iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
      }
  }
}

export function ContasPage() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const aba = (params.get('aba') ?? 'visao') as AbaId

  const [periodo, setPeriodo] = useState<PeriodoId>('mes')
  const [base, setBase] = useState<BaseData>('competencia')
  const [formAberto, setFormAberto] = useState(false)
  const [tipoNovo, setTipoNovo] = useState<TipoLancamento>('pagar')
  const [duplicata, setDuplicata] = useState<Lancamento | null>(null)
  const [contaAberta, setContaAberta] = useState<number>(contasMock[0]?.id ?? 1)

  const { de, ate } = useMemo(() => intervalo(periodo), [periodo])
  const filtro = { page: 1, perPage: 20, sortBy: 'vencimento', sortDir: 'asc' as const, base, de, ate }

  const { data: totais } = useQuery({ queryKey: ['fin-totais', base, de, ate], queryFn: () => totaisFinanceiro(filtro) })
  const { data: categorias } = useQuery({ queryKey: ['fin-categorias'], queryFn: listarCategorias })
  const { data: contas } = useQuery({ queryKey: ['fin-contas'], queryFn: listarContas })
  const { data: extrato } = useQuery({ queryKey: ['fin-extrato', contaAberta], queryFn: () => extratoConta(contaAberta) })

  const criar = useMutation({
    mutationFn: ({ dados, confirmar }: { dados: NovoLancamento; confirmar: boolean }) =>
      criarLancamento({ ...dados, confirmarDuplicidade: confirmar }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fin-lancamentos'] })
      void qc.invalidateQueries({ queryKey: ['fin-totais'] })
      void qc.invalidateQueries({ queryKey: ['fin-fluxo'] })
      setFormAberto(false)
      setDuplicata(null)
    },
    onError: (erro: unknown) => {
      if (erro instanceof DuplicidadeError) setDuplicata(erro.existente)
    },
  })

  const abrirNovo = (tipo: TipoLancamento) => {
    setTipoNovo(tipo)
    setDuplicata(null)
    setFormAberto(true)
  }

  const cartoes = [
    { rotulo: 'A receber no período', valor: totais?.aReceber, cor: 'text-good', nota: totais?.vencidoReceber ? `${money(totais.vencidoReceber)} vencidos` : undefined },
    { rotulo: 'A pagar no período', valor: totais?.aPagar, cor: 'text-critical', nota: totais?.vencidoPagar ? `${money(totais.vencidoPagar)} vencidos` : undefined },
    { rotulo: 'Saldo previsto', valor: totais?.saldoPrevisto, cor: (totais?.saldoPrevisto ?? 0) >= 0 ? 'text-text' : 'text-critical', nota: 'entradas − saídas em aberto' },
    { rotulo: 'Já realizado', valor: totais?.saldoRealizado, cor: 'text-text', nota: 'recebido − pago no período' },
  ]

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        titulo="Contas a pagar e a receber"
        descricao="O compromisso, a data e o dinheiro — com o mesmo eixo em todas as telas."
        acoes={
          <>
            <Button variant="secondary" onClick={() => abrirNovo('receber')}>
              <span aria-hidden>↓</span> Nova a receber
            </Button>
            <Button onClick={() => abrirNovo('pagar')}>
              <span aria-hidden>↑</span> Nova a pagar
            </Button>
          </>
        }
      />

      {/* Barra de recorte: vale para TODAS as abas. Período e base do período
          juntos, porque mudar um sem o outro dá número que não bate. */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2 shadow-card sm:gap-3 sm:p-2.5">
        <div className="flex flex-wrap gap-1">
          {(Object.keys(PERIODOS) as PeriodoId[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodo(p)}
              aria-pressed={periodo === p}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                periodo === p ? 'bg-surface-3 text-text' : 'text-text-muted hover:text-text',
              )}
            >
              {PERIODOS[p]}
            </button>
          ))}
        </div>

        <span aria-hidden className="hidden h-6 w-px bg-border sm:block" />

        {/*
          Competência × Caixa: a mesma lista, dois eixos de data.
          Competência = pelo vencimento (o mês a que o fato pertence).
          Caixa = pelo pagamento, caindo no vencimento enquanto não houver.
          Sem esse seletor, a tela financeira e o relatório contábil mostram
          números diferentes e ninguém sabe qual está certo.
        */}
        <div role="group" aria-label="Base do período" className="flex rounded-lg border border-border p-0.5">
          {(['competencia', 'caixa'] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBase(b)}
              aria-pressed={base === b}
              title={b === 'competencia' ? 'Pelo vencimento' : 'Pelo pagamento (ou vencimento, se ainda não pago)'}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                base === b ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text',
              )}
            >
              {b === 'competencia' ? 'Competência' : 'Caixa'}
            </button>
          ))}
        </div>

        <span className="ml-auto hidden text-[12px] text-text-muted lg:block">
          {date(de)} a {date(ate)}
        </span>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cartoes.map((cartao) => (
          <div key={cartao.rotulo} className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <p className="text-[13px] font-medium text-text-muted">{cartao.rotulo}</p>
            {cartao.valor === undefined ? (
              <Skeleton className="mt-2 h-7 w-28" />
            ) : (
              <p className={cn('mt-1 text-xl font-semibold tabular-nums lg:text-2xl', cartao.cor)}>{money(cartao.valor)}</p>
            )}
            {cartao.nota && <p className="mt-1 text-[12px] text-text-muted">{cartao.nota}</p>}
          </div>
        ))}
      </section>

      <div role="tablist" aria-label="Seções financeiras" className="flex flex-wrap items-center gap-1 border-b border-border">
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

      {aba === 'visao' && <VisaoGeralFinanceiro filtro={filtro} />}
      {aba === 'receber' && <ListaLancamentos tipo="receber" base={base} de={de} ate={ate} />}
      {aba === 'pagar' && <ListaLancamentos tipo="pagar" base={base} de={de} ate={ate} />}

      {aba === 'categorias' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(['receber', 'pagar'] as const).map((tipo) => (
            <Card key={tipo}>
              <CardHeader
                titulo={tipo === 'receber' ? 'Categorias de receita' : 'Categorias de despesa'}
                descricao="A categoria define de que lado o lançamento entra"
                acoes={<Button size="sm" variant="secondary">＋ Nova</Button>}
              />
              <ul className="divide-y divide-border">
                {categorias?.filter((c) => c.tipo === tipo).map((categoria) => (
                  <li key={categoria.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-text">{categoria.nome}</p>
                      <p className="truncate font-mono text-[11px] text-text-muted">{categoria.slug ?? 'sem slug — categoria livre'}</p>
                    </div>
                    {categoria.sistema && <Badge tom="info">De sistema</Badge>}
                    <Button size="sm" variant="ghost">Renomear</Button>
                  </li>
                ))}
              </ul>
              <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted">
                Categoria de sistema tem <strong className="text-text-secondary">slug</strong> estável: relatórios
                e automações apontam para ele, então renomear a categoria no painel não quebra nada.
              </p>
            </Card>
          ))}
        </div>
      )}

      {aba === 'contas' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[22rem_1fr]">
          <div className="space-y-3">
            {contas?.map((conta) => {
              const ativa = contaAberta === conta.id
              return (
                <button
                  key={conta.id}
                  type="button"
                  onClick={() => setContaAberta(conta.id)}
                  aria-pressed={ativa}
                  className={cn(
                    'w-full rounded-xl border p-4 text-left transition-colors',
                    ativa ? 'border-primary bg-primary/[0.06]' : 'border-border bg-surface hover:bg-surface-2',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-text">{conta.nome}</p>
                      <p className="truncate text-[12px] text-text-muted">
                        {conta.banco} · ag. {conta.agencia} · c/c {conta.numero}
                      </p>
                    </div>
                    {conta.principal && <Badge tom="info">Principal</Badge>}
                  </div>
                  <p className="mt-2 text-lg font-semibold tabular-nums text-text">{money(conta.saldo)}</p>
                </button>
              )
            })}

            <p className="px-1 text-[12px] text-text-muted">
              Saldo total: <strong className="text-text-secondary">{money((contas ?? []).reduce((s, c) => s + c.saldo, 0))}</strong>
            </p>
          </div>

          <Card>
            <CardHeader
              titulo="Movimentos da conta"
              descricao="Cada baixa gera um movimento com o saldo que ficou depois dele"
            />
            {extrato?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[38rem] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-text-muted">
                      <th className="px-4 py-2.5 text-left font-semibold">Data</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Movimento</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Valor</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Saldo após</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extrato.map((m) => (
                      <tr key={m.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2">
                        <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-text-secondary">{date(m.data)}</td>
                        <td className="px-3 py-2.5 text-text">{m.descricao}</td>
                        <td className={cn('whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums', m.valor >= 0 ? 'text-good' : 'text-critical')}>
                          {m.valor >= 0 ? '+' : '−'} {money(Math.abs(m.valor))}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-text">{money(m.saldoApos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icone="🏦"
                titulo="Nenhum movimento nesta sessão"
                descricao="Registre a baixa de um lançamento vinculado a esta conta para ver o movimento aparecer aqui, com o saldo resultante."
              />
            )}
            <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted">
              O saldo da conta só muda por movimento — nunca por escrita direta. É o que permite responder
              “de onde veio esse saldo?” linha a linha, e o que faz o estorno ser um movimento novo em vez
              de um número reescrito.
            </p>
          </Card>
        </div>
      )}

      <LancamentoFormModal
        aberto={formAberto}
        tipoInicial={tipoNovo}
        salvando={criar.isPending}
        duplicata={duplicata}
        onFechar={() => { setFormAberto(false); setDuplicata(null) }}
        onSalvar={(dados, confirmar) => criar.mutate({ dados, confirmar })}
      />
    </div>
  )
}
