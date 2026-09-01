import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  alcadaNecessaria, estaAtrasado, fornecedoresCompras, listarPedidos, percentualRecebido,
  sugestoesCompra, totaisCompras, valorPedido,
} from '@/shared/api/compras'
import type { PedidoCompra, SituacaoPedido } from '@/shared/api/types'
import { useTableState } from '@/shared/hooks/useTableState'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { BotaoExportar } from '@/shared/ui/BotaoExportar'
import { Card, CardHeader } from '@/shared/ui/Card'
import { DataTable } from '@/shared/ui/DataTable'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Select } from '@/shared/ui/Field'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { date, money, number, percent } from '@/shared/lib/format'

const situacaoInfo: Record<SituacaoPedido, { tom: 'neutro' | 'warning' | 'info' | 'good' | 'critical'; rotulo: string }> = {
  rascunho: { tom: 'neutro', rotulo: 'Rascunho' },
  aguardando_aprovacao: { tom: 'warning', rotulo: 'Aguardando aprovação' },
  aprovado: { tom: 'info', rotulo: 'Aprovado' },
  enviado: { tom: 'info', rotulo: 'Enviado' },
  recebido_parcial: { tom: 'warning', rotulo: 'Recebido parcial' },
  recebido: { tom: 'good', rotulo: 'Recebido' },
  cancelado: { tom: 'neutro', rotulo: 'Cancelado' },
}

