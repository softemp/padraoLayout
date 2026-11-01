import { useCallback, useContext, useEffect, useMemo } from 'react'
import { Outlet, UNSAFE_NavigationContext, useLocation, useNavigate } from 'react-router-dom'

/**
 * Parâmetros de navegação INTERNA do painel (aba, recorte, ficha aberta, pré-seleção) moram no `state` do histórico,
 * nunca na barra (Base_Frontend_URL_Limpa_Estado_De_Navegacao): a URL fica limpa e o F5 na mesma aba preserva
 * (o navegador guarda o `history.state`). Query string só com necessidade real (contrato externo).
 */
type ComTela = { tela?: unknown }

/** O `state` é do app, mas qualquer script da origem mexe nele: só passam valores string. */
export function telaDoState(state: unknown): Record<string, string> {
  const tela = (state as ComTela | null)?.tela
  if (!tela || typeof tela !== 'object' || Array.isArray(tela)) return {}
  return Object.fromEntries(Object.entries(tela).filter((par): par is [string, string] => typeof par[1] === 'string'))
}

const restoDoState = (state: unknown): object => (state && typeof state === 'object' ? state : {})

/**
 * Mesma forma do `useSearchParams` (leitura por `URLSearchParams` e setter com `{ replace }`), gravando no `state`.
 * Uma query que ainda chegue na URL (link antigo) vence na leitura até o `ParametrosNoEstado` movê-la para o `state`.
 */
export function useParametrosDaTela() {
  const { pathname, search, hash, state } = useLocation()
  const navigate = useNavigate()
  const parametros = useMemo(() => {
    const p = new URLSearchParams(telaDoState(state))
    for (const [k, v] of new URLSearchParams(search)) p.set(k, v)
    return p
  }, [state, search])
  const definir = useCallback(
    (
      novos: URLSearchParams | Record<string, string> | ((atuais: URLSearchParams) => URLSearchParams),
      { replace = false }: { replace?: boolean } = {},
    ) => {
      const valor = typeof novos === 'function' ? novos(new URLSearchParams(parametros)) : novos
      const tela = Object.fromEntries(new URLSearchParams(valor))
      navigate({ pathname, hash }, { replace, state: { ...restoDoState(state), tela } })
    },
    [navigate, pathname, hash, state, parametros],
  )
  return [parametros, definir] as const
}

/**
 * `element` da rota raiz do painel: chegou com `?x=` (link antigo, favorito), move para o `state` e limpa a barra.
 * A tela já lê pelo `useParametrosDaTela`, então o primeiro render sai certo. Em `useEffect`: o `navigate` em
 * `useLayoutEffect` no 1º render não pega.
 */
export function ParametrosNoEstado() {
  const { pathname, search, hash, state } = useLocation()
  const navigate = useNavigate()
  const { navigator } = useContext(UNSAFE_NavigationContext)
  useEffect(() => {
    if (!search) return
    // Efeito de filho roda antes do do pai: se alguém (o guarda de sessão) já navegou, a location lida aqui é velha e
    // navegar com ela desfaria o redirecionamento. O histórico do roteador (Browser ou Memory) expõe a location atual.
    const atual = (navigator as { location?: { pathname: string; search: string } }).location ?? window.location
    if (atual.pathname !== pathname || atual.search !== search) return
    const tela = { ...telaDoState(state), ...Object.fromEntries(new URLSearchParams(search)) }
    navigate({ pathname, hash }, { replace: true, state: { ...restoDoState(state), tela } })
  }, [navigate, navigator, pathname, search, hash, state])
  return <Outlet />
}
