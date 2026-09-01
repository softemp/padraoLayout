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
const VerificacaoPage = lazy(() => import('@/features/auth/VerificacaoPage').then((m) => ({ default: m.VerificacaoPage })))
const ComunicacaoPage = lazy(() => import('@/features/configuracoes/ComunicacaoPage').then((m) => ({ default: m.ComunicacaoPage })))
const AcessosPage = lazy(() => import('@/features/acessos/AcessosPage').then((m) => ({ default: m.AcessosPage })))
const FaturasPage = lazy(() => import('@/features/financeiro/FaturasPage').then((m) => ({ default: m.FaturasPage })))
const RecebimentosPage = lazy(() => import('@/features/financeiro/RecebimentosPage').then((m) => ({ default: m.RecebimentosPage })))
const ConciliacaoPage = lazy(() => import('@/features/financeiro/ConciliacaoPage').then((m) => ({ default: m.ConciliacaoPage })))
const ContasPage = lazy(() => import('@/features/financeiro/contas/ContasPage').then((m) => ({ default: m.ContasPage })))
const RelatoriosFinanceirosPage = lazy(() => import('@/features/relatorios/RelatoriosFinanceirosPage').then((m) => ({ default: m.RelatoriosFinanceirosPage })))
const RelatoriosPage = lazy(() => import('@/features/relatorios/RelatoriosPage').then((m) => ({ default: m.RelatoriosPage })))
const AuditoriaPage = lazy(() => import('@/features/auditoria/AuditoriaPage').then((m) => ({ default: m.AuditoriaPage })))
const EmpresaPage = lazy(() => import('@/features/configuracoes/EmpresaPage').then((m) => ({ default: m.EmpresaPage })))
const IntegracoesPage = lazy(() => import('@/features/configuracoes/IntegracoesPage').then((m) => ({ default: m.IntegracoesPage })))
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const MetasPage = lazy(() => import('@/features/metas/MetasPage').then((m) => ({ default: m.MetasPage })))
const IndicadorPage = lazy(() => import('@/features/metas/IndicadorPage').then((m) => ({ default: m.IndicadorPage })))
const ChamadosPage = lazy(() => import('@/features/chamados/ChamadosPage').then((m) => ({ default: m.ChamadosPage })))
const ChamadoPage = lazy(() => import('@/features/chamados/ChamadoPage').then((m) => ({ default: m.ChamadoPage })))
const ProjetosPage = lazy(() => import('@/features/projetos/ProjetosPage').then((m) => ({ default: m.ProjetosPage })))
const ProjetoPage = lazy(() => import('@/features/projetos/ProjetoPage').then((m) => ({ default: m.ProjetoPage })))
const RhPage = lazy(() => import('@/features/rh/RhPage').then((m) => ({ default: m.RhPage })))
const ColaboradorPage = lazy(() => import('@/features/rh/ColaboradorPage').then((m) => ({ default: m.ColaboradorPage })))
const ChatPage = lazy(() => import('@/features/chat/ChatPage').then((m) => ({ default: m.ChatPage })))
const ComissoesPage = lazy(() => import('@/features/comissoes/ComissoesPage').then((m) => ({ default: m.ComissoesPage })))
const VendasPage = lazy(() => import('@/features/vendas/VendasPage').then((m) => ({ default: m.VendasPage })))
const VendaPage = lazy(() => import('@/features/vendas/VendaPage').then((m) => ({ default: m.VendaPage })))
const ComprasPage = lazy(() => import('@/features/compras/ComprasPage').then((m) => ({ default: m.ComprasPage })))
const PedidoCompraPage = lazy(() => import('@/features/compras/PedidoCompraPage').then((m) => ({ default: m.PedidoCompraPage })))
const EstoquePage = lazy(() => import('@/features/estoque/EstoquePage').then((m) => ({ default: m.EstoquePage })))
const ItemEstoquePage = lazy(() => import('@/features/estoque/ItemEstoquePage').then((m) => ({ default: m.ItemEstoquePage })))
const TarefasPage = lazy(() => import('@/features/tarefas/TarefasPage').then((m) => ({ default: m.TarefasPage })))
const DocumentosPage = lazy(() => import('@/features/documentos/DocumentosPage').then((m) => ({ default: m.DocumentosPage })))
const DocumentoPage = lazy(() => import('@/features/documentos/DocumentoPage').then((m) => ({ default: m.DocumentoPage })))
const ContratosFornecedorPage = lazy(() => import('@/features/contratos-fornecedores/ContratosFornecedorPage').then((m) => ({ default: m.ContratosFornecedorPage })))
const ContratoFornecedorPage = lazy(() => import('@/features/contratos-fornecedores/ContratoFornecedorPage').then((m) => ({ default: m.ContratoFornecedorPage })))
const ContratosPage = lazy(() => import('@/features/contratos/ContratosPage').then((m) => ({ default: m.ContratosPage })))
const ContratoPage = lazy(() => import('@/features/contratos/ContratoPage').then((m) => ({ default: m.ContratoPage })))
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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-4 lg:gap-6">
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
          <Route path="/verificacao" element={<VerificacaoPage />} />
        </Route>

        {/* Área logada — um AppShell só, para todos os painéis */}
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/clientes/:id" element={<ContaClientePage />} />
          <Route path="/contratos" element={<ContratosPage />} />
          <Route path="/contratos-fornecedores" element={<ContratosFornecedorPage />} />
          <Route path="/contratos-fornecedores/:id" element={<ContratoFornecedorPage />} />
          <Route path="/contratos/:id" element={<ContratoPage />} />
          <Route path="/tarefas" element={<TarefasPage />} />
          <Route path="/metas" element={<MetasPage />} />
          <Route path="/metas/:id" element={<IndicadorPage />} />
          <Route path="/chamados" element={<ChamadosPage />} />
          <Route path="/chamados/:id" element={<ChamadoPage />} />
          <Route path="/projetos" element={<ProjetosPage />} />
          <Route path="/projetos/:id" element={<ProjetoPage />} />
          <Route path="/rh" element={<RhPage />} />
          <Route path="/rh/:id" element={<ColaboradorPage />} />
          <Route path="/vendas" element={<VendasPage />} />
          <Route path="/comissoes" element={<ComissoesPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/vendas/:id" element={<VendaPage />} />
          <Route path="/compras" element={<ComprasPage />} />
          <Route path="/compras/:id" element={<PedidoCompraPage />} />
          <Route path="/estoque" element={<EstoquePage />} />
          <Route path="/estoque/:id" element={<ItemEstoquePage />} />
          <Route path="/documentos" element={<DocumentosPage />} />
          <Route path="/documentos/:id" element={<DocumentoPage />} />
          <Route path="/perfil" element={<PerfilPage />} />
          <Route path="/componentes" element={<ComponentesPage />} />
          <Route path="/configuracoes/comunicacao" element={<ComunicacaoPage />} />
          <Route path="/configuracoes/acessos" element={<AcessosPage />} />
          <Route path="/configuracoes/empresa" element={<EmpresaPage />} />
          <Route path="/configuracoes/integracoes" element={<IntegracoesPage />} />
          <Route path="/financeiro/contas" element={<ContasPage />} />
          <Route path="/financeiro/faturas" element={<FaturasPage />} />
          <Route path="/financeiro/recebimentos" element={<RecebimentosPage />} />
          <Route path="/financeiro/conciliacao" element={<ConciliacaoPage />} />
          <Route path="/relatorios" element={<RelatoriosPage />} />
          <Route path="/relatorios/financeiros" element={<RelatoriosFinanceirosPage />} />
          <Route path="/auditoria" element={<AuditoriaPage />} />
          <Route path="/em-construcao" element={<EmConstrucaoPage />} />
        </Route>

        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
