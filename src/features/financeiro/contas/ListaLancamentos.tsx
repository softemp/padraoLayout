import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  cancelarLancamento, darBaixa, estaVencido, estornarBaixa, listarCategorias, listarContas,
  listarLancamentos, saldoAberto,
} from '@/shared/api/financeiro'
import type { BaseData, BaixaLancamento, Lancamento, TipoLancamento } from '@/shared/api/types'
import { useTableState } from '@/shared/hooks/useTableState'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { BotaoExportar } from '@/shared/ui/BotaoExportar'
import { ConfirmarAcao } from '@/shared/ui/ConfirmarAcao'
import { DataTable } from '@/shared/ui/DataTable'
import { Select } from '@/shared/ui/Field'
import { cn } from '@/shared/lib/cn'
import { date, money } from '@/shared/lib/format'
import { BaixaModal } from './BaixaModal'

/** O selo mostra "Vencido" para o que está pendente e passou — sem que exista
 *  um status VENCIDO gravado em lugar nenhum. */
function SeloStatus({ lancamento }: { lancamento: Lancamento }) {
  if (lancamento.status === 'cancelado') return <Badge tom="neutro">Cancelado</Badge>
  if (lancamento.status === 'pago') return <Badge tom="good">Pago</Badge>
  if (estaVencido(lancamento)) return <Badge tom="critical">Vencido</Badge>
  if (lancamento.status === 'parcial') return <Badge tom="warning">Parcial</Badge>
  return <Badge tom="info">Pendente</Badge>
}

