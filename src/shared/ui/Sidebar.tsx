import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { useUi } from '@/store/ui'
import { useEhDesktop } from '@/shared/hooks/useMediaQuery'
import { ehPai, navegacao, type NavFolha, type NavPai } from '@/app/navigation'

const rotaBase = (rota: string) => rota.split('?')[0]
const LARGURA_FAIXA = 72 // px — a faixa de ícones (md:w-[4.5rem])

function Folha({ item, recolhida, aninhado, onNavegar }: {
  item: NavFolha; recolhida: boolean; aninhado?: boolean; onNavegar: () => void
}) {
  const { pathname, search } = useLocation()
  // Item com query (?status=inadimplente) só fica ativo se a query bater.
  const [base, query] = item.rota.split('?')
  const ativo = pathname === base && (!query || search.includes(query))

  return (
    <NavLink
      to={item.rota}
      onClick={onNavegar}
      title={recolhida ? item.rotulo : undefined}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors',
        recolhida && 'justify-center px-0',
        aninhado && !recolhida && 'ml-[1.15rem] border-l border-border pl-3.5',
        ativo
          ? 'bg-primary/10 font-semibold text-primary'
          : 'font-medium text-text-secondary hover:bg-surface-2 hover:text-text',
      )}
    >
      <span aria-hidden className="w-4 shrink-0 text-center text-[13px]">{item.icone}</span>
      {!recolhida && <span className="truncate">{item.rotulo}</span>}
      {!recolhida && item.badge && (
        <span className="ml-auto rounded-full bg-critical/12 px-1.5 py-0.5 text-[11px] font-semibold text-critical">
          {item.badge}
        </span>
      )}
    </NavLink>
  )
}

/**
 * Submenu da faixa recolhida: painel flutuante ancorado no ícone.
 * Vive num portal porque a `<aside>` tem `transform` (o que tornaria um
 * `position: fixed` relativo a ela) e `overflow-y-auto` (que o cortaria).
 */
