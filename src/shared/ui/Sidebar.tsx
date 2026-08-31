import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { useUi } from '@/store/ui'
import { ehPai, navegacao, type NavFolha } from '@/app/navigation'

const rotaBase = (rota: string) => rota.split('?')[0]

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

export function Sidebar() {
  const { pathname } = useLocation()
  const colapsada = useUi((s) => s.sidebarCollapsed)
  const aberta = useUi((s) => s.sidebarOpen)
  const setSidebarOpen = useUi((s) => s.setSidebarOpen)
  const toggleCollapsed = useUi((s) => s.toggleCollapsed)

  // No mobile a sidebar é drawer e o colapso não vale (o mesmo DOM serve os dois).
  const recolhida = colapsada
  const [gruposAbertos, setGrupos] = useState<Record<string, boolean>>({})

  // Grupo do item ativo abre sozinho — inclusive ao chegar por link direto.
  useEffect(() => {
    const abertos: Record<string, boolean> = {}
    navegacao.forEach((secao) =>
      secao.itens.forEach((item) => {
        if (ehPai(item) && item.filhos.some((f) => rotaBase(f.rota) === pathname)) abertos[item.rotulo] = true
      }),
    )
    setGrupos((atual) => ({ ...atual, ...abertos }))
  }, [pathname])

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
        <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4">
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
                const aberto = gruposAbertos[item.rotulo] ?? false
                return (
                  <div key={item.rotulo}>
                    <button
                      type="button"
                      aria-expanded={aberto}
                      title={recolhida ? item.rotulo : undefined}
                      onClick={() => setGrupos((g) => ({ ...g, [item.rotulo]: !aberto }))}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                        recolhida && 'justify-center px-0',
                        filhoAtivo ? 'text-text' : 'text-text-secondary',
                        'hover:bg-surface-2 hover:text-text',
                      )}
                    >
                      <span aria-hidden className="w-4 shrink-0 text-center text-[13px]">{item.icone}</span>
                      {!recolhida && (
                        <>
                          <span className="truncate">{item.rotulo}</span>
                          <span aria-hidden className={cn('ml-auto text-[10px] text-text-muted transition-transform', aberto && 'rotate-90')}>
                            ▶
                          </span>
                        </>
                      )}
                    </button>
                    {/* Recolhida, o submenu não abre no rail: o clique leva à primeira folha. */}
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
            onClick={toggleCollapsed}
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
    </>
  )
}
