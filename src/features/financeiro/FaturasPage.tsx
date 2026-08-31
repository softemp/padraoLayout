import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { listarFaturas, marcarFaturaPaga, totaisFaturas } from '@/shared/api/operacao'
import type { Fatura, StatusFatura } from '@/shared/api/types'
import { useTableState } from '@/shared/hooks/useTableState'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { BotaoExportar } from '@/shared/ui/BotaoExportar'
import { ConfirmarAcao } from '@/shared/ui/ConfirmarAcao'
import { DataTable } from '@/shared/ui/DataTable'
import { Select } from '@/shared/ui/Field'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { date, money, number } from '@/shared/lib/format'

const statusInfo: Record<StatusFatura, { tom: 'good' | 'info' | 'critical' | 'neutro'; rotulo: string }> = {
  paga: { tom: 'good', rotulo: 'Paga' },
  aberta: { tom: 'info', rotulo: 'Em aberto' },
  vencida: { tom: 'critical', rotulo: 'Vencida' },
  cancelada: { tom: 'neutro', rotulo: 'Cancelada' },
}

export function FaturasPage() {
  const qc = useQueryClient()
  const tabela = useTableState({ sortBy: 'vencimento', sortDir: 'desc', filtros: ['status', 'meio'] })
  const [busca, setBusca] = useState(tabela.search ?? '')
  const buscaDebounced = useDebouncedValue(busca, 450)
  const [baixar, setBaixar] = useState<Fatura | null>(null)

  useEffect(() => {
    if (buscaDebounced !== (tabela.search ?? '')) tabela.setSearch(buscaDebounced)
  }, [buscaDebounced]) // eslint-disable-line react-hooks/exhaustive-deps

  const params = {
    page: tabela.page, perPage: tabela.perPage, sortBy: tabela.sortBy, sortDir: tabela.sortDir,
    search: tabela.search, filters: tabela.filters,
  }

  const { data, isFetching, error } = useQuery({
    queryKey: ['faturas', params],
    queryFn: () => listarFaturas(params),
    placeholderData: keepPreviousData,
  })

  // Totalizador do RECORTE inteiro (todas as páginas do filtro atual):
  // somar só a página visível dá um número que não significa nada.
  const { data: totais } = useQuery({
    queryKey: ['faturas-totais', tabela.filters],
    queryFn: () => totaisFaturas(tabela.filters),
  })

  const darBaixa = useMutation({
    mutationFn: marcarFaturaPaga,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['faturas'] })
      void qc.invalidateQueries({ queryKey: ['faturas-totais'] })
      setBaixar(null)
    },
  })

  const colunas = useMemo<ColumnDef<Fatura, unknown>[]>(
    () => [
      {
        id: 'numero',
        header: 'Fatura',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-mono text-[13px] font-medium text-text">{row.original.numero}</p>
            <p className="truncate text-[12px] text-text-muted">{row.original.cliente}</p>
          </div>
        ),
      },
      { id: 'emissao', header: 'Emissão', meta: { alinhamento: 'direita' }, cell: ({ row }) => <span className="tabular-nums">{date(row.original.emissao)}</span> },
      {
        id: 'vencimento',
        header: 'Vencimento',
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => (
          <span className={cn('tabular-nums', row.original.status === 'vencida' && 'font-semibold text-critical')}>
            {date(row.original.vencimento)}
          </span>
        ),
      },
      { id: 'formaPagamento', header: 'Meio', cell: ({ row }) => <span className="text-text-secondary">{row.original.formaPagamento}</span> },
      { id: 'status', header: 'Status', cell: ({ row }) => <Badge tom={statusInfo[row.original.status].tom}>{statusInfo[row.original.status].rotulo}</Badge> },
      { id: 'valor', header: 'Valor', meta: { alinhamento: 'direita' }, cell: ({ row }) => <span className="font-medium tabular-nums text-text">{money(row.original.valor)}</span> },
      {
        id: 'acoes',
        header: 'Ações',
        enableSorting: false,
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => {
          const fatura = row.original
          const podeBaixar = fatura.status === 'aberta' || fatura.status === 'vencida'
          return (
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                title={`Baixar PDF da ${fatura.numero}`}
                aria-label={`Baixar PDF da ${fatura.numero}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text"
              >
                <span aria-hidden>📄</span>
              </button>
              <button
                type="button"
                disabled={!podeBaixar}
                title={podeBaixar ? `Dar baixa na ${fatura.numero}` : 'Só faturas em aberto ou vencidas recebem baixa'}
                aria-label={`Dar baixa na ${fatura.numero}`}
                onClick={(e) => { e.stopPropagation(); setBaixar(fatura) }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-good/10 hover:text-good disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-text-muted"
              >
                <span aria-hidden>✔️</span>
              </button>
            </div>
          )
        },
      },
    ],
    [],
  )

  const cartoes = [
    { rotulo: 'Em aberto', valor: totais ? money(totais.aberto) : null, tom: 'text-text' },
    { rotulo: 'Vencido', valor: totais ? money(totais.vencido) : null, tom: 'text-critical' },
    { rotulo: 'Recebido no mês', valor: totais ? money(totais.recebidoMes) : null, tom: 'text-good' },
    { rotulo: 'Faturas no filtro', valor: totais ? number(totais.quantidade) : null, tom: 'text-text' },
  ]

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        titulo="Faturas"
        descricao="Emissão, vencimento e baixa — com os totais do filtro inteiro, não só da página."
        acoes={
          <>
            <BotaoExportar
              nomeArquivo="faturas"
              titulo="Faturas"
              subtitulo={tabela.filters?.status ? `Status: ${statusInfo[tabela.filters.status as StatusFatura].rotulo}` : 'Todas as faturas'}
              orientacao="paisagem"
              rodape="Documento gerado pelo painel SoftEmp · uso interno"
              colunas={[
                { chave: 'numero', cabecalho: 'Fatura', peso: 1.2, valor: (f: Fatura) => f.numero },
                { chave: 'cliente', cabecalho: 'Cliente', peso: 2.4, valor: (f: Fatura) => f.cliente },
                { chave: 'emissao', cabecalho: 'Emissão', peso: 1, alinhamento: 'direita', valor: (f: Fatura) => date(f.emissao), valorCsv: (f: Fatura) => f.emissao.slice(0, 10) },
                { chave: 'vencimento', cabecalho: 'Vencimento', peso: 1.1, alinhamento: 'direita', valor: (f: Fatura) => date(f.vencimento), valorCsv: (f: Fatura) => f.vencimento.slice(0, 10) },
                { chave: 'status', cabecalho: 'Status', peso: 1, valor: (f: Fatura) => statusInfo[f.status].rotulo },
                { chave: 'valor', cabecalho: 'Valor', peso: 1.1, alinhamento: 'direita', valor: (f: Fatura) => money(f.valor), valorCsv: (f: Fatura) => f.valor },
              ]}
              buscarLinhas={async () => (await listarFaturas({ ...params, page: 1, perPage: 10_000 })).data}
            />
            <Button><span aria-hidden>＋</span> Nova fatura</Button>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cartoes.map((cartao) => (
          <div key={cartao.rotulo} className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <p className="text-[13px] font-medium text-text-muted">{cartao.rotulo}</p>
            {cartao.valor === null ? (
              <Skeleton className="mt-2 h-7 w-28" />
            ) : (
              <p className={cn('mt-1 text-xl font-semibold tabular-nums lg:text-2xl', cartao.tom)}>{cartao.valor}</p>
            )}
          </div>
        ))}
      </section>

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
        vazio={{ titulo: 'Nenhuma fatura com esses filtros', descricao: 'Ajuste o período, o status ou a busca.' }}
        toolbar={
          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
            <label className="relative min-w-0 flex-1 sm:max-w-xs">
              <span className="sr-only">Buscar fatura</span>
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-text-muted">🔍</span>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Número da fatura ou cliente…"
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
              <option value="aberta">Em aberto</option>
              <option value="vencida">Vencida</option>
              <option value="paga">Paga</option>
              <option value="cancelada">Cancelada</option>
            </Select>

            <Select
              aria-label="Filtrar por meio de pagamento"
              value={tabela.filters?.meio ?? ''}
              onChange={(e) => tabela.setFilter('meio', e.target.value || undefined)}
              className="w-full sm:w-40"
            >
              <option value="">Todos os meios</option>
              <option value="PIX">PIX</option>
              <option value="Boleto">Boleto</option>
              <option value="Cartão">Cartão</option>
              <option value="Transferência">Transferência</option>
            </Select>

            {tabela.temFiltro && (
              <Button variant="ghost" size="sm" onClick={() => { setBusca(''); tabela.limparFiltros() }}>Limpar</Button>
            )}
          </div>
        }
      />

      <ConfirmarAcao
        aberto={!!baixar}
        titulo="Dar baixa na fatura"
        rotuloConfirmar="Confirmar baixa"
        tom="primary"
        carregando={darBaixa.isPending}
        onCancelar={() => setBaixar(null)}
        onConfirmar={() => baixar && darBaixa.mutate(baixar.id)}
        mensagem={
          <>
            A fatura <strong className="font-semibold text-text">{baixar?.numero}</strong> de{' '}
            <strong className="font-semibold text-text">{baixar ? money(baixar.valor) : ''}</strong> será marcada
            como paga com a data de hoje. O recebimento passa a contar no total do mês.
          </>
        }
      />
    </div>
  )
}
