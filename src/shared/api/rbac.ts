import type { AcaoPermissao, Modulo, Painel, Papel, Permissao, UsuarioSistema } from './types'

/**
 * Catálogo de acesso mocado, na modelagem do jbclient: papéis × módulos ×
 * ações, com a tabela de ligação papel↔permissão.
 *
 * Duas regras vêm do Cofre e estão embutidas aqui:
 *  · o painel VIAJA no slug da permissão (`admin.user.read`), para que a
 *    permissão de um painel nunca valha no outro — mesmo com módulos de nome
 *    igual nos dois;
 *  · `root` tem painel nulo e é IRRESTRITO: não é um papel com todas as
 *    permissões de hoje (que ficaria sem as de amanhã), é a ausência de
 *    verificação.
 */

const latencia = (ms = 340) => new Promise((r) => setTimeout(r, ms + Math.random() * 200))

export const ACOES: { id: AcaoPermissao; label: string; descricao: string }[] = [
  { id: 'read', label: 'Ver', descricao: 'Abrir a tela e consultar os registros' },
  { id: 'create', label: 'Criar', descricao: 'Cadastrar novos registros' },
  { id: 'update', label: 'Editar', descricao: 'Alterar registros existentes' },
  { id: 'delete', label: 'Excluir', descricao: 'Mover para a lixeira ou excluir' },
  { id: 'print', label: 'Imprimir', descricao: 'Enviar a listagem para a impressora' },
  { id: 'export', label: 'Exportar', descricao: 'Baixar CSV ou PDF dos dados' },
]

const rotuloAcao: Record<AcaoPermissao, string> = {
  read: 'Ver', create: 'Cadastrar', update: 'Editar', delete: 'Excluir',
  print: 'Imprimir', export: 'Exportar',
}

export const modulos: Modulo[] = [
  { id: 1, nome: 'dashboard', label: 'Dashboard', descricao: 'Painel de indicadores e gráficos', painel: 'admin' },
  { id: 2, nome: 'client', label: 'Clientes', descricao: 'Cadastro, contas e lixeira de clientes', painel: 'admin' },
  { id: 3, nome: 'finance', label: 'Financeiro', descricao: 'Faturas, recebimentos e conciliação', painel: 'admin' },
  { id: 4, nome: 'report', label: 'Relatórios', descricao: 'Relatórios operacionais e gerenciais', painel: 'admin' },
  { id: 5, nome: 'user', label: 'Usuários', descricao: 'Usuários internos do sistema', painel: 'admin' },
  { id: 6, nome: 'access', label: 'Acessos', descricao: 'Papéis, módulos e permissões', painel: 'admin' },
  { id: 7, nome: 'config', label: 'Configurações', descricao: 'Comunicação, integrações e preferências', painel: 'admin' },
  { id: 8, nome: 'audit', label: 'Auditoria', descricao: 'Histórico de quem fez o quê', painel: 'admin' },
  { id: 9, nome: 'team', label: 'Equipe', descricao: 'Gestão da equipe da carteira', painel: 'gerencia' },
  { id: 10, nome: 'goal', label: 'Metas', descricao: 'Metas por período e acompanhamento', painel: 'gerencia' },
  { id: 11, nome: 'invoice', label: 'Minhas faturas', descricao: 'Faturas do próprio cliente', painel: 'cliente' },
  { id: 12, nome: 'profile', label: 'Meus dados', descricao: 'Dados cadastrais do próprio cliente', painel: 'cliente' },
]

export const permissoes: Permissao[] = modulos.flatMap((modulo) =>
  ACOES.map((acao, i) => ({
    id: modulo.id * 10 + i,
    moduloId: modulo.id,
    acao: acao.id,
    slug: `${modulo.painel}.${modulo.nome}.${acao.id}`,
    label: `${rotuloAcao[acao.id]} ${modulo.label.toLowerCase()}`,
  })),
)

export const papeis: Papel[] = [
  { id: 1, nome: 'root', label: 'Superadministrador', descricao: 'Acesso irrestrito — não passa por verificação de permissão', painel: null, irrestrito: true, usuarios: 2, sistema: true },
  { id: 2, nome: 'admin', label: 'Administrador', descricao: 'Opera todo o painel administrativo', painel: 'admin', irrestrito: false, usuarios: 4, sistema: true },
  { id: 3, nome: 'financeiro', label: 'Financeiro', descricao: 'Faturas, recebimentos e relatórios', painel: 'admin', irrestrito: false, usuarios: 3, sistema: false },
  { id: 4, nome: 'suporte', label: 'Suporte', descricao: 'Consulta cadastros e abre chamados', painel: 'admin', irrestrito: false, usuarios: 6, sistema: false },
  { id: 5, nome: 'gerente', label: 'Gerente de carteira', descricao: 'Acompanha equipe e metas', painel: 'gerencia', irrestrito: false, usuarios: 5, sistema: false },
  { id: 6, nome: 'cliente', label: 'Cliente', descricao: 'Acessa apenas os próprios dados', painel: 'cliente', irrestrito: false, usuarios: 1284, sistema: true },
]

