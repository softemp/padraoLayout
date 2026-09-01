import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  aprovarDesconto, cancelarVenda, confirmarVenda, custoVenda, descontoItem, faturarVenda,
  listarHistoricoVenda, margemItem, margemVenda, MARGEM_PISO, obterVenda, orcamentoVencido,
  percentualFaturado, precisaAprovarDesconto, USUARIO_ATUAL, valorVenda,
  type LinhaFaturamento, type ResultadoFaturamento,
} from '@/shared/api/vendas'
import type { SituacaoVenda } from '@/shared/api/types'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { ConfirmarAcao } from '@/shared/ui/ConfirmarAcao'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { date, datetime, money, number, percent } from '@/shared/lib/format'

const situacaoInfo: Record<SituacaoVenda, { tom: 'neutro' | 'warning' | 'info' | 'good' | 'critical'; rotulo: string }> = {
  orcamento: { tom: 'neutro', rotulo: 'Orçamento' },
  aguardando_desconto: { tom: 'warning', rotulo: 'Aguardando aprovação de desconto' },
  confirmado: { tom: 'info', rotulo: 'Confirmado · estoque reservado' },
  faturado_parcial: { tom: 'warning', rotulo: 'Faturado parcial' },
  faturado: { tom: 'good', rotulo: 'Faturado' },
  cancelado: { tom: 'neutro', rotulo: 'Cancelado' },
}