function Flyout({ item, topo, onFechar }: { item: NavPai; topo: number; onFechar: () => void }) {
  const painel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const clique = (e: MouseEvent) => {
      const alvo = e.target as HTMLElement
      // O próprio gatilho é ignorado aqui: quem alterna é o onClick dele.
      if (alvo.closest('[data-flyout]') || alvo.closest('[data-flyout-gatilho]')) return
      onFechar()
    }
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    document.addEventListener('mousedown', clique)
    document.addEventListener('keydown', tecla)
    window.addEventListener('resize', onFechar)
    window.addEventListener('scroll', onFechar, true)
    return () => {
      document.removeEventListener('mousedown', clique)
      document.removeEventListener('keydown', tecla)
      window.removeEventListener('resize', onFechar)
      window.removeEventListener('scroll', onFechar, true)
    }
  }, [onFechar])

  useEffect(() => {
    painel.current?.querySelector<HTMLElement>('a')?.focus()
  }, [])

  // Não deixa o painel passar do rodapé da janela.
  const altura = 52 + item.filhos.length * 38
  const top = Math.max(8, Math.min(topo, window.innerHeight - altura - 12))

  return createPortal(
    <div
      ref={painel}
      data-flyout
      role="menu"
      aria-label={item.rotulo}
      style={{ top, left: LARGURA_FAIXA + 8 }}
      className="fixed z-50 w-60 overflow-hidden rounded-xl border border-border bg-surface shadow-pop animate-slide-down"
    >
      <p className="border-b border-border px-3.5 py-2.5 text-[13px] font-semibold text-text">{item.rotulo}</p>
      <div className="p-1.5">
        {item.filhos.map((filho) => (
          <NavLink
            key={filho.rotulo}
            to={filho.rota}
            role="menuitem"
            onClick={onFechar}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors',
                isActive
                  ? 'bg-primary/10 font-semibold text-primary'
                  : 'font-medium text-text-secondary hover:bg-surface-2 hover:text-text',
              )
            }
          >
            <span aria-hidden className="w-4 shrink-0 text-center text-[13px]">{filho.icone}</span>
            <span className="truncate">{filho.rotulo}</span>
            {filho.badge && (
              <span className="ml-auto rounded-full bg-critical/12 px-1.5 py-0.5 text-[11px] font-semibold text-critical">
                {filho.badge}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </div>,
    document.body,
  )
}

export function Sidebar() {
  const { pathname } = useLocation()
  const colapsada = useUi((s) => s.sidebarCollapsed)
  const aberta = useUi((s) => s.sidebarOpen)
  const setSidebarOpen = useUi((s) => s.setSidebarOpen)
  const toggleCollapsed = useUi((s) => s.toggleCollapsed)

  // O colapso é estado de DESKTOP: no celular o mesmo DOM vira drawer e mostra
  // rótulos e submenus sempre. Vazar o estado recolhido para o mobile é o que
  // deixava o menu quebrado ao estreitar a tela.
  const ehDesktop = useEhDesktop()
  const recolhida = colapsada && ehDesktop

  // UM grupo aberto por vez (acordeão): abrir um fecha o anterior, senão o
  // menu vira uma lista longa onde nada fica em evidência.
  const [grupoAberto, setGrupoAberto] = useState<string | null>(null)
  // Faixa recolhida: o submenu vira painel flutuante ancorado no ícone.
  const [flyout, setFlyout] = useState<{ item: NavPai; topo: number } | null>(null)

  const fecharFlyout = useCallback(() => setFlyout(null), [])

  // Grupo do item ativo abre sozinho — inclusive ao chegar por link direto.
  useEffect(() => {
    for (const secao of navegacao) {
      for (const item of secao.itens) {
        if (ehPai(item) && item.filhos.some((f) => rotaBase(f.rota) === pathname)) {
          setGrupoAberto(item.rotulo)
          return
        }
      }
    }
  }, [pathname])

  // Expandir a faixa (ou virar mobile) descarta o painel flutuante.
  useEffect(() => {
    if (!recolhida) setFlyout(null)
  }, [recolhida])

  const fecharNoMobile = () => setSidebarOpen(false)

  return (
    <>
      {/* Overlay do drawer (só mobile) */}
      <div
        onClick={fecharNoMobile}
        aria-hidden
        className={cn(
          'fixed inset-0 z-30 bg-overlay/50 transition-opacity md:hidden',
          aberta ? 'visible opacity-100' : 'invisible opacity-0',
        )}
      />

      <aside
        aria-label="Navegação principal"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-surface',
          'transition-[transform,width] duration-200 ease-out',
          recolhida ? 'md:w-[4.5rem]' : 'md:w-60',
          'w-[17rem]',
          // Fechada no mobile: invisible + translate (translate sozinho deixa
          // o conteúdo focável pelo teclado fora da tela).
          aberta ? 'visible translate-x-0' : 'invisible -translate-x-full',
          'md:visible md:translate-x-0',
        )}
      >
        {/* Marca */}
        <div className={cn('flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4', recolhida && 'md:justify-center md:px-0')}>
          <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-text-inverse">
            SE
          </span>
          {!recolhida && (
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold leading-4 tracking-tight text-text">SoftEmp</span>
              <span className="block truncate text-[11px] leading-4 text-text-muted">Padrão de layout</span>
            </span>
          )}
          <button
            type="button"
            onClick={fecharNoMobile}
            aria-label="Fechar menu"
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 md:hidden"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        {/* Navegação */}
        <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 py-4">
          {navegacao.map((secao) => (
            <div key={secao.titulo} className="space-y-1">
              {!recolhida && (
                <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {secao.titulo}
                </p>
              )}
              {secao.itens.map((item) => {
                if (!ehPai(item)) {
                  return <Folha key={item.rotulo} item={item} recolhida={recolhida} onNavegar={fecharNoMobile} />
                }

                const filhoAtivo = item.filhos.some((f) => rotaBase(f.rota) === pathname)
                const aberto = recolhida ? flyout?.item.rotulo === item.rotulo : grupoAberto === item.rotulo

                return (
                  <div key={item.rotulo}>
                    <button
                      type="button"
                      data-flyout-gatilho={recolhida ? '' : undefined}
                      aria-expanded={aberto}
                      aria-haspopup={recolhida ? 'menu' : undefined}
                      title={recolhida ? item.rotulo : undefined}
                      onClick={(e) => {
                        if (recolhida) {
                          // Painel flutuante ancorado na altura do ícone.
                          const alvo = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          setFlyout((atual) => (atual?.item.rotulo === item.rotulo ? null : { item, topo: alvo.top }))
                          return
                        }
                        setGrupoAberto(aberto ? null : item.rotulo)
                      }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                        recolhida && 'relative justify-center px-0',
                        filhoAtivo || aberto ? 'text-text' : 'text-text-secondary',
                        recolhida && filhoAtivo && 'bg-primary/10 text-primary',
                        'hover:bg-surface-2 hover:text-text',
                      )}
                    >
                      <span aria-hidden className="w-4 shrink-0 text-center text-[13px]">{item.icone}</span>
                      {!recolhida ? (
                        <>
                          <span className="truncate">{item.rotulo}</span>
                          <span aria-hidden className={cn('ml-auto text-[10px] text-text-muted transition-transform', aberto && 'rotate-90')}>
                            ▶
                          </span>
                        </>
                      ) : (
                        // Marca de "tem submenu" na faixa: um chanfro discreto.
                        <span aria-hidden className="absolute bottom-1 right-1 text-[7px] leading-none text-text-muted">◣</span>
                      )}
                    </button>

                    {aberto && !recolhida && (
                      <div className="mt-0.5 space-y-0.5">
                        {item.filhos.map((filho) => (
                          <Folha key={filho.rotulo} item={filho} recolhida={false} aninhado onNavegar={fecharNoMobile} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Rodapé: recolher (só desktop) */}
        <div className="hidden shrink-0 border-t border-border p-2.5 md:block">
          <button
            type="button"
            onClick={() => { setFlyout(null); toggleCollapsed() }}
            aria-label={recolhida ? 'Expandir menu' : 'Recolher menu'}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium',
              'text-text-secondary transition-colors hover:bg-surface-2 hover:text-text',
              recolhida && 'justify-center px-0',
            )}
          >
            <span aria-hidden className="w-4 text-center">{recolhida ? '»' : '«'}</span>
            {!recolhida && <span>Recolher menu</span>}
          </button>
        </div>
      </aside>

      {recolhida && flyout && <Flyout item={flyout.item} topo={flyout.topo} onFechar={fecharFlyout} />}
    </>
  )
}