/** Tabela de ligação papel ↔ permissão. */
const concedidas = new Map<number, Set<number>>()

function semear() {
  if (concedidas.size) return
  const doPainel = (painel: Painel) => permissoes.filter((p) => modulos.find((m) => m.id === p.moduloId)?.painel === painel)

  const porPapel: Record<number, (p: Permissao) => boolean> = {
    1: () => false, // root não recebe permissão: ele não é verificado
    2: (p) => !p.slug.startsWith('admin.access.delete'),
    3: (p) => ['finance', 'report', 'client'].includes(nomeModulo(p)) && p.acao !== 'delete',
    4: (p) => ['client', 'dashboard', 'audit'].includes(nomeModulo(p)) && ['read', 'print', 'export'].includes(p.acao),
    5: (p) => ['team', 'goal'].includes(nomeModulo(p)),
    6: (p) => ['invoice', 'profile'].includes(nomeModulo(p)) && ['read', 'update', 'print'].includes(p.acao),
  }

  papeis.forEach((papel) => {
    const universo = papel.painel ? doPainel(papel.painel) : permissoes
    const filtro = porPapel[papel.id] ?? (() => false)
    concedidas.set(papel.id, new Set(universo.filter(filtro).map((p) => p.id)))
  })
}

const nomeModulo = (p: Permissao) => modulos.find((m) => m.id === p.moduloId)?.nome ?? ''

export const usuariosSistema: UsuarioSistema[] = [
  { id: 1, nome: 'Paulo Roberto', email: 'paulo@softemp.com.br', papeis: { admin: 'root' }, ativo: true, ultimoAcesso: new Date(Date.now() - 3600e3).toISOString() },
  { id: 2, nome: 'Camila Bonfim', email: 'camila@softemp.com.br', papeis: { admin: 'admin', gerencia: 'gerente' }, ativo: true, ultimoAcesso: new Date(Date.now() - 7200e3).toISOString() },
  { id: 3, nome: 'Rafael Quintana', email: 'rafael@softemp.com.br', papeis: { admin: 'financeiro' }, ativo: true, ultimoAcesso: new Date(Date.now() - 86400e3).toISOString() },
  { id: 4, nome: 'Ana Beatriz', email: 'ana@softemp.com.br', papeis: { admin: 'suporte' }, ativo: true, ultimoAcesso: new Date(Date.now() - 2 * 86400e3).toISOString() },
  { id: 5, nome: 'Diego Ferrari', email: 'diego@softemp.com.br', papeis: { admin: 'suporte', cliente: 'cliente' }, ativo: false, ultimoAcesso: new Date(Date.now() - 30 * 86400e3).toISOString() },
  { id: 6, nome: 'Mariana Duarte', email: 'mariana@softemp.com.br', papeis: { gerencia: 'gerente' }, ativo: true, ultimoAcesso: new Date(Date.now() - 5 * 3600e3).toISOString() },
]

// ── "API" ───────────────────────────────────────────────────────────────────

export async function listarPapeis(): Promise<Papel[]> {
  await latencia(260)
  semear()
  return papeis.map((p) => ({ ...p }))
}

export async function listarModulos(): Promise<Modulo[]> {
  await latencia(240)
  return modulos.map((m) => ({ ...m }))
}

export async function listarPermissoes(): Promise<Permissao[]> {
  await latencia(240)
  return permissoes.map((p) => ({ ...p }))
}

export async function permissoesDoPapel(papelId: number): Promise<number[]> {
  await latencia(300)
  semear()
  return [...(concedidas.get(papelId) ?? [])]
}

/**
 * Salva a matriz inteira do papel de uma vez. Salvar célula a célula deixaria
 * a tela metade aplicada quando a rede cai no meio — e ninguém saberia onde.
 */
export async function salvarPermissoesDoPapel(papelId: number, ids: number[]): Promise<void> {
  await latencia(620)
  const papel = papeis.find((p) => p.id === papelId)
  if (!papel) throw new Error('Papel não encontrado.')
  if (papel.irrestrito) throw new Error('Papel irrestrito não recebe permissões — ele não passa por verificação.')
  concedidas.set(papelId, new Set(ids))
}

export async function listarUsuariosSistema(): Promise<UsuarioSistema[]> {
  await latencia(280)
  return usuariosSistema.map((u) => ({ ...u }))
}
