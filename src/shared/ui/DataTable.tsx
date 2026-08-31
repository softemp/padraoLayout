import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import type { ListResponse } from '@/shared/api/types'
import { EmptyState } from './EmptyState'
import { Pagination } from './Pagination'
import { PageSizeSelect } from './PageSizeSelect'
import { SkeletonLinhas } from './Skeleton'

/**
 * DataTable ÚNICO do projeto (TanStack Table headless).
 * Server-side de verdade: manualPagination/manualSorting — a tabela NÃO ordena
 * nem pagina em memória; ela só mostra o que a API devolveu. Tela que funciona
 * com 20 linhas de teste trava com as 10.712 reais.
 *
 * Reuso: passe `columns` + o estado vindo de useTableState. Nada de tabela nova por tela.
 */
export type DataTableProps<T> = {
  columns: ColumnDef<T, unknown>[]
  resposta?: ListResponse<T>
  carregando?: boolean
  erro?: unknown
  sortBy: string
  sortDir: 'asc' | 'desc'
  onSort: (coluna: string) => void
  onPage: (p: number) => void
  onPerPage: (p: number) => void
  toolbar?: ReactNode
  vazio?: { titulo: string; descricao?: string; acao?: ReactNode }
  onLinhaClick?: (linha: T) => void
}

export function DataTable<T>({
  columns, resposta, carregando, erro, sortBy, sortDir,
  onSort, onPage, onPerPage, toolbar, vazio, onLinhaClick,
}: DataTableProps<T>) {
  const table = useReactTable({
    data: resposta?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount: resposta?.meta.totalPages ?? -1,
  })

  const meta = resposta?.meta
  const semLinhas = !carregando && !erro && (resposta?.data.length ?? 0) === 0

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      {toolbar && <div className="border-b border-border p-3 sm:p-4">{toolbar}</div>}

      {/* A tabela larga rola DENTRO da própria caixa — o <body> nunca rola de lado. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((grupo) => (
              <tr key={grupo.id} className="border-b border-border bg-surface-2/60">
                {grupo.headers.map((header) => {
                  const ordenavel = header.column.columnDef.enableSorting !== false
                  const id = header.column.id
                  const ativa = sortBy === id
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={ativa ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                      className={cn(
                        'whitespace-nowrap px-3 py-2.5 text-left text-[12px] font-semibold uppercase tracking-wide text-text-muted first:pl-4 last:pr-4',
                        (header.column.columnDef.meta as { alinhamento?: string } | undefined)?.alinhamento === 'direita' && 'text-right',
                      )}
                    >
                      {ordenavel ? (
                        <button
                          type="button"
                          onClick={() => onSort(id)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded transition-colors hover:text-text',
                            ativa && 'text-primary',
                          )}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span aria-hidden className={cn('text-[9px]', ativa ? 'opacity-100' : 'opacity-35')}>
                            {ativa ? (sortDir === 'asc' ? '▲' : '▼') : '▼'}
                          </span>
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {carregando && (
              <tr>
                <td colSpan={columns.length}>
                  <SkeletonLinhas linhas={6} colunas={Math.min(columns.length, 6)} />
                </td>
              </tr>
            )}

            {!carregando &&
              table.getRowModel().rows.map((linha) => (
                <tr
                  key={linha.id}
                  onClick={onLinhaClick ? () => onLinhaClick(linha.original) : undefined}
                  className={cn(
                    'border-b border-border/70 transition-colors last:border-0 hover:bg-surface-2',
                    onLinhaClick && 'cursor-pointer',
                  )}
                >
                  {linha.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        'px-3 py-2.5 align-middle text-text-secondary first:pl-4 last:pr-4',
                        (cell.column.columnDef.meta as { alinhamento?: string } | undefined)?.alinhamento === 'direita' && 'text-right',
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {Boolean(erro) && (
        <EmptyState
          icone="⚠️"
          titulo="Não foi possível carregar a lista"
          descricao="A consulta falhou. Tente de novo em instantes — se persistir, avise o suporte."
        />
      )}
      {semLinhas && <EmptyState icone="🔍" titulo={vazio?.titulo ?? 'Nada encontrado'} descricao={vazio?.descricao} acao={vazio?.acao} />}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-3 sm:px-4">
        <PageSizeSelect value={meta?.perPage ?? 10} onChange={onPerPage} />
        {meta && meta.total > 0 && (
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            perPage={meta.perPage}
            onPage={onPage}
          />
        )}
      </div>
    </div>
  )
}
