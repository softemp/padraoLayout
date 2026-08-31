import { Outlet } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { useUi } from '@/store/ui'
import { Navbar } from './Navbar'
import { Sidebar } from './Sidebar'

/**
 * Moldura ÚNICA da área logada. Layouts de painel (admin, gerência, cliente)
 * são cascas finas em volta dela — nunca uma cópia deste arquivo.
 *
 * <main>: LARGURA TOTAL (sem max-w) na régua canônica px-2 sm:px-4 lg:px-6.
 * Em tela de operação, margem vazia é linha de tabela que não coube.
 */
export function AppShell() {
  const colapsada = useUi((s) => s.sidebarCollapsed)

  return (
    <div className="min-h-dvh bg-bg">
      <Sidebar />
      <div className={cn('flex min-h-dvh flex-col transition-[padding] duration-200', colapsada ? 'md:pl-[4.5rem]' : 'md:pl-60')}>
        <Navbar />
        <main className="w-full flex-1 px-2 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
          <Outlet />
        </main>
        <footer className="px-2 pb-5 pt-1 text-[12px] text-text-muted sm:px-4 lg:px-6">
          Padrão de layout SoftEmp · dados mocados para avaliação visual
        </footer>
      </div>
    </div>
  )
}
