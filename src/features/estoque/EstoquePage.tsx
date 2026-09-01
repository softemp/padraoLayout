import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  abaixoDaSeguranca, categorias, diasDeCobertura, disponivel, fornecedores, listarItens,
  pontoDePedido, precisaRepor, semEstoque, semGiro, totaisEstoque,
} from '@/shared/api/estoque'
import type { ItemEstoque } from '@/shared/api/types'
import { useTableState } from '@/shared/hooks/useTableState'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { BotaoExportar } from '@/shared/ui/BotaoExportar'
import { Card, CardHeader } from '@/shared/ui/Card'
import { DataTable } from '@/shared/ui/DataTable'
import { Select } from '@/shared/ui/Field'
import { PageHeader } from '@/shared/ui/PageHeader'
import { cn } from '@/shared/lib/cn'
import { CartaoResumo, GradeResumo } from '@/shared/ui/CartaoResumo'
import { money, number } from '@/shared/lib/format'

export function EstoquePage() {
  const navigate = useNavigate()
  const tabela = useTableState({ sortBy: 'nome', sortDir: 'asc', filtros: ['categoria', 'fornecedor', 'situacao'] })
  const [busca, setBusca] = useState(tabela.search ?? '')
  const buscaDebounced = useDebouncedValue(busca, 450)

  useEffect(() => {
    if (buscaDebounced !== (tabela.search ?? '')) tabela.setSearch(buscaDebounced)
  }, [buscaDebounced]) // eslint-disable-line react-hooks/exhaustive-deps

  const params = {
    page: tabela.page, perPage: tabela.perPage, sortBy: tabela.sortBy, sortDir: tabela.sortDir,
    search: tabela.search, filters: tabela.filters,
  }

  const { data, isFetching, error } = useQuery({
    queryKey: ['estoque', params],
    queryFn: () => listarItens(params),
    placeholderData: keepPreviousData,
  })
  const { data: totais } = useQuery({ queryKey: ['estoque-totais'], queryFn: totaisEstoque })

  const colunas = useMemo<ColumnDef<ItemEstoque, unknown>[]>(
    () => [
      {
        id: 'nome',
        header: 'Item',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-text">{row.original.nome}</p>
            <p className="truncate font-mono text-[12px] text-text-muted">
              {row.original.sku} · {row.original.categoria} · {row.original.localizacao}
            </p>
          </div>
        ),
      },
      {
        id: 'saldo',
        header: 'Saldo',
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => {
          const i = row.original
          return (
            <div className="text-right">
              <p className="font-medium tabular-nums text-text">{number(i.saldo)} {i.unidade}</p>
              {i.reservado > 0 && (
                <p className="text-[11px] tabular-nums text-text-muted">{number(i.reservado)} reservado</p>
              )}
            </div>
          )
        },
      },
      {
        id: 'disponivel',
        header: 'Disponível',
        enableSorting: false,
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => {
          const i = row.original
          const d = disponivel(i)
          const cobertura = diasDeCobertura(i)
          return (
            <div className="text-right">
              <p className={cn('font-semibold tabular-nums', d <= 0 ? 'text-critical' : precisaRepor(i) ? 'text-warning' : 'text-text')}>
                {number(d)}
              </p>
              {cobertura !== null && (
                <p className="text-[11px] text-text-muted">{cobertura} dias de cobertura</p>
              )}
            </div>
          )
        },
      },
      {
        id: 'pontoPedido',
        header: 'Ponto de pedido',
        enableSorting: false,
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => {
          const i = row.original
          return (
            <div className="text-right">
              <p className="tabular-nums text-text-secondary">{number(pontoDePedido(i))}</p>
              <p className="text-[11px] text-text-muted">{i.consumoMedioDiario}/dia · {i.prazoReposicaoDias}d</p>
            </div>
          )
        },
      },
      {
        id: 'custoMedio',
        header: 'Custo médio',
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => (
          <div className="text-right">
            <p className="tabular-nums text-text">{money(row.original.custoMedio)}</p>
            <p className="text-[11px] tabular-nums text-text-muted">total {money(row.original.custoMedio * row.original.saldo)}</p>
          </div>
        ),
      },
      {
        id: 'situacao',
        header: 'Situação',
        enableSorting: false,
        cell: ({ row }) => {
          const i = row.original
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              {!i.ativo && <Badge tom="neutro">Inativo</Badge>}
              {semEstoque(i) && <Badge tom="critical">Sem estoque</Badge>}
              {!semEstoque(i) && abaixoDaSeguranca(i) && <Badge tom="critical">Abaixo da segurança</Badge>}
              {!semEstoque(i) && !abaixoDaSeguranca(i) && precisaRepor(i) && <Badge tom="warning">Repor</Badge>}
              {i.ativo && !precisaRepor(i) && <Badge tom="good">Ok</Badge>}
              {semGiro(i) && <Badge tom="neutro">Sem giro</Badge>}
            </div>
          )
        },
      },
      {
        id: 'acoes',
        header: 'Ações',
        enableSorting: false,
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => (
          <button
            type="button"
            title={`Abrir ${row.original.sku}`}
            aria-label={`Abrir ${row.original.sku}`}
            onClick={(e) => { e.stopPropagation(); navigate(`/estoque/${row.original.id}`) }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text"
          >
            <span aria-hidden>📦</span>
          </button>
        ),
      },
    ],
    [navigate],
  )

  const cartoes = [
    { rotulo: 'Itens ativos', valor: totais ? number(totais.itens) : null },
    { rotulo: 'Valor do estoque', valor: totais ? money(totais.valorTotal) : null, nota: 'avaliado pelo custo médio' },
    { rotulo: 'Precisam repor', valor: totais ? number(totais.precisamRepor) : null, destaque: 'text-warning', nota: 'chegaram ao ponto de pedido' },
    { rotulo: 'Sem giro (120 dias)', valor: totais ? number(totais.semGiro) : null, nota: 'dinheiro parado na prateleira' },
  ]

  return (
    <div className="space-y-2 sm:space-y-4 lg:space-y-6">
      <PageHeader
        titulo="Estoque"
        descricao="Saldo, disponível e ponto de pedido — com o custo médio saindo do próprio kardex."
        acoes={
          <>
            <BotaoExportar
              nomeArquivo="estoque"
              titulo="Posição de estoque"
              subtitulo={tabela.temFiltro ? 'Recorte filtrado' : 'Todos os itens'}
              orientacao="paisagem"
              rodape="Estoque avaliado pelo custo médio · uso interno"
              colunas={[
                { chave: 'sku', cabecalho: 'SKU', peso: 1, valor: (i: ItemEstoque) => i.sku },
                { chave: 'nome', cabecalho: 'Item', peso: 2.4, valor: (i: ItemEstoque) => i.nome },
                { chave: 'saldo', cabecalho: 'Saldo', peso: 0.9, alinhamento: 'direita', valor: (i: ItemEstoque) => `${i.saldo}`, valorCsv: (i: ItemEstoque) => i.saldo },
                { chave: 'reservado', cabecalho: 'Reservado', peso: 1, alinhamento: 'direita', valor: (i: ItemEstoque) => `${i.reservado}`, valorCsv: (i: ItemEstoque) => i.reservado },
                { chave: 'disponivel', cabecalho: 'Disponível', peso: 1, alinhamento: 'direita', valor: (i: ItemEstoque) => `${disponivel(i)}`, valorCsv: (i: ItemEstoque) => disponivel(i) },
                { chave: 'ponto', cabecalho: 'Ponto de pedido', peso: 1.2, alinhamento: 'direita', valor: (i: ItemEstoque) => `${pontoDePedido(i)}`, valorCsv: (i: ItemEstoque) => pontoDePedido(i) },
                { chave: 'custo', cabecalho: 'Custo médio', peso: 1.2, alinhamento: 'direita', valor: (i: ItemEstoque) => money(i.custoMedio), valorCsv: (i: ItemEstoque) => i.custoMedio },
                { chave: 'total', cabecalho: 'Valor em estoque', peso: 1.3, alinhamento: 'direita', valor: (i: ItemEstoque) => money(i.custoMedio * i.saldo), valorCsv: (i: ItemEstoque) => Number((i.custoMedio * i.saldo).toFixed(2)) },
              ]}
              buscarLinhas={async () => (await listarItens({ ...params, page: 1, perPage: 10_000 })).data}
            />
            <Button><span aria-hidden>＋</span> Novo item</Button>
          </>
        }
      />

      <GradeResumo>
        {cartoes.map((cartao) => (
          <CartaoResumo
            key={cartao.rotulo}
            rotulo={cartao.rotulo}
            valor={cartao.valor}
            nota={cartao.nota}
            destaque={cartao.destaque}
          />
        ))}
      </GradeResumo>

      {(totais?.precisamRepor ?? 0) > 0 && (
        <Card className="border-warning/40">
          <CardHeader
            titulo={`${number(totais!.precisamRepor)} itens no ponto de pedido`}
            descricao="Ponto de pedido = consumo médio × prazo de reposição + estoque de segurança. Esperar chegar ao mínimo é pedir tarde."
            acoes={
              <Button size="sm" variant="secondary" onClick={() => tabela.setFilter('situacao', 'repor')}>
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
        onLinhaClick={(i) => navigate(`/estoque/${i.id}`)}
        vazio={{ titulo: 'Nenhum item com esses filtros', descricao: 'Ajuste a categoria, o fornecedor ou a situação.' }}
        toolbar={
          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
            <label className="relative min-w-0 flex-1 sm:max-w-xs">
              <span className="sr-only">Buscar item</span>
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-text-muted">🔍</span>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome ou SKU…"
                className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
            </label>

            <Select aria-label="Situação" value={tabela.filters?.situacao ?? ''} onChange={(e) => tabela.setFilter('situacao', e.target.value || undefined)} className="w-full sm:w-48">
              <option value="">Todas as situações</option>
              <option value="repor">No ponto de pedido (derivado)</option>
              <option value="sem_estoque">Sem estoque (derivado)</option>
              <option value="sem_giro">Sem giro há 120 dias</option>
              <option value="inativo">Inativos</option>
            </Select>

            <Select aria-label="Categoria" value={tabela.filters?.categoria ?? ''} onChange={(e) => tabela.setFilter('categoria', e.target.value || undefined)} className="w-full sm:w-44">
              <option value="">Todas as categorias</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>

            <Select aria-label="Fornecedor" value={tabela.filters?.fornecedor ?? ''} onChange={(e) => tabela.setFilter('fornecedor', e.target.value || undefined)} className="w-full sm:w-48">
              <option value="">Todos os fornecedores</option>
              {fornecedores.map((f) => <option key={f} value={f}>{f}</option>)}
            </Select>

            {tabela.temFiltro && <Button variant="ghost" size="sm" onClick={() => { setBusca(''); tabela.limparFiltros() }}>Limpar</Button>}
          </div>
        }
      />
    </div>
  )
}
