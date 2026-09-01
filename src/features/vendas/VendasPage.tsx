import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  listarVendas, margemVenda, MARGEM_PISO, orcamentoVencido, percentualFaturado,
  precisaAprovarDesconto, totaisVendas, valorVenda, VENDEDORES,
} from '@/shared/api/vendas'
import type { PedidoVenda, SituacaoVenda } from '@/shared/api/types'
import { useTableState } from '@/shared/hooks/useTableState'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { BotaoExportar } from '@/shared/ui/BotaoExportar'
import { Card, CardHeader } from '@/shared/ui/Card'
import { DataTable } from '@/shared/ui/DataTable'
import { Select } from '@/shared/ui/Field'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { money, number, percent } from '@/shared/lib/format'

const situacaoInfo: Record<SituacaoVenda, { tom: 'neutro' | 'warning' | 'info' | 'good' | 'critical'; rotulo: string }> = {
  orcamento: { tom: 'neutro', rotulo: 'Orçamento' },
  aguardando_desconto: { tom: 'warning', rotulo: 'Aguardando desconto' },
  confirmado: { tom: 'info', rotulo: 'Confirmado' },
  faturado_parcial: { tom: 'warning', rotulo: 'Faturado parcial' },
  faturado: { tom: 'good', rotulo: 'Faturado' },
  cancelado: { tom: 'neutro', rotulo: 'Cancelado' },
}

