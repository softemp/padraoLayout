import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/shared/ui/AppShell'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { NotFoundPage } from '@/features/sistema/NotFoundPage'
import { Skeleton } from '@/shared/ui/Skeleton'

/**
 * Rotas pesadas entram por code-splitting: a biblioteca de gráficos (~400 KB)
 * não pode viajar no bundle de quem só abriu a tela de login.
 */
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })))
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })))
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ClientesPage = lazy(() => import('@/features/clientes/ClientesPage').then((m) => ({ default: m.ClientesPage })))
const ContaClientePage = lazy(() => import('@/features/clientes/ContaClientePage').then((m) => ({ default: m.ContaClientePage })))
const PerfilPage = lazy(() => import('@/features/perfil/PerfilPage').then((m) => ({ default: m.PerfilPage })))
const ComponentesPage = lazy(() => import('@/features/componentes/ComponentesPage').then((m) => ({ default: m.ComponentesPage })))
const EmConstrucaoPage = lazy(() => import('@/features/sistema/EmConstrucaoPage').then((m) => ({ default: m.EmConstrucaoPage })))

/** Esqueleto com a FORMA da página — não um spinner no meio do vazio. */
function CarregandoPagina() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  )
}

export function App() {
  return (
    <Suspense fallback={<CarregandoPagina />}>
      <Routes>
        {/* Telas de acesso — moldura própria, sem sidebar */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<RegisterPage />} />
          <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
        </Route>

        {/* Área logada — um AppShell só, para todos os painéis */}
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/clientes/:id" element={<ContaClientePage />} />
          <Route path="/perfil" element={<PerfilPage />} />
          <Route path="/componentes" element={<ComponentesPage />} />
          <Route path="/em-construcao" element={<EmConstrucaoPage />} />
        </Route>

        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