export function ComprasPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const aba = (params.get('aba') ?? 'pedidos') as 'pedidos' | 'sugestoes'

  const tabela = useTableState({ sortBy: 'criadoEm', sortDir: 'desc', filtros: ['situacao', 'fornecedor'] })
  const [busca, setBusca] = useState(tabela.search ?? '')
  const buscaDebounced = useDebouncedValue(busca, 450)

  useEffect(() => {
    if (buscaDebounced !== (tabela.search ?? '')) tabela.setSearch(buscaDebounced)
  }, [buscaDebounced]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtro = {
    page: tabela.page, perPage: tabela.perPage, sortBy: tabela.sortBy, sortDir: tabela.sortDir,
    search: tabela.search, filters: tabela.filters,
  }

  const { data, isFetching, error } = useQuery({
    queryKey: ['compras', filtro],
    queryFn: () => listarPedidos(filtro),
    placeholderData: keepPreviousData,
    enabled: aba === 'pedidos',
  })
  const { data: totais } = useQuery({ queryKey: ['compras-totais'], queryFn: totaisCompras })
  const { data: sugestoes } = useQuery({ queryKey: ['compras-sugestoes'], queryFn: sugestoesCompra, enabled: aba === 'sugestoes' })

  const colunas = useMemo<ColumnDef<PedidoCompra, unknown>[]>(
    () => [
      {
        id: 'numero',
        header: 'Pedido',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-mono text-[13px] font-medium text-text">{row.original.numero}</p>
            <p className="truncate text-[12px] text-text-muted">{row.original.fornecedor} · {row.original.itens.length} itens</p>
          </div>
        ),
      },
      {
        id: 'valor',
        header: 'Valor',
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => (
          <div className="text-right">
            <p className="font-medium tabular-nums text-text">{money(valorPedido(row.original))}</p>
            <p className="text-[11px] text-text-muted">alçada: {alcadaNecessaria(valorPedido(row.original))}</p>
          </div>
        ),
      },
      {
        id: 'previsaoEntrega',
        header: 'Previsão',
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => (
          <span className={cn('tabular-nums', estaAtrasado(row.original) ? 'font-semibold text-critical' : 'text-text-secondary')}>
            {date(row.original.previsaoEntrega)}
          </span>
        ),
      },
      {
        id: 'recebimento',
        header: 'Recebido',
        enableSorting: false,
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => {
          const p = percentualRecebido(row.original)
          return (
            <div className="text-right">
              <p className="tabular-nums text-text-secondary">{percent(p)}</p>
              <span className="ml-auto mt-1 block h-1 w-20 overflow-hidden rounded-full bg-surface-3">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${p * 100}%` }} />
              </span>
            </div>
          )
        },
      },
      {
        id: 'situacao',
        header: 'Situação',
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tom={situacaoInfo[row.original.situacao].tom}>{situacaoInfo[row.original.situacao].rotulo}</Badge>
            {estaAtrasado(row.original) && <Badge tom="critical">Atrasado</Badge>}
          </div>
        ),
      },
      { id: 'criadoPor', header: 'Comprador', cell: ({ row }) => <span className="text-text-secondary">{row.original.criadoPor}</span> },
      {
        id: 'acoes',
        header: 'Ações',
        enableSorting: false,
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => (
          <button
            type="button"
            title={`Abrir ${row.original.numero}`}
            aria-label={`Abrir ${row.original.numero}`}
            onClick={(e) => { e.stopPropagation(); navigate(`/compras/${row.original.id}`) }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text"
          >
            <span aria-hidden>🧾</span>
          </button>
        ),
      },
    ],
    [navigate],
  )

  const cartoes = [
    { rotulo: 'Aguardando aprovação', valor: totais ? number(totais.aguardandoAprovacao) : null, destaque: 'text-warning' },
    { rotulo: 'Pedidos a receber', valor: totais ? number(totais.aReceber) : null },
    { rotulo: 'Atrasados', valor: totais ? number(totais.atrasados) : null, destaque: 'text-critical', nota: 'previsão já passou' },
    { rotulo: 'Valor em aberto', valor: totais ? money(totais.valorEmAberto) : null, nota: 'pedido menos recebido' },
  ]

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        titulo="Compras"
        descricao="Do pedido ao recebimento — que vira entrada no estoque e conta a pagar."
        acoes={
          <>
            <BotaoExportar
              nomeArquivo="pedidos-de-compra"
              titulo="Pedidos de compra"
              subtitulo={tabela.temFiltro ? 'Recorte filtrado' : 'Todos os pedidos'}
              orientacao="paisagem"
              colunas={[
                { chave: 'numero', cabecalho: 'Pedido', peso: 1.2, valor: (p: PedidoCompra) => p.numero },
                { chave: 'fornecedor', cabecalho: 'Fornecedor', peso: 2, valor: (p: PedidoCompra) => p.fornecedor },
                { chave: 'valor', cabecalho: 'Valor', peso: 1.2, alinhamento: 'direita', valor: (p: PedidoCompra) => money(valorPedido(p)), valorCsv: (p: PedidoCompra) => Number(valorPedido(p).toFixed(2)) },
                { chave: 'previsao', cabecalho: 'Previsão', peso: 1.1, alinhamento: 'direita', valor: (p: PedidoCompra) => date(p.previsaoEntrega), valorCsv: (p: PedidoCompra) => p.previsaoEntrega.slice(0, 10) },
                { chave: 'situacao', cabecalho: 'Situação', peso: 1.4, valor: (p: PedidoCompra) => situacaoInfo[p.situacao].rotulo },
                { chave: 'comprador', cabecalho: 'Comprador', peso: 1.4, valor: (p: PedidoCompra) => p.criadoPor },
              ]}
              buscarLinhas={async () => (await listarPedidos({ ...filtro, page: 1, perPage: 10_000 })).data}
            />
            <Button><span aria-hidden>＋</span> Novo pedido</Button>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cartoes.map((c) => (
          <div key={c.rotulo} className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <p className="text-[13px] font-medium text-text-muted">{c.rotulo}</p>
            {c.valor === null ? <Skeleton className="mt-2 h-7 w-20" /> : (
              <p className={cn('mt-1 text-xl font-semibold tabular-nums lg:text-2xl', c.destaque ?? 'text-text')}>{c.valor}</p>
            )}
            {c.nota && <p className="mt-1 text-[12px] text-text-muted">{c.nota}</p>}
          </div>
        ))}
      </section>

      <div role="tablist" aria-label="Seções de compras" className="flex flex-wrap items-center gap-1 border-b border-border">
        {([
          { id: 'pedidos', rotulo: 'Pedidos', icone: '🧾' },
          { id: 'sugestoes', rotulo: `Sugestões de compra${totais ? ` (${totais.sugestoes})` : ''}`, icone: '📦' },
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

      {aba === 'pedidos' ? (
        <DataTable
          columns={colunas}
          resposta={data}
          carregando={isFetching && !data}
          erro={error}
          sortBy={tabela.sortBy}
          sortDir={tabela.sortDir}
          onSort={tabela.setSort}
          onPage={tabela.setPage}
          onPerPage={tabela.setPerPage}
          onLinhaClick={(p) => navigate(`/compras/${p.id}`)}
          vazio={{ titulo: 'Nenhum pedido com esses filtros', descricao: 'Ajuste a situação ou o fornecedor.' }}
          toolbar={
            <div className="flex flex-wrap items-end gap-2 sm:gap-3">
              <label className="relative min-w-0 flex-1 sm:max-w-xs">
                <span className="sr-only">Buscar pedido</span>
                <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-text-muted">🔍</span>
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Número ou fornecedor…"
                  className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                />
              </label>

              <Select aria-label="Situação" value={tabela.filters?.situacao ?? ''} onChange={(e) => tabela.setFilter('situacao', e.target.value || undefined)} className="w-full sm:w-48">
                <option value="">Todas as situações</option>
                <option value="aguardando_aprovacao">Aguardando aprovação</option>
                <option value="aprovado">Aprovado</option>
                <option value="enviado">Enviado</option>
                <option value="recebido_parcial">Recebido parcial</option>
                <option value="recebido">Recebido</option>
                <option value="atrasado">Atrasado (derivado)</option>
                <option value="cancelado">Cancelado</option>
              </Select>

              <Select aria-label="Fornecedor" value={tabela.filters?.fornecedor ?? ''} onChange={(e) => tabela.setFilter('fornecedor', e.target.value || undefined)} className="w-full sm:w-48">
                <option value="">Todos os fornecedores</option>
                {fornecedoresCompras.map((f) => <option key={f} value={f}>{f}</option>)}
              </Select>

              {tabela.temFiltro && <Button variant="ghost" size="sm" onClick={() => { setBusca(''); tabela.limparFiltros() }}>Limpar</Button>}
            </div>
          }
        />
      ) : (
        <Card>
          <CardHeader
            titulo="Sugestões de compra"
            descricao="Itens que chegaram ao ponto de pedido — o estoque já sabe o que falta"
            acoes={<Button size="sm">Gerar pedido com os selecionados</Button>}
          />
          {sugestoes?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-text-muted">
                    <th className="px-4 py-2.5 text-left font-semibold">Item</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Fornecedor</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Disponível</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Ponto de pedido</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Sugerido</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Custo estimado</th>
                  </tr>
                </thead>
                <tbody>
                  {sugestoes.map((s) => (
                    <tr key={s.itemEstoqueId} className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2">
                      <td className="px-4 py-2.5">
                        <Link to={`/estoque/${s.itemEstoqueId}`} className="text-[13px] font-medium text-text hover:underline">{s.nome}</Link>
                        <p className="font-mono text-[11px] text-text-muted">{s.sku} · reposição em {s.prazoReposicaoDias}d</p>
                      </td>
                      <td className="px-3 py-2.5 text-text-secondary">{s.fornecedor}</td>
                      <td className={cn('px-3 py-2.5 text-right font-semibold tabular-nums', s.disponivel <= 0 ? 'text-critical' : 'text-warning')}>
                        {number(s.disponivel)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-text-secondary">{number(s.pontoDePedido)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text">{number(s.sugerido)} {s.unidade}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">{money(s.sugerido * s.custoMedio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icone="✅" titulo="Nada para repor" descricao="Nenhum item chegou ao ponto de pedido." />
          )}
          <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted">
            A quantidade sugerida cobre o dobro do ponto de pedido: comprar só o que falta devolve o item
            ao gatilho no dia seguinte, e o comprador refaz o mesmo pedido toda semana.
          </p>
        </Card>
      )}
    </div>
  )
}