export function VendasPage() {
  const navigate = useNavigate()
  const tabela = useTableState({ sortBy: 'criadoEm', sortDir: 'desc', filtros: ['situacao', 'vendedor'] })
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
    queryKey: ['vendas', filtro],
    queryFn: () => listarVendas(filtro),
    placeholderData: keepPreviousData,
  })
  const { data: totais } = useQuery({ queryKey: ['vendas-totais'], queryFn: totaisVendas })

  const colunas = useMemo<ColumnDef<PedidoVenda, unknown>[]>(
    () => [
      {
        id: 'numero',
        header: 'Pedido',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-mono text-[13px] font-medium text-text">{row.original.numero}</p>
            <p className="truncate text-[12px] text-text-muted">{row.original.cliente}</p>
          </div>
        ),
      },
      {
        id: 'valor',
        header: 'Valor',
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => <span className="font-medium tabular-nums text-text">{money(valorVenda(row.original))}</span>,
      },
      {
        id: 'margem',
        header: 'Margem',
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => {
          const m = margemVenda(row.original)
          return (
            <div className="text-right">
              <p className={cn('font-semibold tabular-nums', m <= 0 ? 'text-critical' : m < MARGEM_PISO ? 'text-warning' : 'text-good')}>
                {percent(m)}
              </p>
              {m < MARGEM_PISO && <p className="text-[11px] text-text-muted">piso {percent(MARGEM_PISO)}</p>}
            </div>
          )
        },
      },
      {
        id: 'faturamento',
        header: 'Faturado',
        enableSorting: false,
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => {
          const p = percentualFaturado(row.original)
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
            {orcamentoVencido(row.original) && <Badge tom="critical">Orçamento vencido</Badge>}
            {precisaAprovarDesconto(row.original) && row.original.situacao !== 'cancelado' && (
              <Badge tom="warning">Margem abaixo do piso</Badge>
            )}
          </div>
        ),
      },
      { id: 'vendedor', header: 'Vendedor', cell: ({ row }) => <span className="text-text-secondary">{row.original.vendedor}</span> },
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
            onClick={(e) => { e.stopPropagation(); navigate(`/vendas/${row.original.id}`) }}
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
    { rotulo: 'Em orçamento', valor: totais ? number(totais.emOrcamento) : null },
    { rotulo: 'Desconto a aprovar', valor: totais ? number(totais.aguardandoDesconto) : null, destaque: 'text-warning' },
    { rotulo: 'A faturar', valor: totais ? number(totais.aFaturar) : null, nota: 'estoque já reservado' },
    { rotulo: 'Margem média', valor: totais ? percent(totais.margemMedia) : null, destaque: totais && totais.margemMedia < MARGEM_PISO ? 'text-warning' : 'text-good', nota: `piso ${percent(MARGEM_PISO)}` },
  ]

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        titulo="Vendas"
        descricao="Orçamento → confirmação (reserva o estoque) → faturamento (baixa e gera a conta a receber)."
        acoes={
          <>
            <BotaoExportar
              nomeArquivo="pedidos-de-venda"
              titulo="Pedidos de venda"
              subtitulo={tabela.temFiltro ? 'Recorte filtrado' : 'Todos os pedidos'}
              orientacao="paisagem"
              colunas={[
                { chave: 'numero', cabecalho: 'Pedido', peso: 1.2, valor: (p: PedidoVenda) => p.numero },
                { chave: 'cliente', cabecalho: 'Cliente', peso: 2.2, valor: (p: PedidoVenda) => p.cliente },
                { chave: 'valor', cabecalho: 'Valor', peso: 1.2, alinhamento: 'direita', valor: (p: PedidoVenda) => money(valorVenda(p)), valorCsv: (p: PedidoVenda) => Number(valorVenda(p).toFixed(2)) },
                { chave: 'margem', cabecalho: 'Margem', peso: 1, alinhamento: 'direita', valor: (p: PedidoVenda) => percent(margemVenda(p)), valorCsv: (p: PedidoVenda) => Number((margemVenda(p) * 100).toFixed(1)) },
                { chave: 'situacao', cabecalho: 'Situação', peso: 1.4, valor: (p: PedidoVenda) => situacaoInfo[p.situacao].rotulo },
                { chave: 'vendedor', cabecalho: 'Vendedor', peso: 1.4, valor: (p: PedidoVenda) => p.vendedor },
              ]}
              buscarLinhas={async () => (await listarVendas({ ...filtro, page: 1, perPage: 10_000 })).data}
            />
            <Button><span aria-hidden>＋</span> Novo orçamento</Button>
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

      {(totais?.aguardandoDesconto ?? 0) > 0 && (
        <Card className="border-warning/40">
          <CardHeader
            titulo={`${number(totais!.aguardandoDesconto)} pedidos com desconto a aprovar`}
            descricao="O gatilho é a MARGEM, não o percentual: 10% num item de margem gorda é indolor, 10% num item de margem fina vende no prejuízo."
            acoes={
              <Button size="sm" variant="secondary" onClick={() => tabela.setFilter('situacao', 'aguardando_desconto')}>
                Ver só esses
              </Button>
            }
          />
        </Card>
      )}

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
        onLinhaClick={(p) => navigate(`/vendas/${p.id}`)}
        vazio={{ titulo: 'Nenhum pedido com esses filtros', descricao: 'Ajuste a situação ou o vendedor.' }}
        toolbar={
          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
            <label className="relative min-w-0 flex-1 sm:max-w-xs">
              <span className="sr-only">Buscar pedido</span>
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-text-muted">🔍</span>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Número ou cliente…"
                className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
            </label>

            <Select aria-label="Situação" value={tabela.filters?.situacao ?? ''} onChange={(e) => tabela.setFilter('situacao', e.target.value || undefined)} className="w-full sm:w-52">
              <option value="">Todas as situações</option>
              <option value="orcamento">Orçamento</option>
              <option value="vencido">Orçamento vencido (derivado)</option>
              <option value="aguardando_desconto">Aguardando desconto</option>
              <option value="margem_baixa">Margem abaixo do piso (derivado)</option>
              <option value="confirmado">Confirmado</option>
              <option value="faturado_parcial">Faturado parcial</option>
              <option value="faturado">Faturado</option>
              <option value="cancelado">Cancelado</option>
            </Select>

            <Select aria-label="Vendedor" value={tabela.filters?.vendedor ?? ''} onChange={(e) => tabela.setFilter('vendedor', e.target.value || undefined)} className="w-full sm:w-44">
              <option value="">Todos os vendedores</option>
              {VENDEDORES.map((v) => <option key={v} value={v}>{v}</option>)}
            </Select>

            {tabela.temFiltro && <Button variant="ghost" size="sm" onClick={() => { setBusca(''); tabela.limparFiltros() }}>Limpar</Button>}
          </div>
        }
      />
    </div>
  )
}
