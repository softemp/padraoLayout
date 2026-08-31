import { clientes, notificacoes } from './mock-db'
import type { Cliente, ListParams, ListResponse, Notificacao } from './types'

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

  const { page, perPage, sortBy, sortDir, search, filters } = params
  let linhas = [...clientes]

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
