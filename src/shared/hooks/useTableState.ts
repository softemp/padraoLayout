import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { readPrefs, writePrefs } from '@/shared/lib/ui-prefs'
import type { ListParams } from '@/shared/api/types'

/**
 * Estado da listagem na URL (?page=&perPage=&sortBy=&sortDir=&search=&status=).
 * Motivo: link compartilhável, F5 sem perder o lugar e o "voltar" do navegador
 * devolvendo a MESMA página — o que `useState` não faz.
 */
export type TableState = ListParams & {
  setPage: (p: number) => void
  setPerPage: (p: number) => void
  setSort: (col: string) => void
  setSearch: (q: string) => void
  setFilter: (chave: string, valor?: string) => void
  limparFiltros: () => void
  temFiltro: boolean
}

export function useTableState(defaults: { sortBy: string; sortDir?: 'asc' | 'desc' }): TableState {
  const [params, setParams] = useSearchParams()

  const page = Number(params.get('page') || 1)
  const perPage = Number(params.get('perPage') || readPrefs().tablePageSize)
  const sortBy = params.get('sortBy') || defaults.sortBy
  const sortDir = (params.get('sortDir') as 'asc' | 'desc') || defaults.sortDir || 'desc'
  const search = params.get('search') || ''
  const status = params.get('status') || undefined
  const plano = params.get('plano') || undefined

  const patch = useCallback(
    (novo: Record<string, string | undefined>, resetPage = true) => {
      setParams(
        (atual) => {
          const p = new URLSearchParams(atual)
          Object.entries(novo).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)))
          if (resetPage && !('page' in novo)) p.delete('page')
          return p
        },
        { replace: true },
      )
    },
    [setParams],
  )

  return useMemo(
    () => ({
      page,
      perPage,
      sortBy,
      sortDir,
      search,
      filters: { status, plano },
      temFiltro: Boolean(search || status || plano),
      setPage: (p) => patch({ page: p > 1 ? String(p) : undefined }, false),
      setPerPage: (p) => {
        writePrefs({ tablePageSize: p })
        patch({ perPage: String(p) })
      },
      // Clicar na coluna ordenada inverte a direção; em outra coluna, recomeça.
      setSort: (col) =>
        patch({
          sortBy: col,
          sortDir: col === sortBy && sortDir === 'asc' ? 'desc' : col === sortBy ? 'asc' : 'asc',
        }),
      setSearch: (q) => patch({ search: q || undefined }),
      setFilter: (chave, valor) => patch({ [chave]: valor }),
      limparFiltros: () => patch({ search: undefined, status: undefined, plano: undefined }),
    }),
    [page, perPage, sortBy, sortDir, search, status, plano, patch],
  )
}
