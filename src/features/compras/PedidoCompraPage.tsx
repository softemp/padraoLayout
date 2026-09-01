import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  alcadaNecessaria, aprovarPedido, cancelarPedido, enviarAoFornecedor, estaAtrasado,
  listarHistoricoPedido, obterPedido, percentualRecebido, receberPedido, USUARIO_ATUAL,
  valorPedido, valorRecebido, type LinhaRecebimento, type ResultadoRecebimento,
} from '@/shared/api/compras'
import type { SituacaoPedido } from '@/shared/api/types'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { ConfirmarAcao } from '@/shared/ui/ConfirmarAcao'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { date, datetime, money, number, percent } from '@/shared/lib/format'
import { RecebimentoModal } from './RecebimentoModal'

const situacaoInfo: Record<SituacaoPedido, { tom: 'neutro' | 'warning' | 'info' | 'good' | 'critical'; rotulo: string }> = {
  rascunho: { tom: 'neutro', rotulo: 'Rascunho' },
  aguardando_aprovacao: { tom: 'warning', rotulo: 'Aguardando aprovação' },
  aprovado: { tom: 'info', rotulo: 'Aprovado' },
  enviado: { tom: 'info', rotulo: 'Enviado ao fornecedor' },
  recebido_parcial: { tom: 'warning', rotulo: 'Recebido parcial' },
  recebido: { tom: 'good', rotulo: 'Recebido' },
  cancelado: { tom: 'neutro', rotulo: 'Cancelado' },
}