export function VendaPage() {
  const { id } = useParams()
  const vendaId = Number(id)
  const qc = useQueryClient()

  const [faturando, setFaturando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [documento, setDocumento] = useState('')
  const [linhas, setLinhas] = useState<Record<number, number>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoFaturamento | null>(null)

  const venda = useQuery({ queryKey: ['venda', vendaId], queryFn: () => obterVenda(vendaId) })
  const historico = useQuery({ queryKey: ['venda-historico', vendaId], queryFn: () => listarHistoricoVenda(vendaId) })

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['venda', vendaId] })
    void qc.invalidateQueries({ queryKey: ['venda-historico', vendaId] })
    void qc.invalidateQueries({ queryKey: ['vendas'] })
    void qc.invalidateQueries({ queryKey: ['vendas-totais'] })
    void qc.invalidateQueries({ queryKey: ['estoque'] })
    void qc.invalidateQueries({ queryKey: ['fin-lancamentos'] })
  }

  const confirmar = useMutation({ mutationFn: () => confirmarVenda(vendaId), onSuccess: () => { invalidar(); setErro(null) }, onError: (e: Error) => { invalidar(); setErro(e.message) } })
  const aprovar = useMutation({ mutationFn: () => aprovarDesconto(vendaId), onSuccess: () => { invalidar(); setErro(null) }, onError: (e: Error) => setErro(e.message) })
  const cancelar = useMutation({ mutationFn: () => cancelarVenda(vendaId, 'Cancelado pelo vendedor'), onSuccess: () => { invalidar(); setCancelando(false) }, onError: (e: Error) => { setErro(e.message); setCancelando(false) } })
  const faturar = useMutation({
    mutationFn: (dados: { linhas: LinhaFaturamento[]; documento: string }) => faturarVenda(vendaId, dados.linhas, dados.documento),
    onSuccess: (r) => { invalidar(); setFaturando(false); setErro(null); setResultado(r) },
    onError: (e: Error) => setErro(e.message),
  })

  if (venda.isError) {
    return <Card><EmptyState icone="🔍" titulo="Pedido não encontrado" acao={<Button variant="secondary" size="sm"><Link to="/vendas">Voltar</Link></Button>} /></Card>
  }

  const v = venda.data
  const vendeuEsteUsuario = v?.vendedor === USUARIO_ATUAL
  const margem = v ? margemVenda(v) : 0

  const abrirFaturamento = () => {
    if (!v) return
    setDocumento('')
    setLinhas(Object.fromEntries(v.itens.map((i) => [i.id, i.quantidade - i.quantidadeFaturada])))
    setErro(null)
    setFaturando(true)
  }

  return (
    <div className="space-y-2 sm:space-y-4 lg:space-y-6">
      <nav aria-label="Trilha" className="flex items-center gap-1.5 text-[13px] text-text-muted">
        <Link to="/vendas" className="font-medium text-primary hover:underline">Vendas</Link>
        <span aria-hidden>/</span>
        <span className="truncate text-text-secondary">{v?.numero ?? '…'}</span>
      </nav>

      <PageHeader
        titulo={v?.numero ?? '…'}
        descricao={v ? `${v.cliente} · ${v.itens.length} itens · ${v.condicaoPagamento} · vendedor ${v.vendedor}` : undefined}
        acoes={
          <>
            {v?.situacao === 'orcamento' && (
              <Button loading={confirmar.isPending} onClick={() => confirmar.mutate()}>
                <span aria-hidden>✔️</span> Confirmar e reservar
              </Button>
            )}
            {v?.situacao === 'aguardando_desconto' && (
              <Button loading={aprovar.isPending} onClick={() => aprovar.mutate()} disabled={vendeuEsteUsuario}>
                <span aria-hidden>🔓</span> Aprovar desconto
              </Button>
            )}
            {v && ['confirmado', 'faturado_parcial'].includes(v.situacao) && (
              <Button onClick={abrirFaturamento}><span aria-hidden>📤</span> Faturar</Button>
            )}
            {v && v.situacao !== 'faturado' && v.situacao !== 'cancelado' && (
              <Button variant="secondary" onClick={() => setCancelando(true)}>Cancelar</Button>
            )}
          </>
        }
      />

      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-critical/40 bg-critical/10 px-4 py-3 text-[13px] text-text-secondary">
          <span aria-hidden>⚠️</span><span>{erro}</span>
        </p>
      )}

      {v?.situacao === 'aguardando_desconto' && vendeuEsteUsuario && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-text-secondary">
          <span aria-hidden>🔒</span>
          <span><strong className="text-text">Você vendeu este pedido, então não aprova o próprio desconto.</strong> Peça a quem tem alçada comercial.</span>
        </p>
      )}

      {v && orcamentoVencido(v) && (
        <p className="flex items-start gap-2 rounded-lg border border-critical/40 bg-critical/10 px-4 py-3 text-[13px] text-text-secondary">
          <span aria-hidden>⏰</span>
          <span>Orçamento venceu em {date(v.validadeOrcamento)}. Preço e disponibilidade precisam ser reconferidos antes de confirmar.</span>
        </p>
      )}

      {resultado && (
        <div className="space-y-1.5 rounded-lg border border-good/40 bg-good/10 px-4 py-3 text-[13px] text-text-secondary">
          <p className="font-semibold text-text">Faturamento registrado · {money(resultado.valor)}</p>
          <p>{number(resultado.saidas)} saídas no estoque{resultado.lancamentoCriado && ' · conta a receber criada'}</p>
          <p className="flex flex-wrap gap-3 pt-1">
            <Link to="/estoque" className="font-medium text-primary hover:underline">ver no estoque</Link>
            <Link to="/financeiro/contas?aba=receber" className="font-medium text-primary hover:underline">ver em contas a receber</Link>
          </p>
        </div>
      )}

      <Card>
        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-5">
          {[
            { rotulo: 'Situação', valor: v ? situacaoInfo[v.situacao].rotulo : null },
            { rotulo: 'Valor', valor: v ? money(valorVenda(v)) : null },
            { rotulo: 'Custo', valor: v ? money(custoVenda(v)) : null },
            { rotulo: 'Margem', valor: v ? percent(margem) : null, destaque: margem < MARGEM_PISO ? 'text-warning' : 'text-good' },
            { rotulo: 'Faturado', valor: v ? percent(percentualFaturado(v)) : null },
          ].map((c) => (
            <div key={c.rotulo} className="bg-surface px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-text-muted">{c.rotulo}</p>
              {c.valor === null ? <Skeleton className="mt-1.5 h-5 w-20" /> : (
                <p className={cn('mt-0.5 text-[13px] font-semibold', c.destaque ?? 'text-text')}>{c.valor}</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
        <Card className="xl:col-span-2">
          <CardHeader
            titulo="Itens"
            descricao="Preço de tabela, praticado, desconto e margem — item a item"
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-2.5 text-left font-semibold">Item</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Qtd.</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Tabela</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Praticado</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Desconto</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Margem</th>
                </tr>
              </thead>
              <tbody>
                {v?.itens.map((item) => {
                  const m = margemItem(item)
                  const d = descontoItem(item)
                  return (
                    <tr key={item.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2">
                      <td className="px-4 py-2.5">
                        <Link to={`/estoque/${item.itemEstoqueId}`} className="text-[13px] font-medium text-text hover:underline">{item.nome}</Link>
                        <p className="font-mono text-[11px] text-text-muted">
                          {item.sku} · custo na venda {money(item.custoNaVenda)}
                          {item.quantidadeFaturada > 0 && ` · ${item.quantidadeFaturada} faturados`}
                        </p>
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-text-secondary">{number(item.quantidade)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-text-muted line-through">{money(item.precoTabela)}</td>
                      <td className="px-2 py-2.5 text-right font-medium tabular-nums text-text">{money(item.precoPraticado)}</td>
                      <td className={cn('px-2 py-2.5 text-right tabular-nums', d > 0 ? 'text-warning' : 'text-text-muted')}>
                        {d > 0 ? percent(d) : '—'}
                      </td>
                      <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums', m <= 0 ? 'text-critical' : m < MARGEM_PISO ? 'text-warning' : 'text-good')}>
                        {percent(m)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted">
            O preço de tabela e o custo ficam <strong className="text-text-secondary">copiados no item</strong>: mudar
            a tabela ou o custo médio depois não reescreve o que foi vendido — e é o que permite comparar a margem
            prometida com a realizada.
          </p>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader titulo="Margem e desconto" />
            <CardBody className="space-y-3 text-[13px] text-text-secondary">
              {v ? (
                <>
                  <div className="flex items-baseline justify-between">
                    <span>Margem do pedido</span>
                    <span className={cn('text-lg font-semibold tabular-nums', margem < MARGEM_PISO ? 'text-warning' : 'text-good')}>
                      {percent(margem)}
                    </span>
                  </div>
                  <span className="block h-2 w-full overflow-hidden rounded-full bg-surface-3">
                    <span
                      className={cn('block h-full rounded-full', margem <= 0 ? 'bg-critical' : margem < MARGEM_PISO ? 'bg-warning' : 'bg-good')}
                      style={{ width: `${Math.min(Math.max(margem, 0) / 0.5, 1) * 100}%` }}
                    />
                  </span>
                  <p className="text-[12px]">
                    Piso de aprovação automática: <strong className="text-text">{percent(MARGEM_PISO)}</strong>.
                    Abaixo disso o pedido vai para aprovação; abaixo de zero não é aprovável — vender abaixo do
                    custo precisa de outra decisão, não de um clique.
                  </p>
                  {precisaAprovarDesconto(v) && (
                    <Badge tom={margem <= 0 ? 'critical' : 'warning'}>
                      {margem <= 0 ? 'Abaixo do custo' : 'Abaixo do piso'}
                    </Badge>
                  )}
                  {v.aprovadoPor && (
                    <p className="border-t border-border pt-2 text-[12px]">
                      Desconto aprovado por <strong className="text-text">{v.aprovadoPor}</strong> em {date(v.aprovadoEm!)}.
                    </p>
                  )}
                </>
              ) : <Skeleton className="h-32 w-full" />}
            </CardBody>
          </Card>

          <Card>
            <CardHeader titulo="Histórico" />
            <ol className="divide-y divide-border">
              {historico.data?.map((e) => (
                <li key={e.id} className="px-4 py-2.5">
                  <p className="text-[13px] text-text-secondary">
                    <span className="font-semibold text-text">{e.autor}</span> {e.acao}
                  </p>
                  <p className="text-[12px] text-text-muted">{e.detalhe}</p>
                  <p className="mt-0.5 text-[11px] tabular-nums text-text-muted">{datetime(e.criadoEm)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <Modal
        aberto={faturando}
        titulo="Faturar pedido"
        descricao={v ? `${v.numero} · ${v.cliente}` : undefined}
        largura="max-w-2xl"
        onFechar={faturar.isPending ? () => {} : () => setFaturando(false)}
        rodape={
          <>
            <Button variant="ghost" onClick={() => setFaturando(false)} disabled={faturar.isPending}>Cancelar</Button>
            <Button
              loading={faturar.isPending}
              onClick={() =>
                faturar.mutate({
                  linhas: Object.entries(linhas).map(([id, q]) => ({ itemVendaId: Number(id), quantidade: q })).filter((l) => l.quantidade > 0),
                  documento,
                })
              }
            >
              Faturar e dar baixa
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {erro && <p role="alert" className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2.5 text-[13px] text-critical">⚠️ {erro}</p>}

          <Input label="Nota fiscal" data-foco-inicial placeholder="NFe 10233" value={documento} onChange={(e) => setDocumento(e.target.value)} />

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-text-muted">
                  <th className="px-3 py-2.5 text-left font-semibold">Item</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Em aberto</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Faturando</th>
                </tr>
              </thead>
              <tbody>
                {v?.itens.map((item) => {
                  const aberto = item.quantidade - item.quantidadeFaturada
                  return (
                    <tr key={item.id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2">
                        <p className="text-[13px] font-medium text-text">{item.nome}</p>
                        <p className="font-mono text-[11px] text-text-muted">{item.sku}</p>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-text-secondary">{number(aberto)}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          max={aberto}
                          value={linhas[item.id] ?? 0}
                          onChange={(e) => setLinhas((a) => ({ ...a, [item.id]: Number(e.target.value) }))}
                          className="h-8 w-20 rounded-md border border-border bg-surface px-2 text-right text-[13px] tabular-nums text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="rounded-md bg-surface-2 px-3 py-2 text-[12px] text-text-secondary">
            Faturar consome a reserva: libera o reservado e registra a <strong className="text-text">saída</strong> no
            estoque, além de criar a <strong className="text-text">conta a receber</strong> com o vencimento da condição
            de pagamento.
          </p>
        </div>
      </Modal>

      <ConfirmarAcao
        aberto={cancelando}
        titulo="Cancelar pedido"
        rotuloConfirmar="Cancelar pedido"
        carregando={cancelar.isPending}
        onCancelar={() => setCancelando(false)}
        onConfirmar={() => cancelar.mutate()}
        mensagem={<>O pedido <strong className="font-semibold text-text">{v?.numero}</strong> é cancelado e a <strong className="font-semibold text-text">reserva de estoque é liberada na hora</strong> — reserva presa é estoque morto. Pedido faturado não é cancelado: trate a devolução.</>}
      />
    </div>
  )
}