export function ListaLancamentos({ tipo, base, de, ate }: { tipo: TipoLancamento; base: BaseData; de: string; ate: string }) {
  const qc = useQueryClient()
  const tabela = useTableState({ sortBy: 'vencimento', sortDir: 'asc', filtros: ['status', 'categoria', 'conta'] })
  const [busca, setBusca] = useState(tabela.search ?? '')
  const buscaDebounced = useDebouncedValue(busca, 450)

  const [baixando, setBaixando] = useState<Lancamento | null>(null)
  const [cancelando, setCancelando] = useState<Lancamento | null>(null)
  const [estornando, setEstornando] = useState<Lancamento | null>(null)
  const [erroBaixa, setErroBaixa] = useState<string | null>(null)

  useEffect(() => {
    if (buscaDebounced !== (tabela.search ?? '')) tabela.setSearch(buscaDebounced)
  }, [buscaDebounced]) // eslint-disable-line react-hooks/exhaustive-deps

  const params = {
    page: tabela.page, perPage: tabela.perPage, sortBy: tabela.sortBy, sortDir: tabela.sortDir,
    search: tabela.search, filters: tabela.filters, tipo, base, de, ate,
  }

  const { data, isFetching, error } = useQuery({
    queryKey: ['fin-lancamentos', params],
    queryFn: () => listarLancamentos(params),
    placeholderData: keepPreviousData,
  })
  const { data: categorias } = useQuery({ queryKey: ['fin-categorias'], queryFn: listarCategorias })
  const { data: contas } = useQuery({ queryKey: ['fin-contas'], queryFn: listarContas })

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['fin-lancamentos'] })
    void qc.invalidateQueries({ queryKey: ['fin-totais'] })
    void qc.invalidateQueries({ queryKey: ['fin-contas'] })
    void qc.invalidateQueries({ queryKey: ['fin-fluxo'] })
  }

  const baixa = useMutation({
    mutationFn: ({ id, dados }: { id: number; dados: BaixaLancamento }) => darBaixa(id, dados),
    onSuccess: () => { invalidar(); setBaixando(null); setErroBaixa(null) },
    onError: (e: Error) => setErroBaixa(e.message),
  })
  const cancelar = useMutation({
    mutationFn: cancelarLancamento,
    onSuccess: () => { invalidar(); setCancelando(null) },
  })
  const estorno = useMutation({
    mutationFn: estornarBaixa,
    onSuccess: () => { invalidar(); setEstornando(null) },
  })

  const colunas = useMemo<ColumnDef<Lancamento, unknown>[]>(
    () => [
      {
        id: 'descricao',
        header: 'Lançamento',
        cell: ({ row }) => {
          const l = row.original
          return (
            <div className="min-w-0">
              <p className="truncate font-medium text-text">{l.descricao}</p>
              <p className="truncate text-[12px] text-text-muted">
                {l.contraparte}
                {l.parcela && <> · parcela {l.parcela.numero}/{l.parcela.de}</>}
                {l.origem === 'automatico' && <> · automático</>}
              </p>
            </div>
          )
        },
      },
      {
        id: 'categoriaId',
        header: 'Categoria',
        cell: ({ row }) => (
          <span className="text-text-secondary">{categorias?.find((c) => c.id === row.original.categoriaId)?.nome ?? '—'}</span>
        ),
      },
      {
        id: 'competencia',
        header: 'Competência',
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => <span className="tabular-nums text-text-secondary">{row.original.competencia}</span>,
      },
      {
        id: 'vencimento',
        header: 'Vencimento',
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => (
          <span className={cn('tabular-nums', estaVencido(row.original) && 'font-semibold text-critical')}>
            {date(row.original.vencimento)}
          </span>
        ),
      },
      { id: 'status', header: 'Status', cell: ({ row }) => <SeloStatus lancamento={row.original} /> },
      {
        id: 'valor',
        header: 'Valor',
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => {
          const l = row.original
          const emAberto = saldoAberto(l)
          return (
            <div className="text-right">
              <p className="font-medium tabular-nums text-text">{money(l.valor)}</p>
              {l.valorPago > 0 && l.status !== 'pago' && (
                <p className="text-[11px] tabular-nums text-text-muted">em aberto {money(emAberto)}</p>
              )}
            </div>
          )
        },
      },
      {
        id: 'acoes',
        header: 'Ações',
        enableSorting: false,
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => {
          const l = row.original
          const pago = l.status === 'pago'
          const cancelado = l.status === 'cancelado'
          return (
            <div className="flex items-center justify-end gap-1">
              {!pago && !cancelado && (
                <button
                  type="button"
                  title="Registrar baixa"
                  aria-label={`Registrar baixa de ${l.descricao}`}
                  onClick={(e) => { e.stopPropagation(); setErroBaixa(null); setBaixando(l) }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-good/10 hover:text-good"
                >
                  <span aria-hidden>✔️</span>
                </button>
              )}

              {/* Registro pago é imutável: o caminho de volta é o ESTORNO,
                  que também passa pelo livro-razão. */}
              {pago && (
                <button
                  type="button"
                  title="Estornar baixa"
                  aria-label={`Estornar baixa de ${l.descricao}`}
                  onClick={(e) => { e.stopPropagation(); setEstornando(l) }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-warning/10 hover:text-warning"
                >
                  <span aria-hidden>↩️</span>
                </button>
              )}

              <button
                type="button"
                disabled={pago}
                title={pago ? 'Lançamento pago não é editável — estorne antes' : 'Editar'}
                aria-label={`Editar ${l.descricao}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <span aria-hidden>✏️</span>
              </button>

              <button
                type="button"
                disabled={pago || cancelado}
                title={pago ? 'Lançamento pago não pode ser cancelado' : 'Cancelar lançamento'}
                aria-label={`Cancelar ${l.descricao}`}
                onClick={(e) => { e.stopPropagation(); setCancelando(l) }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-critical/10 hover:text-critical disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <span aria-hidden>🚫</span>
              </button>
            </div>
          )
        },
      },
    ],
    [categorias],
  )

  return (
    <>
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
        vazio={{
          titulo: tipo === 'receber' ? 'Nada a receber neste recorte' : 'Nada a pagar neste recorte',
          descricao: 'Troque o período, a base ou os filtros.',
        }}
        toolbar={
          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
            <label className="relative min-w-0 flex-1 sm:max-w-xs">
              <span className="sr-only">Buscar lançamento</span>
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-text-muted">🔍</span>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Descrição ou contraparte…"
                className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-muted hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
            </label>

            <Select
              aria-label="Filtrar por situação"
              value={tabela.filters?.status ?? ''}
              onChange={(e) => tabela.setFilter('status', e.target.value || undefined)}
              className="w-full sm:w-40"
            >
              <option value="">Todas as situações</option>
              <option value="pendente">Pendente</option>
              <option value="vencido">Vencido</option>
              <option value="parcial">Parcial</option>
              <option value="pago">Pago</option>
              <option value="cancelado">Cancelado</option>
            </Select>

            <Select
              aria-label="Filtrar por categoria"
              value={tabela.filters?.categoria ?? ''}
              onChange={(e) => tabela.setFilter('categoria', e.target.value || undefined)}
              className="w-full sm:w-48"
            >
              <option value="">Todas as categorias</option>
              {categorias?.filter((c) => c.tipo === tipo).map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>

            <Select
              aria-label="Filtrar por conta"
              value={tabela.filters?.conta ?? ''}
              onChange={(e) => tabela.setFilter('conta', e.target.value || undefined)}
              className="w-full sm:w-44"
            >
              <option value="">Todas as contas</option>
              {contas?.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>

            {tabela.temFiltro && (
              <Button variant="ghost" size="sm" onClick={() => { setBusca(''); tabela.limparFiltros() }}>Limpar</Button>
            )}

            <BotaoExportar
              nomeArquivo={tipo === 'receber' ? 'contas-a-receber' : 'contas-a-pagar'}
              titulo={tipo === 'receber' ? 'Contas a receber' : 'Contas a pagar'}
              subtitulo={`Base ${base} · ${date(de)} a ${date(ate)}`}
              orientacao="paisagem"
              rodape="Painel SoftEmp · uso interno"
              tamanho="sm"
              colunas={[
                { chave: 'descricao', cabecalho: 'Lançamento', peso: 2, valor: (l: Lancamento) => l.descricao },
                { chave: 'contraparte', cabecalho: tipo === 'receber' ? 'Cliente' : 'Fornecedor', peso: 1.8, valor: (l: Lancamento) => l.contraparte },
                { chave: 'competencia', cabecalho: 'Competência', peso: 1, alinhamento: 'direita', valor: (l: Lancamento) => l.competencia },
                { chave: 'vencimento', cabecalho: 'Vencimento', peso: 1.1, alinhamento: 'direita', valor: (l: Lancamento) => date(l.vencimento), valorCsv: (l: Lancamento) => l.vencimento.slice(0, 10) },
                { chave: 'status', cabecalho: 'Situação', peso: 1, valor: (l: Lancamento) => (estaVencido(l) ? 'vencido' : l.status) },
                { chave: 'valor', cabecalho: 'Valor', peso: 1.1, alinhamento: 'direita', valor: (l: Lancamento) => money(l.valor), valorCsv: (l: Lancamento) => l.valor },
                { chave: 'aberto', cabecalho: 'Em aberto', peso: 1.1, alinhamento: 'direita', valor: (l: Lancamento) => money(saldoAberto(l)), valorCsv: (l: Lancamento) => saldoAberto(l) },
              ]}
              buscarLinhas={async () => (await listarLancamentos({ ...params, page: 1, perPage: 10_000 })).data}
            />
          </div>
        }
      />

      <BaixaModal
        lancamento={baixando}
        salvando={baixa.isPending}
        erro={erroBaixa}
        onFechar={() => { setBaixando(null); setErroBaixa(null) }}
        onConfirmar={(dados) => baixando && baixa.mutate({ id: baixando.id, dados })}
      />

      <ConfirmarAcao
        aberto={!!cancelando}
        titulo="Cancelar lançamento"
        rotuloConfirmar="Cancelar lançamento"
        carregando={cancelar.isPending}
        onCancelar={() => setCancelando(null)}
        onConfirmar={() => cancelando && cancelar.mutate(cancelando.id)}
        mensagem={
          <>
            <strong className="font-semibold text-text">{cancelando?.descricao}</strong> deixa de contar nas
            previsões e nos totais. O registro permanece no histórico — cancelado não é apagado.
          </>
        }
      />

      <ConfirmarAcao
        aberto={!!estornando}
        titulo="Estornar baixa"
        rotuloConfirmar="Estornar baixa"
        tom="primary"
        carregando={estorno.isPending}
        onCancelar={() => setEstornando(null)}
        onConfirmar={() => estornando && estorno.mutate(estornando.id)}
        mensagem={
          <>
            O pagamento de <strong className="font-semibold text-text">{estornando?.descricao}</strong> volta
            a ficar em aberto e o saldo da conta é corrigido por um movimento de estorno — o saldo nunca é
            reescrito, é sempre um movimento novo.
          </>
        }
      />
    </>
  )
}
