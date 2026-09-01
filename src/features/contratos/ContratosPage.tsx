import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  diasParaVencer, estaVencendo, gestores, listarContratos, prazoDeAvisoPerdido,
  reajusteDevido, totaisContratos,
} from '@/shared/api/contratos'
import type { Contrato, StatusContrato } from '@/shared/api/types'
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
import { date, money, number } from '@/shared/lib/format'

const statusInfo: Record<StatusContrato, { tom: 'good' | 'info' | 'warning' | 'neutro' | 'critical'; rotulo: string }> = {
  rascunho: { tom: 'neutro', rotulo: 'Rascunho' },
  em_assinatura: { tom: 'warning', rotulo: 'Em assinatura' },
  vigente: { tom: 'good', rotulo: 'Vigente' },
  encerrado: { tom: 'neutro', rotulo: 'Encerrado' },
  rescindido: { tom: 'critical', rotulo: 'Rescindido' },
}

export function ContratosPage() {
  const navigate = useNavigate()
  const tabela = useTableState({ sortBy: 'fim', sortDir: 'asc', filtros: ['status', 'gestor', 'indice'] })
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
    queryKey: ['contratos', params],
    queryFn: () => listarContratos(params),
    placeholderData: keepPreviousData,
  })
  const { data: totais } = useQuery({ queryKey: ['contratos-totais'], queryFn: totaisContratos })

  const colunas = useMemo<ColumnDef<Contrato, unknown>[]>(
    () => [
      {
        id: 'numero',
        header: 'Contrato',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-mono text-[13px] font-medium text-text">{row.original.numero}</p>
            <p className="truncate text-[12px] text-text-muted">{row.original.cliente}</p>
          </div>
        ),
      },
      { id: 'objeto', header: 'Objeto', cell: ({ row }) => <span className="text-text-secondary">{row.original.objeto}</span> },
      {
        id: 'valorMensal',
        header: 'Mensal',
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => <span className="font-medium tabular-nums text-text">{money(row.original.valorMensal)}</span>,
      },
      {
        id: 'fim',
        header: 'Vigência até',
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => {
          const c = row.original
          const dias = diasParaVencer(c)
          return (
            <div className="text-right">
              <p className={cn('tabular-nums', estaVencendo(c) && 'font-semibold text-warning')}>{date(c.fim)}</p>
              {c.status === 'vigente' && (
                <p className="text-[11px] text-text-muted">
                  {dias >= 0 ? `em ${number(dias)} dias` : `venceu há ${number(Math.abs(dias))} dias`}
                </p>
              )}
            </div>
          )
        },
      },
      {
        id: 'status',
        header: 'Situação',
        cell: ({ row }) => {
          const c = row.original
          const info = statusInfo[c.status]
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tom={info.tom}>{info.rotulo}</Badge>
              {/* Derivados: nenhum deles é status gravado. */}
              {estaVencendo(c) && <Badge tom="warning">Vencendo</Badge>}
              {reajusteDevido(c) && <Badge tom="info">Reajuste devido</Badge>}
              {prazoDeAvisoPerdido(c) && <Badge tom="critical">Aviso vencido</Badge>}
            </div>
          )
        },
      },
      { id: 'gestor', header: 'Gestor', cell: ({ row }) => <span className="text-text-secondary">{row.original.gestor}</span> },
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
            onClick={(e) => { e.stopPropagation(); navigate(`/contratos/${row.original.id}`) }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text"
          >
            <span aria-hidden>📄</span>
          </button>
        ),
      },
    ],
    [navigate],
  )

  const cartoes = [
    { rotulo: 'Contratos vigentes', valor: totais ? number(totais.vigentes) : null, nota: totais ? `${money(totais.receitaMensal)} por mês` : undefined },
    { rotulo: 'Vencendo na janela de aviso', valor: totais ? number(totais.vencendo) : null, nota: 'exigem decisão de renovar', destaque: 'text-warning' },
    { rotulo: 'Aguardando assinatura', valor: totais ? number(totais.semAssinatura) : null, nota: 'ainda não vigoram' },
    { rotulo: 'Reajuste devido', valor: totais ? number(totais.reajustePendente) : null, nota: 'passou o aniversário da data-base', destaque: 'text-primary' },
  ]

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        titulo="Contratos"
        descricao="Vigência, valor, reajuste e assinatura — com o alerta chegando antes do prazo de aviso."
        acoes={
          <>
            <BotaoExportar
              nomeArquivo="contratos"
              titulo="Carteira de contratos"
              subtitulo={tabela.temFiltro ? 'Recorte filtrado' : 'Todos os contratos'}
              orientacao="paisagem"
              rodape="Painel SoftEmp · uso interno"
              colunas={[
                { chave: 'numero', cabecalho: 'Contrato', peso: 1.2, valor: (c: Contrato) => c.numero },
                { chave: 'cliente', cabecalho: 'Cliente', peso: 2.2, valor: (c: Contrato) => c.cliente },
                { chave: 'objeto', cabecalho: 'Objeto', peso: 2, valor: (c: Contrato) => c.objeto },
                { chave: 'valor', cabecalho: 'Mensal', peso: 1.1, alinhamento: 'direita', valor: (c: Contrato) => money(c.valorMensal), valorCsv: (c: Contrato) => c.valorMensal },
                { chave: 'inicio', cabecalho: 'Início', peso: 1.1, alinhamento: 'direita', valor: (c: Contrato) => date(c.inicio), valorCsv: (c: Contrato) => c.inicio.slice(0, 10) },
                { chave: 'fim', cabecalho: 'Vigência até', peso: 1.1, alinhamento: 'direita', valor: (c: Contrato) => date(c.fim), valorCsv: (c: Contrato) => c.fim.slice(0, 10) },
                { chave: 'status', cabecalho: 'Situação', peso: 1.1, valor: (c: Contrato) => statusInfo[c.status].rotulo },
              ]}
              buscarLinhas={async () => (await listarContratos({ ...params, page: 1, perPage: 10_000 })).data}
            />
            <Button><span aria-hidden>＋</span> Novo contrato</Button>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cartoes.map((cartao) => (
          <div key={cartao.rotulo} className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <p className="text-[13px] font-medium text-text-muted">{cartao.rotulo}</p>
            {cartao.valor === null ? (
              <Skeleton className="mt-2 h-7 w-20" />
            ) : (
              <p className={cn('mt-1 text-xl font-semibold tabular-nums lg:text-2xl', cartao.destaque ?? 'text-text')}>{cartao.valor}</p>
            )}
            {cartao.nota && <p className="mt-1 text-[12px] text-text-muted">{cartao.nota}</p>}
          </div>
        ))}
      </section>

      {/* O alerta que decide dinheiro: renovação automática cujo prazo de
          aviso já passou. Depois disso, não renovar deixou de ser opção. */}
      {(totais?.vencendo ?? 0) > 0 && (
        <Card className="border-warning/40">
          <CardHeader
            titulo="Contratos na janela de aviso prévio"
            descricao="Decidir renovar ou avisar a não renovação ANTES do prazo — depois, a renovação já aconteceu"
            acoes={
              <Button size="sm" variant="secondary" onClick={() => tabela.setFilter('status', 'vencendo')}>
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
        onLinhaClick={(c) => navigate(`/contratos/${c.id}`)}
        vazio={{ titulo: 'Nenhum contrato com esses filtros', descricao: 'Ajuste a busca, a situação ou o gestor.' }}
        toolbar={
          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
            <label className="relative min-w-0 flex-1 sm:max-w-xs">
              <span className="sr-only">Buscar contrato</span>
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-text-muted">🔍</span>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Número, cliente ou objeto…"
                className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-muted hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
            </label>

            <Select
              aria-label="Filtrar por situação"
              value={tabela.filters?.status ?? ''}
              onChange={(e) => tabela.setFilter('status', e.target.value || undefined)}
              className="w-full sm:w-48"
            >
              <option value="">Todas as situações</option>
              <option value="vigente">Vigente</option>
              <option value="vencendo">Vencendo (derivado)</option>
              <option value="reajuste">Reajuste devido (derivado)</option>
              <option value="em_assinatura">Em assinatura</option>
              <option value="rascunho">Rascunho</option>
              <option value="encerrado">Encerrado</option>
              <option value="rescindido">Rescindido</option>
            </Select>

            <Select
              aria-label="Filtrar por gestor"
              value={tabela.filters?.gestor ?? ''}
              onChange={(e) => tabela.setFilter('gestor', e.target.value || undefined)}
              className="w-full sm:w-44"
            >
              <option value="">Todos os gestores</option>
              {gestores.map((g) => <option key={g} value={g}>{g}</option>)}
            </Select>

            <Select
              aria-label="Filtrar por índice"
              value={tabela.filters?.indice ?? ''}
              onChange={(e) => tabela.setFilter('indice', e.target.value || undefined)}
              className="w-full sm:w-40"
            >
              <option value="">Todos os índices</option>
              <option value="IPCA">IPCA</option>
              <option value="IGP-M">IGP-M</option>
              <option value="INPC">INPC</option>
              <option value="sem_reajuste">Sem reajuste</option>
            </Select>

            {tabela.temFiltro && (
              <Button variant="ghost" size="sm" onClick={() => { setBusca(''); tabela.limparFiltros() }}>Limpar</Button>
            )}
          </div>
        }
      />
    </div>
  )
}
