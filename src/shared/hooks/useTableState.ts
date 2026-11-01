import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { readPrefs, writePrefs } from '@/shared/lib/ui-prefs'
import { telaDoState } from '@/shared/hooks/useParametrosDaTela'
import type { EscopoRegistro, ListParams } from '@/shared/api/types'

/**
 * Estado da listagem NO COMPONENTE (Base_Frontend_Listagens_DataTable): página, ordem, busca e filtros nunca vão
 * para a barra (Base_Frontend_URL_Limpa_Estado_De_Navegacao). Sair e voltar abre na página 1; só o tamanho de página
 * persiste, como preferência (ui-prefs).
 *
 * Atalho que abre a tela num recorte (menu "Inadimplentes", link de indicador) leva o recorte no `state.tela`:
 * `sortBy`, `sortDir`, `search` e as chaves de `filtros` viram o valor inicial. Chegar com outro recorte recomeça.
 */
export type TableState = ListParams & {
  setEscopo: (e: EscopoRegistro) => void
  setPage: (p: number) => void
  setPerPage: (p: number) => void
  setSort: (col: string) => void
  setSearch: (q: string) => void
  setFilter: (chave: string, valor?: string) => void
  limparFiltros: () => void
  temFiltro: boolean
}

type Lista = {
  page: number
  sortBy: string
  sortDir: 'asc' | 'desc'
  search: string
  filtros: Record<string, string | undefined>
  escopo: EscopoRegistro
}

export function useTableState(defaults: {
  sortBy: string
  sortDir?: 'asc' | 'desc'
  /** Chaves de filtro que ESTA tela usa. Sem declarar, o filtro do atalho não chega na consulta — foi o que
      aconteceu com o filtro de meio de pagamento das faturas. */
  filtros?: string[]
}): TableState {
  const chavesFiltro = defaults.filtros ?? ['status', 'plano']
  const { state } = useLocation()
  const tela = telaDoState(state)
  const sortDirRecorte = tela.sortDir === 'asc' || tela.sortDir === 'desc' ? tela.sortDir : undefined
  const assinaturaRecorte = JSON.stringify([tela.sortBy, sortDirRecorte, tela.search, chavesFiltro.map((c) => tela[c])])

  const inicial = (): Lista => ({
    page: 1,
    sortBy: tela.sortBy || defaults.sortBy,
    sortDir: sortDirRecorte || defaults.sortDir || 'desc',
    search: tela.search || '',
    filtros: Object.fromEntries(chavesFiltro.map((c) => [c, tela[c] || undefined])),
    escopo: 'ativos',
  })
  const [lista, setLista] = useState(inicial)
  const [perPage, setPerPageEstado] = useState(() => readPrefs().tablePageSize)
  // Mesma rota, outro atalho (Todos → Inadimplentes): o componente não remonta, então o recorte novo recomeça a lista
  // aqui, no render (padrão "ajustar estado quando a entrada muda" do React).
  const [recorteAplicado, setRecorteAplicado] = useState(assinaturaRecorte)
  if (recorteAplicado !== assinaturaRecorte) {
    setRecorteAplicado(assinaturaRecorte)
    setLista(inicial())
  }

  const { page, sortBy, sortDir, search, filtros, escopo } = lista
  const assinaturaFiltros = JSON.stringify(filtros)

  return useMemo(
    () => ({
      page,
      perPage,
      sortBy,
      sortDir,
      search,
      escopo,
      filters: filtros,
      temFiltro: Boolean(search || Object.values(filtros).some(Boolean)),
      setEscopo: (e) => setLista((l) => ({ ...l, escopo: e, page: 1 })),
      setPage: (p) => setLista((l) => ({ ...l, page: p })),
      setPerPage: (p) => {
        writePrefs({ tablePageSize: p })
        setPerPageEstado(p)
        setLista((l) => ({ ...l, page: 1 }))
      },
      // Clicar na coluna ordenada inverte a direção; em outra coluna, recomeça em asc.
      setSort: (col) =>
        setLista((l) => ({ ...l, sortBy: col, sortDir: col === l.sortBy && l.sortDir === 'asc' ? 'desc' : 'asc', page: 1 })),
      // Idempotentes: o efeito do debounce chama de novo a cada render e não pode voltar a página para 1.
      setSearch: (q) => setLista((l) => (l.search === q ? l : { ...l, search: q, page: 1 })),
      setFilter: (chave, valor) =>
        setLista((l) => (l.filtros[chave] === valor ? l : { ...l, filtros: { ...l.filtros, [chave]: valor }, page: 1 })),
      limparFiltros: () =>
        setLista((l) => ({ ...l, search: '', filtros: Object.fromEntries(chavesFiltro.map((c) => [c, undefined])), page: 1 })),
    }),
    // assinaturaFiltros no lugar do objeto: o memo (e a queryKey) só muda quando um filtro muda de fato.
    [page, perPage, sortBy, sortDir, search, escopo, assinaturaFiltros], // eslint-disable-line react-hooks/exhaustive-deps
  )
}
