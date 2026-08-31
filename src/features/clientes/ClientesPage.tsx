import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { listarClientes } from '@/shared/api/api'
import { useTableState } from '@/shared/hooks/useTableState'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { DataTable } from '@/shared/ui/DataTable'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { BotaoExportar } from '@/shared/ui/BotaoExportar'
import { Select } from '@/shared/ui/Field'
import { colunasClientes } from './colunas'
import { exportacaoClientes } from './exportacao'

export function ClientesPage() {
  const tabela = useTableState({ sortBy: 'nome', sortDir: 'asc' })
  const [busca, setBusca] = useState(tabela.search ?? '')
  const buscaDebounced = useDebouncedValue(busca, 450)

  // Digitou → espera parar → busca no servidor e volta para a página 1.
  useEffect(() => {
    if (buscaDebounced !== (tabela.search ?? '')) tabela.setSearch(buscaDebounced)
  }, [buscaDebounced]) // eslint-disable-line react-hooks/exhaustive-deps

  const paramsAtuais = {
    page: tabela.page,
    perPage: tabela.perPage,
    sortBy: tabela.sortBy,
    sortDir: tabela.sortDir,
    search: tabela.search,
    filters: tabela.filters,
  }

  const { data, isFetching, error } = useQuery({
    queryKey: ['clientes', tabela.page, tabela.perPage, tabela.sortBy, tabela.sortDir, tabela.search, tabela.filters],
    queryFn: () => listarClientes(paramsAtuais),
    // Mantém a página anterior visível enquanto a nova chega: a tabela não
    // pisca em branco a cada clique de paginação.
    placeholderData: keepPreviousData,
  })

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        titulo="Clientes"
        descricao="Paginação, ordenação e busca acontecem no servidor — a tela abre igual com 200 ou 200 mil linhas."
        acoes={
          <>
            {/* Os três formatos ligados: CSV, PDF e impressão direta. */}
            <BotaoExportar {...exportacaoClientes(paramsAtuais)} />
            <Button>
              <span aria-hidden>＋</span> Novo cliente
            </Button>
          </>
        }
      />

      <DataTable
        columns={colunasClientes}
        resposta={data}
        carregando={isFetching && !data}
        erro={error}
        sortBy={tabela.sortBy}
        sortDir={tabela.sortDir}
        onSort={tabela.setSort}
        onPage={tabela.setPage}
        onPerPage={tabela.setPerPage}
        onLinhaClick={() => { /* abriria o detalhe do cliente */ }}
        vazio={{
          titulo: 'Nenhum cliente com esses filtros',
          descricao: 'Ajuste a busca ou limpe os filtros para ver a lista completa.',
          acao: (
            <Button variant="secondary" size="sm" onClick={() => { setBusca(''); tabela.limparFiltros() }}>
              Limpar filtros
            </Button>
          ),
        }}
        toolbar={
          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
            <label className="relative min-w-0 flex-1 sm:max-w-xs">
              <span className="sr-only">Buscar cliente</span>
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-text-muted">🔍</span>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome, e-mail ou documento…"
                className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-muted hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
            </label>

            <Select
              aria-label="Filtrar por status"
              value={tabela.filters?.status ?? ''}
              onChange={(e) => tabela.setFilter('status', e.target.value || undefined)}
              className="w-full sm:w-44"
            >
              <option value="">Todos os status</option>
              <option value="ativo">Ativo</option>
              <option value="pendente">Pendente</option>
              <option value="inadimplente">Inadimplente</option>
              <option value="inativo">Inativo</option>
            </Select>

            <Select
              aria-label="Filtrar por plano"
              value={tabela.filters?.plano ?? ''}
              onChange={(e) => tabela.setFilter('plano', e.target.value || undefined)}
              className="w-full sm:w-40"
            >
              <option value="">Todos os planos</option>
              <option value="Starter">Starter</option>
              <option value="Pro">Pro</option>
              <option value="Enterprise">Enterprise</option>
            </Select>

            {tabela.temFiltro && (
              <Button variant="ghost" size="sm" onClick={() => { setBusca(''); tabela.limparFiltros() }}>
                Limpar
              </Button>
            )}

            {isFetching && (
              <span className="ml-auto hidden items-center gap-2 text-[12px] text-text-muted sm:flex">
                <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
                atualizando…
              </span>
            )}
          </div>
        }
      />
    </div>
  )
}
