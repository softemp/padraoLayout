import {
  assinaturaDoCliente, auditoriaDoCliente, clientes, extratoDoCliente, notificacoes,
  registrarMovimento, usuariosDaConta,
} from './mock-db'
import type {
  AjusteConta, Assinatura, Cliente, EventoAuditoria, ExtratoConta, ListParams, ListResponse,
  MovimentoConta, Notificacao, UsuarioDaConta,
} from './types'

/**
 * API FALSA — o projeto é só frontend. Ela existe para que a listagem seja
 * REALMENTE server-side (pagina/ordena/filtra "no banco" e devolve o envelope
 * canônico), com latência de rede simulada: assim os estados de carregando,
 * vazio e erro aparecem no layout como aparecem em produção.
 *
 * Trocar por HTTP de verdade = substituir o corpo destas funções por `fetch`.
 */
const latencia = (ms = 420) => new Promise((r) => setTimeout(r, ms + Math.random() * 240))

const texto = (v: string) =>
  v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export async function listarClientes(params: ListParams): Promise<ListResponse<Cliente>> {
  await latencia()

  const { page, perPage, sortBy, sortDir, search, filters, escopo = 'ativos' } = params

  // A lixeira é um ESCOPO da mesma consulta, não outra tela: o registro
  // continua no banco com a data de exclusão preenchida.
  let linhas = clientes.filter((c) => (escopo === 'lixeira' ? c.excluidoEm !== null : c.excluidoEm === null))

  if (search?.trim()) {
    const q = texto(search.trim())
    const digitos = q.replace(/\D/g, '')
    linhas = linhas.filter(
      (c) =>
        texto(c.nome).includes(q) ||
        texto(c.email).includes(q) ||
        (digitos.length >= 3 && c.documento.includes(digitos)),
    )
  }
  if (filters?.status) linhas = linhas.filter((c) => c.status === filters.status)
  if (filters?.plano) linhas = linhas.filter((c) => c.plano === filters.plano)

  // Ordem padrão EXPLÍCITA com desempate por id: sem isso a paginação
  // repete/perde linhas entre páginas.
  const dir = sortDir === 'asc' ? 1 : -1
  linhas.sort((a, b) => {
    const va = a[sortBy as keyof Cliente]
    const vb = b[sortBy as keyof Cliente]
    if (va === vb) return a.id - b.id
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va).localeCompare(String(vb), 'pt-BR') * dir
  })

  const total = linhas.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const pagina = Math.min(page, totalPages)
  const data = linhas.slice((pagina - 1) * perPage, (pagina - 1) * perPage + perPage)

  return { data, meta: { total, totalPages, page: pagina, perPage } }
}

/** Contagem da lixeira — alimenta o badge da aba. */
export async function contarLixeira(): Promise<number> {
  await latencia(180)
  return clientes.filter((c) => c.excluidoEm !== null).length
}

/** Exclusão LÓGICA: reversível, é o que a lixeira devolve. */
export async function moverParaLixeira(id: number): Promise<void> {
  await latencia(320)
  const cliente = clientes.find((c) => c.id === id)
  if (!cliente) throw new Error('Cliente não encontrado.')
  cliente.excluidoEm = new Date().toISOString()
}

export async function restaurarCliente(id: number): Promise<void> {
  await latencia(320)
  const cliente = clientes.find((c) => c.id === id)
  if (!cliente) throw new Error('Cliente não encontrado.')
  cliente.excluidoEm = null
}

/**
 * Exclusão FÍSICA: sem volta. Só a partir da lixeira, e só depois de
 * confirmação explícita na tela.
 */
export async function excluirDefinitivo(id: number): Promise<void> {
  await latencia(420)
  const i = clientes.findIndex((c) => c.id === id)
  if (i < 0) throw new Error('Cliente não encontrado.')
  if (clientes[i].excluidoEm === null) throw new Error('Só é possível excluir em definitivo o que está na lixeira.')
  clientes.splice(i, 1)
}

export async function salvarCliente(id: number, dados: Partial<Cliente>): Promise<Cliente> {
  await latencia(520)
  const cliente = clientes.find((c) => c.id === id)
  if (!cliente) throw new Error('Cliente não encontrado.')
  Object.assign(cliente, dados)
  return { ...cliente }
}

// ── Conta do cliente ─────────────────────────────────────────────────────────

export async function obterCliente(id: number): Promise<Cliente> {
  await latencia(280)
  const cliente = clientes.find((c) => c.id === id)
  if (!cliente) throw new Error('Cliente não encontrado.')
  return { ...cliente }
}

export async function obterExtrato(clienteId: number): Promise<ExtratoConta> {
  await latencia(360)
  return extratoDoCliente(clienteId)
}

/**
 * Crédito e débito manuais. O valor chega SEMPRE positivo da tela e o sinal é
 * decidido aqui, pelo tipo: deixar a tela mandar número negativo é como um
 * crédito vira débito sem ninguém perceber.
 */
export async function lancarAjuste(clienteId: number, ajuste: AjusteConta): Promise<MovimentoConta> {
  await latencia(520)
  if (!(ajuste.valor > 0)) throw new Error('O valor precisa ser maior que zero.')
  return registrarMovimento(clienteId, {
    tipo: ajuste.tipo,
    categoria: ajuste.categoria,
    descricao: ajuste.descricao,
    valor: ajuste.tipo === 'credito' ? ajuste.valor : -ajuste.valor,
    autor: 'Paulo Roberto',
  })
}

export async function obterUsuariosDaConta(clienteId: number): Promise<UsuarioDaConta[]> {
  await latencia(300)
  return usuariosDaConta(clienteId)
}

export async function obterAssinatura(clienteId: number): Promise<Assinatura> {
  await latencia(260)
  return assinaturaDoCliente(clienteId)
}

export async function obterAuditoria(clienteId: number): Promise<EventoAuditoria[]> {
  await latencia(320)
  return auditoriaDoCliente(clienteId)
}

export async function listarNotificacoes(): Promise<Notificacao[]> {
  await latencia(260)
  return notificacoes
}

export async function marcarTodasLidas(): Promise<Notificacao[]> {
  await latencia(200)
  notificacoes.forEach((n) => (n.lida = true))
  return [...notificacoes]
}

/** Autenticação de mentira: qualquer senha com 6+ caracteres entra. */
export async function login(email: string, senha: string) {
  await latencia(700)
  if (senha.length < 6) throw new Error('E-mail ou senha inválidos.')
  return { nome: 'Paulo Roberto', email, papel: 'Administrador' }
}
