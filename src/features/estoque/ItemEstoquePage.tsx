import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  abaixoDaSeguranca, diasDeCobertura, disponivel, obterItem, obterKardex, pontoDePedido,
  precisaRepor, registrarMovimento, saldosPorDeposito, semEstoque, semGiro, type NovoMovimento,
} from '@/shared/api/estoque'
import type { MovimentoEstoque, TipoMovimentoEstoque } from '@/shared/api/types'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Meter } from '@/shared/ui/Meter'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { date, money, number, timeAgo } from '@/shared/lib/format'
import { MovimentoModal } from './MovimentoModal'

const rotuloTipo: Record<TipoMovimentoEstoque, { rotulo: string; classe: string }> = {
  entrada: { rotulo: 'Entrada', classe: 'text-good' },
  saida: { rotulo: 'Saída', classe: 'text-critical' },
  ajuste: { rotulo: 'Ajuste', classe: 'text-warning' },
  transferencia: { rotulo: 'Transferência', classe: 'text-text-secondary' },
}

export function ItemEstoquePage() {
  const { id } = useParams()
  const itemId = Number(id)
  const qc = useQueryClient()

  const [movimentoAberto, setMovimentoAberto] = useState<TipoMovimentoEstoque | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const item = useQuery({ queryKey: ['estoque-item', itemId], queryFn: () => obterItem(itemId) })
  const kardex = useQuery({ queryKey: ['estoque-kardex', itemId], queryFn: () => obterKardex(itemId) })
  const saldos = useQuery({ queryKey: ['estoque-saldos', itemId], queryFn: () => saldosPorDeposito(itemId) })

  const movimentar = useMutation({
    mutationFn: (dados: NovoMovimento) => registrarMovimento(itemId, dados),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['estoque-item', itemId] })
      void qc.invalidateQueries({ queryKey: ['estoque-kardex', itemId] })
      void qc.invalidateQueries({ queryKey: ['estoque-saldos', itemId] })
      void qc.invalidateQueries({ queryKey: ['estoque'] })
      void qc.invalidateQueries({ queryKey: ['estoque-totais'] })
      setMovimentoAberto(null)
      setErro(null)
    },
    onError: (e: Error) => setErro(e.message),
  })

  if (item.isError) {
    return (
      <Card>
        <EmptyState icone="🔍" titulo="Item não encontrado" acao={<Button variant="secondary" size="sm"><Link to="/estoque">Voltar</Link></Button>} />
      </Card>
    )
  }

  const i = item.data
  const cobertura = i ? diasDeCobertura(i) : null

  return (
    <div className="space-y-2 sm:space-y-4 lg:space-y-6">
      <nav aria-label="Trilha" className="flex items-center gap-1.5 text-[13px] text-text-muted">
        <Link to="/estoque" className="font-medium text-primary hover:underline">Estoque</Link>
        <span aria-hidden>/</span>
        <span className="truncate text-text-secondary">{i?.sku ?? '…'}</span>
      </nav>

      <PageHeader
        titulo={i?.nome ?? '…'}
        descricao={i ? `${i.sku} · ${i.categoria} · ${i.fornecedor} · posição ${i.localizacao}` : undefined}
        acoes={
          <>
            <Button variant="secondary" onClick={() => { setErro(null); setMovimentoAberto('ajuste') }} disabled={!i}>
              <span aria-hidden>🧮</span> Contagem
            </Button>
            <Button variant="secondary" onClick={() => { setErro(null); setMovimentoAberto('saida') }} disabled={!i}>
              <span aria-hidden>➖</span> Saída
            </Button>
            <Button onClick={() => { setErro(null); setMovimentoAberto('entrada') }} disabled={!i}>
              <span aria-hidden>➕</span> Entrada
            </Button>
          </>
        }
      />

      {i && semEstoque(i) && (
        <p className="flex items-start gap-2 rounded-lg border border-critical/40 bg-critical/10 px-4 py-3 text-[13px] text-text-secondary">
          <span aria-hidden>⛔</span>
          <span><strong className="text-critical">Sem disponível.</strong> O saldo físico é {number(i.saldo)}, mas {number(i.reservado)} já está prometido a pedidos.</span>
        </p>
      )}
      {i && !semEstoque(i) && precisaRepor(i) && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-text-secondary">
          <span aria-hidden>📦</span>
          <span>
            Chegou ao <strong className="text-text">ponto de pedido</strong> ({number(pontoDePedido(i))} {i.unidade}).
            Com consumo de {i.consumoMedioDiario}/dia e {i.prazoReposicaoDias} dias de reposição, pedir agora é
            chegar antes de faltar.
          </span>
        </p>
      )}

      <Card>
        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-5">
          {[
            { rotulo: 'Saldo físico', valor: i ? `${number(i.saldo)} ${i.unidade}` : null },
            { rotulo: 'Reservado', valor: i ? number(i.reservado) : null },
            { rotulo: 'Disponível', valor: i ? number(disponivel(i)) : null, destaque: i && disponivel(i) <= 0 ? 'text-critical' : undefined },
            { rotulo: 'Custo médio', valor: i ? money(i.custoMedio) : null },
            { rotulo: 'Valor em estoque', valor: i ? money(i.custoMedio * i.saldo) : null },
          ].map((c) => (
            <div key={c.rotulo} className="bg-surface px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-text-muted">{c.rotulo}</p>
              {c.valor === null ? <Skeleton className="mt-1.5 h-5 w-20" /> : (
                <p className={cn('mt-0.5 text-[15px] font-semibold tabular-nums', c.destaque ?? 'text-text')}>{c.valor}</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
        <Card className="xl:col-span-2">
          <CardHeader
            titulo="Kardex"
            descricao="Cada movimento grava o saldo e o custo médio que ficaram depois dele"
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-2.5 text-left font-semibold">Data</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Movimento</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Qtd.</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Custo unit.</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Saldo após</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Médio após</th>
                </tr>
              </thead>
              <tbody>
                {kardex.isLoading && (
                  <tr><td colSpan={6} className="px-4 py-4"><Skeleton className="h-32 w-full" /></td></tr>
                )}
                {kardex.data?.map((m: MovimentoEstoque) => {
                  const tom = rotuloTipo[m.tipo]
                  return (
                    <tr key={m.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2">
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-text-secondary">{date(m.criadoEm)}</td>
                      <td className="px-3 py-2.5">
                        <p className={cn('text-[13px] font-medium', tom.classe)}>{tom.rotulo}</p>
                        <p className="text-[12px] text-text-muted">{m.motivo} · {m.documento}</p>
                      </td>
                      <td className={cn('whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums', tom.classe)}>
                        {m.quantidade > 0 ? '+' : ''}{number(m.quantidade)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-text-secondary">{money(m.custoUnitario)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-text">{number(m.saldoApos)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-text-secondary">{money(m.custoMedioApos)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted">
            O saldo não é a soma da coluna: ele é gravado em cada linha. É o que permite responder
            "por que o custo médio é este?" — e ver que só a entrada o move.
          </p>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader titulo="Reposição" descricao="Quando pedir, e quanto tempo o saldo cobre" />
            <CardBody className="space-y-4">
              {i ? (
                <>
                  <Meter
                    rotulo="Disponível sobre o ponto de pedido"
                    valor={Math.max(disponivel(i), 0)}
                    total={Math.max(pontoDePedido(i), 1)}
                    formatar={(n) => `${number(n)} ${i.unidade}`}
                  />
                  <dl className="grid grid-cols-2 text-[13px] gap-2 sm:gap-4 lg:gap-6">
                    {[
                      ['Consumo médio', `${i.consumoMedioDiario}/dia`],
                      ['Prazo de reposição', `${i.prazoReposicaoDias} dias`],
                      ['Estoque de segurança', `${number(i.estoqueSeguranca)} ${i.unidade}`],
                      ['Cobertura atual', cobertura !== null ? `${cobertura} dias` : '—'],
                    ].map(([r, v]) => (
                      <div key={r}>
                        <dt className="text-[11px] uppercase tracking-wide text-text-muted">{r}</dt>
                        <dd className="mt-0.5 font-medium text-text">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="rounded-lg bg-surface-2 p-2 sm:p-4 text-[12px] leading-relaxed text-text-secondary">
                    Ponto de pedido = <strong className="text-text">{i.consumoMedioDiario} × {i.prazoReposicaoDias} + {i.estoqueSeguranca}</strong> ={' '}
                    <strong className="text-text">{number(pontoDePedido(i))} {i.unidade}</strong>. Avisar só no mínimo
                    faz o pedido chegar depois de a prateleira esvaziar.
                  </p>
                </>
              ) : (
                <Skeleton className="h-40 w-full" />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader titulo="Saldo por depósito" />
            <ul className="divide-y divide-border">
              {saldos.data?.map((s) => (
                <li key={s.depositoId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="text-[13px] text-text-secondary">{s.deposito}</span>
                  <span className="text-[13px] font-semibold tabular-nums text-text">{number(s.saldo)}</span>
                </li>
              ))}
            </ul>
          </Card>

          {i && (
            <Card>
              <CardBody className="space-y-2 text-[13px] text-text-secondary">
                <p className="flex flex-wrap items-center gap-2">
                  <Badge tom={i.ativo ? 'good' : 'neutro'}>{i.ativo ? 'Ativo' : 'Inativo'}</Badge>
                  {abaixoDaSeguranca(i) && <Badge tom="critical">Abaixo da segurança</Badge>}
                  {semGiro(i) && <Badge tom="neutro">Sem giro</Badge>}
                </p>
                <p>
                  Última movimentação: {i.ultimaMovimentacao ? timeAgo(i.ultimaMovimentacao) : 'nunca'} ·
                  preço de venda {money(i.precoVenda)} · margem sobre o custo médio{' '}
                  {Math.round(((i.precoVenda - i.custoMedio) / i.custoMedio) * 100)}%.
                </p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <MovimentoModal
        item={movimentoAberto ? i ?? null : null}
        tipoInicial={movimentoAberto ?? 'entrada'}
        salvando={movimentar.isPending}
        erro={erro}
        onFechar={() => { setMovimentoAberto(null); setErro(null) }}
        onConfirmar={(dados) => movimentar.mutate(dados)}
      />
    </div>
  )
}
