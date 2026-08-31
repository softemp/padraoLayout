import type { ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'

/**
 * Moldura das telas de acesso. Duas colunas no desktop, uma no mobile —
 * o painel de marca some primeiro porque não é o que a pessoa veio fazer.
 */
export function AuthLayout() {
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-bg lg:grid-cols-[1.05fr_1fr]">
      {/* Marca — decorativa, escondida quando o espaço é do formulário */}
      <aside className="relative hidden overflow-hidden bg-primary p-10 text-text-inverse lg:flex lg:flex-col">
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-black/10" />

        <div className="relative flex items-center gap-2.5">
          <span aria-hidden className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 text-sm font-bold">SE</span>
          <span className="text-[15px] font-bold tracking-tight">SoftEmp</span>
        </div>

        <div className="relative mt-auto max-w-prose space-y-4">
          <p className="text-3xl font-semibold leading-snug tracking-tight">
            O piso de qualquer tela: recuperação de senha, sessão que dura e uma listagem que aguenta a tabela real.
          </p>
          <p className="text-[15px] leading-relaxed text-white/80">
            Este projeto é o modelo de layout da casa — o que todo produto novo já nasce tendo,
            sem ninguém precisar pedir.
          </p>
        </div>

        <ul className="relative mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-white/75">
          <li>✓ Responsivo de 360 a 2560 px</li>
          <li>✓ Tema claro e escuro</li>
          <li>✓ Acessível por teclado</li>
        </ul>
      </aside>

      <main className="relative flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="absolute right-3 top-3">
          <ThemeToggle />
        </div>
        <Outlet />
      </main>
    </div>
  )
}

export function AuthCard({ titulo, descricao, children, rodape }: {
  titulo: string; descricao: string; children: ReactNode; rodape: ReactNode
}) {
  return (
    <div className="w-full max-w-[25rem]">
      <div className="mb-6 lg:hidden">
        <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-sm font-bold text-text-inverse">SE</span>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-text">{titulo}</h1>
      <p className="mt-1.5 text-sm text-text-muted">{descricao}</p>

      <div className="mt-6">{children}</div>

      <div className="mt-6 text-center text-[13px] text-text-muted">{rodape}</div>
    </div>
  )
}