export function PedidoCompraPage() {
  const { id } = useParams()
  const pedidoId = Number(id)
  const qc = useQueryClient()

  const [recebendo, setRecebendo] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoRecebimento | null>(null)

  const pedido = useQuery({ queryKey: ['compra', pedidoId], queryFn: () => obterPedido(pedidoId) })
  const historico = useQuery({ queryKey: ['compra-historico', pedidoId], queryFn: () => listarHistoricoPedido(pedidoId) })

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['compra', pedidoId] })
    void qc.invalidateQueries({ queryKey: ['compra-historico', pedidoId] })
    void qc.invalidateQueries({ queryKey: ['compras'] })
    void qc.invalidateQueries({ queryKey: ['compras-totais'] })
    void qc.invalidateQueries({ queryKey: ['estoque'] })
    void qc.invalidateQueries({ queryKey: ['fin-lancamentos'] })
  }

  const aprovar = useMutation({ mutationFn: () => aprovarPedido(pedidoId), onSuccess: () => { invalidar(); setErro(null) }, onError: (e: Error) => setErro(e.message) })
  const enviar = useMutation({ mutationFn: () => enviarAoFornecedor(pedidoId), onSuccess: () => { invalidar(); setErro(null) }, onError: (e: Error) => setErro(e.message) })
  const cancelar = useMutation({ mutationFn: () => cancelarPedido(pedidoId, 'Cancelado pelo comprador'), onSuccess: () => { invalidar(); setCancelando(false) }, onError: (e: Error) => { setErro(e.message); setCancelando(false) } })
  const receber = useMutation({
    mutationFn: ({ linhas, documento }: { linhas: LinhaRecebimento[]; documento: string }) => receberPedido(pedidoId, linhas, documento),
    onSuccess: (r) => { invalidar(); setRecebendo(false); setErro(null); setResultado(r) },
    onError: (e: Error) => setErro(e.message),
  })

  if (pedido.isError) {
    return <Card><EmptyState icone="🔍" titulo="Pedido não encontrado" acao={<Button variant="secondary" size="sm"><Link to="/compras">Voltar</Link></Button>} /></Card>
  }

  const p = pedido.data
  const criouEsteUsuario = p?.criadoPor === USUARIO_ATUAL

  return (
    <div className="space-y-4 sm:space-y-5">
      <nav aria-label="Trilha" className="flex items-center gap-1.5 text-[13px] text-text-muted">
        <Link to="/compras" className="font-medium text-primary hover:underline">Compras</Link>
        <span aria-hidden>/</span>
        <span className="truncate text-text-secondary">{p?.numero ?? '…'}</span>
      </nav>

      <PageHeader
        titulo={p?.numero ?? '…'}
        descricao={p ? `${p.fornecedor} · ${p.itens.length} itens · pagamento ${p.condicaoPagamento}` : undefined}
        acoes={
          <>
            {p?.situacao === 'aguardando_aprovacao' && (
              <Button loading={aprovar.isPending} onClick={() => aprovar.mutate()} disabled={criouEsteUsuario}>
                <span aria-hidden>✔️</span> Aprovar
              </Button>
            )}
            {p?.situacao === 'aprovado' && (
              <Button loading={enviar.isPending} onClick={() => enviar.mutate()}>
                <span aria-hidden>📤</span> Enviar ao fornecedor
              </Button>
            )}
            {p && ['aprovado', 'enviado', 'recebido_parcial'].includes(p.situacao) && (
              <Button onClick={() => { setErro(null); setRecebendo(true) }}>
                <span aria-hidden>📥</span> Receber mercadoria
              </Button>
            )}
            {p && !['recebido', 'recebido_parcial', 'cancelado'].includes(p.situacao) && (
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

      {/* Segregação de funções, dita na tela antes de a pessoa tentar. */}
      {p?.situacao === 'aguardando_aprovacao' && criouEsteUsuario && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-text-secondary">
          <span aria-hidden>🔒</span>
          <span>
            <strong className="text-text">Você criou este pedido, então não pode aprová-lo.</strong> Precisa de
            alguém com alçada de <strong className="text-text">{alcadaNecessaria(valorPedido(p))}</strong> —
            é a regra que fecha o caminho mais simples de fraude interna.
          </span>
        </p>
      )}

      {p && estaAtrasado(p) && (
        <p className="flex items-start gap-2 rounded-lg border border-critical/40 bg-critical/10 px-4 py-3 text-[13px] text-text-secondary">
          <span aria-hidden>⏰</span>
          <span>Previsão de entrega venceu em {date(p.previsaoEntrega)} e o pedido ainda não foi recebido por completo.</span>
        </p>
      )}

      {resultado && (
        <div className="space-y-1.5 rounded-lg border border-good/40 bg-good/10 px-4 py-3 text-[13px] text-text-secondary">
          <p className="font-semibold text-text">Recebimento registrado</p>
          <p>
            {number(resultado.entradasEstoque)} entradas no estoque
            {resultado.lancamentoCriado && ' · conta a pagar criada no financeiro'}
            {resultado.divergencias.length > 0 && ` · ${resultado.divergencias.length} divergência(s) — a conta ficou retida`}
          </p>
          <p className="flex flex-wrap gap-3 pt-1">
            <Link to="/estoque" className="font-medium text-primary hover:underline">ver no estoque</Link>
            <Link to="/financeiro/contas?aba=pagar" className="font-medium text-primary hover:underline">ver em contas a pagar</Link>
          </p>
        </div>
      )}

      <Card>
        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-5">
          {[
            { rotulo: 'Situação', valor: p ? situacaoInfo[p.situacao].rotulo : null },
            { rotulo: 'Valor do pedido', valor: p ? money(valorPedido(p)) : null },
            { rotulo: 'Recebido', valor: p ? `${money(valorRecebido(p))} (${percent(percentualRecebido(p))})` : null },
            { rotulo: 'Previsão', valor: p ? date(p.previsaoEntrega) : null },
            { rotulo: 'Alçada exigida', valor: p ? alcadaNecessaria(valorPedido(p)) : null },
          ].map((c) => (
            <div key={c.rotulo} className="bg-surface px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-text-muted">{c.rotulo}</p>
              {c.valor === null ? <Skeleton className="mt-1.5 h-5 w-24" /> : (
                <p className="mt-0.5 text-[13px] font-semibold text-text">{c.valor}</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader titulo="Itens do pedido" descricao="Pedido × recebido, item a item" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-2.5 text-left font-semibold">Item</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Pedido</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Recebido</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Preço unit.</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {p?.itens.map((item) => {
                  const completo = item.quantidadeRecebida >= item.quantidade
                  return (
                    <tr key={item.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2">
                      <td className="px-4 py-2.5">
                        <Link to={`/estoque/${item.itemEstoqueId}`} className="text-[13px] font-medium text-text hover:underline">{item.nome}</Link>
                        <p className="font-mono text-[11px] text-text-muted">{item.sku}</p>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-text-secondary">{number(item.quantidade)} {item.unidade}</td>
                      <td className={cn('px-3 py-2.5 text-right font-semibold tabular-nums', completo ? 'text-good' : 'text-warning')}>
                        {number(item.quantidadeRecebida)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-text-secondary">{money(item.precoUnitario)}</td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums text-text">{money(item.quantidade * item.precoUnitario)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted">
            Receber gera a <strong className="text-text-secondary">entrada no estoque</strong> com o custo da nota
            e a <strong className="text-text-secondary">conta a pagar</strong> do fornecedor — as três coisas em
            uma operação, senão o estoque e o contas a pagar param de bater.
          </p>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader titulo="Aprovação" />
            <CardBody className="space-y-2 text-[13px] text-text-secondary">
              {p ? (
                <>
                  <p className="flex items-center gap-2">
                    <Badge tom={situacaoInfo[p.situacao].tom}>{situacaoInfo[p.situacao].rotulo}</Badge>
                  </p>
                  <p>Criado por <strong className="text-text">{p.criadoPor}</strong> em {date(p.criadoEm)}.</p>
                  <p>
                    {p.aprovadoPor
                      ? <>Aprovado por <strong className="text-text">{p.aprovadoPor}</strong> em {date(p.aprovadoEm!)}.</>
                      : <>Aguardando aprovação de alguém com alçada de <strong className="text-text">{alcadaNecessaria(valorPedido(p))}</strong>.</>}
                  </p>
                  <p className="border-t border-border pt-2 text-[12px] text-text-muted">
                    Alçada por valor: até R$ 5.000 comprador · até R$ 25.000 coordenação · acima, diretoria.
                  </p>
                </>
              ) : <Skeleton className="h-24 w-full" />}
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

      <RecebimentoModal
        pedido={recebendo ? p ?? null : null}
        salvando={receber.isPending}
        erro={erro}
        onFechar={() => { setRecebendo(false); setErro(null) }}
        onConfirmar={(linhas, documento) => receber.mutate({ linhas, documento })}
      />

      <ConfirmarAcao
        aberto={cancelando}
        titulo="Cancelar pedido"
        rotuloConfirmar="Cancelar pedido"
        carregando={cancelar.isPending}
        onCancelar={() => setCancelando(false)}
        onConfirmar={() => cancelar.mutate()}
        mensagem={<>O pedido <strong className="font-semibold text-text">{p?.numero}</strong> deixa de contar nas previsões. Pedido com mercadoria recebida não é cancelado — nesse caso, trate a devolução.</>}
      />
    </div>
  )
}
