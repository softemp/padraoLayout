import type {
  AcessoRegistrado, PerfilUsuario, PreferenciaNotificacao, SessaoAtiva,
} from './types'

/** Perfil do usuário — dados fictícios. */
const latencia = (ms = 340) => new Promise((r) => setTimeout(r, ms + Math.random() * 200))
const diasAtras = (d: number) => new Date(Date.now() - d * 86400000).toISOString()

const perfil: PerfilUsuario = {
  nome: 'Paulo Roberto da Silva',
  email: 'paulo@softemp.com.br',
  emailVerificado: true,
  telefone: '48999990000',
  telefoneVerificado: false,
  cargo: 'Administrador',
  bio: 'Cuido da plataforma e das integrações financeiras.',
  fuso: 'America/Sao_Paulo',
  idioma: 'pt-BR',
  formatoData: 'dd/MM/yyyy',
  paginaInicial: '/',
  avatarUrl: null,
  segundoFatorAtivo: true,
  codigosRecuperacaoRestantes: 8,
  senhaAlteradaEm: diasAtras(96),
}

const notificacoes: PreferenciaNotificacao[] = [
  { evento: 'seguranca', rotulo: 'Alertas de segurança', descricao: 'Login de dispositivo novo, troca de senha, 2FA', canais: { email: true, whatsapp: true, push: true }, obrigatorio: true },
  { evento: 'inadimplencia', rotulo: 'Inadimplência', descricao: 'Cliente entrou em atraso ou foi suspenso', canais: { email: true, whatsapp: true, push: false } },
  { evento: 'vencimentos', rotulo: 'Contas a vencer', descricao: 'Resumo diário do que vence nos próximos 3 dias', canais: { email: true, whatsapp: false, push: true } },
  { evento: 'recebimentos', rotulo: 'Recebimentos confirmados', descricao: 'Cada pagamento confirmado pelo gateway', canais: { email: false, whatsapp: false, push: true } },
  { evento: 'relatorio', rotulo: 'Resumo semanal', descricao: 'Desempenho da semana toda segunda-feira', canais: { email: true, whatsapp: false, push: false } },
  { evento: 'integracao', rotulo: 'Falha em integração', descricao: 'Webhook ou API externa fora do ar', canais: { email: true, whatsapp: false, push: true } },
]

const sessoes: SessaoAtiva[] = [
  { id: 1, dispositivo: 'Notebook do escritório', navegador: 'Chrome 141', sistema: 'Ubuntu 24.04', ip: '189.45.12.90', local: 'Florianópolis, SC', ultimaAtividade: new Date().toISOString(), atual: true },
  { id: 2, dispositivo: 'iPhone 15', navegador: 'Safari 18', sistema: 'iOS 19.2', ip: '177.92.4.11', local: 'Florianópolis, SC', ultimaAtividade: diasAtras(0.3), atual: false },
  { id: 3, dispositivo: 'Desktop de casa', navegador: 'Firefox 139', sistema: 'Windows 11', ip: '189.45.99.4', local: 'São José, SC', ultimaAtividade: diasAtras(4), atual: false },
  { id: 4, dispositivo: 'Navegador desconhecido', navegador: 'Chrome 138', sistema: 'Android 15', ip: '201.17.88.203', local: 'Curitiba, PR', ultimaAtividade: diasAtras(12), atual: false },
]

const acessos: AcessoRegistrado[] = [
  { id: 1, data: diasAtras(0.01), ip: '189.45.12.90', local: 'Florianópolis, SC', dispositivo: 'Chrome · Ubuntu', resultado: 'sucesso' },
  { id: 2, data: diasAtras(0.9), ip: '177.92.4.11', local: 'Florianópolis, SC', dispositivo: 'Safari · iOS', resultado: 'sucesso' },
  { id: 3, data: diasAtras(1.2), ip: '201.17.88.203', local: 'Curitiba, PR', dispositivo: 'Chrome · Android', resultado: 'segundo_fator_falhou' },
  { id: 4, data: diasAtras(1.2), ip: '201.17.88.203', local: 'Curitiba, PR', dispositivo: 'Chrome · Android', resultado: 'senha_incorreta' },
  { id: 5, data: diasAtras(3), ip: '189.45.99.4', local: 'São José, SC', dispositivo: 'Firefox · Windows', resultado: 'sucesso' },
  { id: 6, data: diasAtras(7), ip: '45.231.7.10', local: 'Fortaleza, CE', dispositivo: 'Chrome · Windows', resultado: 'bloqueado' },
]

export async function obterPerfil(): Promise<PerfilUsuario> {
  await latencia(280)
  return { ...perfil }
}

export async function salvarPerfil(dados: Partial<PerfilUsuario>): Promise<PerfilUsuario> {
  await latencia(680)
  Object.assign(perfil, dados)
  return { ...perfil }
}

/**
 * Troca de senha exige a senha ATUAL — mesmo com sessão válida. É o que
 * impede que um navegador esquecido aberto vire troca de dono da conta.
 */
export async function alterarSenha(atual: string, nova: string): Promise<void> {
  await latencia(760)
  if (atual.length < 6) throw new Error('Senha atual incorreta.')
  if (nova.length < 8) throw new Error('A nova senha precisa de ao menos 8 caracteres.')
  if (atual === nova) throw new Error('A nova senha precisa ser diferente da atual.')
  perfil.senhaAlteradaEm = new Date().toISOString()
}

export async function listarNotificacoesPerfil(): Promise<PreferenciaNotificacao[]> {
  await latencia(260)
  return notificacoes.map((n) => ({ ...n, canais: { ...n.canais } }))
}

export async function salvarNotificacoes(novas: PreferenciaNotificacao[]): Promise<void> {
  await latencia(520)
  novas.forEach((nova) => {
    const alvo = notificacoes.find((n) => n.evento === nova.evento)
    if (alvo) alvo.canais = { ...nova.canais }
  })
}

export async function listarSessoes(): Promise<SessaoAtiva[]> {
  await latencia(300)
  return sessoes.map((s) => ({ ...s }))
}

export async function encerrarSessao(id: number): Promise<void> {
  await latencia(420)
  const i = sessoes.findIndex((s) => s.id === id)
  if (i < 0) throw new Error('Sessão não encontrada.')
  if (sessoes[i].atual) throw new Error('Esta é a sessão atual — use "Sair" no menu do usuário.')
  sessoes.splice(i, 1)
}

/** Encerra todas menos a atual: derrubar a própria sessão confunde mais do que protege. */
export async function encerrarOutrasSessoes(): Promise<void> {
  await latencia(620)
  const atual = sessoes.filter((s) => s.atual)
  sessoes.length = 0
  sessoes.push(...atual)
}

export async function listarAcessos(): Promise<AcessoRegistrado[]> {
  await latencia(320)
  return acessos.map((a) => ({ ...a }))
}

/** Gerar novos códigos INVALIDA os antigos — a tela precisa dizer isso antes. */
export async function gerarCodigosRecuperacao(): Promise<string[]> {
  await latencia(700)
  const codigo = () => Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase()
  perfil.codigosRecuperacaoRestantes = 10
  return Array.from({ length: 10 }, codigo)
}

export async function alternarSegundoFator(ativar: boolean): Promise<void> {
  await latencia(600)
  perfil.segundoFatorAtivo = ativar
}
