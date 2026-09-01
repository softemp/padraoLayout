import { clientes } from './mock-db'
import type {
  Chamado, Impacto, ListParams, ListResponse, MensagemChamado, Prioridade, SituacaoChamado,
  TotaisChamados, Urgencia,
} from './types'

/**
 * Chamados — dois relógios, não um: primeira resposta e resolução. E o relógio
 * PARA quando a bola está com o cliente, senão o SLA mede tempo que a equipe
 * não controla.
 */
const latencia = (ms = 360) => new Promise((r) => setTimeout(r, ms + Math.random() * 200))

function prng(seed: number) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
}
const rnd = prng(20260911)
const entre = (min: number, max: number) => Math.round(min + rnd() * (max - min))
const escolher = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]
const minutosAtras = (m: number) => new Date(Date.now() - m * 60000).toISOString()

export const ATENDENTES = ['Camila Bonfim', 'Rafael Quintana', 'Ana Beatriz', 'Diego Ferrari'] as const
const CATEGORIAS = ['Acesso e senha', 'Erro no sistema', 'Dúvida de uso', 'Integração', 'Financeiro', 'Solicitação de melhoria'] as const

/**
 * Prioridade é MATRIZ urgência × impacto, não um campo livre. Campo livre vira
 * "urgente" em tudo — e quando tudo é urgente, nada é.
 */
export const prioridadeDe = (urgencia: Urgencia, impacto: Impacto): Prioridade => {
  const u = { baixa: 1, media: 2, alta: 3 }[urgencia]
  const i = { individual: 1, equipe: 2, empresa: 3 }[impacto]
  const grau = u * i
  return grau >= 9 ? 'P1' : grau >= 6 ? 'P2' : grau >= 3 ? 'P3' : 'P4'
}

/** Minutos de SLA por prioridade: primeira resposta e resolução. */
export const SLA: Record<Prioridade, { resposta: number; resolucao: number }> = {
  P1: { resposta: 15, resolucao: 4 * 60 },
  P2: { resposta: 60, resolucao: 8 * 60 },
  P3: { resposta: 4 * 60, resolucao: 24 * 60 },
  P4: { resposta: 8 * 60, resolucao: 72 * 60 },
}

const ativos = clientes.filter((c) => c.excluidoEm === null)
let proximoId = 1

export const chamados: Chamado[] = Array.from({ length: 54 }, (_, i) => {
  const cliente = ativos[i % ativos.length]
  const urgencia = escolher(['baixa', 'media', 'alta', 'media'] as const)
  const impacto = escolher(['individual', 'equipe', 'empresa', 'equipe'] as const)
  const abertoHaMin = entre(10, 60 * 24 * 12)
  const sorteio = rnd()
  const situacao: SituacaoChamado =
    sorteio > 0.86 ? 'novo' : sorteio > 0.64 ? 'em_atendimento' : sorteio > 0.5 ? 'aguardando_cliente'
      : sorteio > 0.3 ? 'resolvido' : sorteio > 0.06 ? 'fechado' : 'cancelado'

  const respondido = situacao !== 'novo' && rnd() > 0.15
  const resolvido = ['resolvido', 'fechado'].includes(situacao)

  return {
    id: proximoId++,
    numero: `CH-${String(1000 + i)}`,
    assunto: escolher([
      'Não consigo acessar o painel', 'Relatório com valor divergente', 'Erro ao emitir nota',
      'Integração parou de sincronizar', 'Como configurar o segundo fator?', 'Boleto não chegou',
      'Sistema lento pela manhã', 'Solicito novo usuário',
    ] as const),
    descricao: 'Descrição do problema como o cliente relatou, com o contexto do que estava fazendo.',
    clienteId: cliente.id,
    cliente: cliente.nome,
    solicitante: escolher(['João Vitor', 'Marina Alves', 'Carlos Prado', 'Fernanda Lopes'] as const),
    categoria: escolher(CATEGORIAS),
    urgencia,
    impacto,
    situacao,
    responsavel: situacao === 'novo' && rnd() > 0.4 ? null : escolher(ATENDENTES),
    abertoEm: minutosAtras(abertoHaMin),
    primeiraRespostaEm: respondido ? minutosAtras(abertoHaMin - entre(5, 300)) : null,
    resolvidoEm: resolvido ? minutosAtras(entre(10, abertoHaMin / 2)) : null,
    minutosPausados: situacao === 'aguardando_cliente' ? entre(60, 2000) : entre(0, 600),
    pausadoDesde: situacao === 'aguardando_cliente' ? minutosAtras(entre(30, 900)) : null,
    reaberturas: rnd() > 0.85 ? entre(1, 3) : 0,
    canal: escolher(['e-mail', 'portal', 'WhatsApp', 'telefone'] as const),
  }
})

// ── Relógios ─────────────────────────────────────────────────────────────────

export const prioridadeChamado = (c: Chamado) => prioridadeDe(c.urgencia, c.impacto)

const minutosEntre = (de: string, ate: string | null) =>
  Math.round(((ate ? +new Date(ate) : Date.now()) - +new Date(de)) / 60000)

/**
 * Tempo ÚTIL: o cronômetro para enquanto a bola está com o cliente. Sem isso,
 * o SLA mede tempo que a equipe não controla — e o atendente é cobrado pela
 * demora de quem não respondeu.
 */
export const minutosUteis = (c: Chamado, ate: string | null = null) => {
  const bruto = minutosEntre(c.abertoEm, ate)
  const pausadoAgora = c.pausadoDesde ? minutosEntre(c.pausadoDesde, ate) : 0
  return Math.max(bruto - c.minutosPausados - pausadoAgora, 0)
}

export const minutosParaPrimeiraResposta = (c: Chamado) =>
  c.primeiraRespostaEm ? minutosEntre(c.abertoEm, c.primeiraRespostaEm) : minutosEntre(c.abertoEm, null)

export const slaRespostaEstourado = (c: Chamado) =>
  !['cancelado'].includes(c.situacao) && minutosParaPrimeiraResposta(c) > SLA[prioridadeChamado(c)].resposta

export const slaResolucaoConsumido = (c: Chamado) =>
  minutosUteis(c, c.resolvidoEm) / SLA[prioridadeChamado(c)].resolucao

export const slaResolucaoEstourado = (c: Chamado) =>
  !['cancelado'].includes(c.situacao) && slaResolucaoConsumido(c) > 1

/** Em risco: passou de 80% do prazo e ainda não resolveu. */
export const slaEmRisco = (c: Chamado) =>
  ['novo', 'em_atendimento'].includes(c.situacao) && slaResolucaoConsumido(c) > 0.8 && slaResolucaoConsumido(c) <= 1

export const emAberto = (c: Chamado) => ['novo', 'em_atendimento', 'aguardando_cliente'].includes(c.situacao)

export const formatarMinutos = (min: number) => {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h${min % 60 ? ` ${min % 60}min` : ''}`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

export async function listarChamados(params: ListParams): Promise<ListResponse<Chamado>> {
  await latencia()
  const { page, perPage, sortBy, sortDir, search, filters } = params
  let linhas = [...chamados]

  if (search?.trim()) {
    const q = search.trim().toLowerCase()
    linhas = linhas.filter((c) => c.numero.toLowerCase().includes(q) || c.assunto.toLowerCase().includes(q) || c.cliente.toLowerCase().includes(q))
  }
  if (filters?.situacao === 'estourado') linhas = linhas.filter((c) => slaResolucaoEstourado(c) && emAberto(c))
  else if (filters?.situacao === 'em_risco') linhas = linhas.filter(slaEmRisco)
  else if (filters?.situacao === 'sem_responsavel') linhas = linhas.filter((c) => emAberto(c) && !c.responsavel)
  else if (filters?.situacao) linhas = linhas.filter((c) => c.situacao === filters.situacao)
  if (filters?.prioridade) linhas = linhas.filter((c) => prioridadeChamado(c) === filters.prioridade)
  if (filters?.responsavel) linhas = linhas.filter((c) => c.responsavel === filters.responsavel)
  if (filters?.categoria) linhas = linhas.filter((c) => c.categoria === filters.categoria)

  const dir = sortDir === 'asc' ? 1 : -1
  linhas.sort((a, b) => {
    // Padrão da fila: quem está mais perto de estourar vem primeiro — não
    // ordem de chegada, que deixa o P1 novo atrás de dez P4 antigos.
    if (sortBy === 'sla') return (slaResolucaoConsumido(b) - slaResolucaoConsumido(a)) * (dir === 1 ? 1 : -1)
    if (sortBy === 'prioridade') return prioridadeChamado(a).localeCompare(prioridadeChamado(b)) * dir
    const va = a[sortBy as keyof Chamado]
    const vb = b[sortBy as keyof Chamado]
    if (va === vb) return a.id - b.id
    return String(va).localeCompare(String(vb), 'pt-BR') * dir
  })

  const total = linhas.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const pagina = Math.min(page, totalPages)
  return { data: linhas.slice((pagina - 1) * perPage, pagina * perPage), meta: { total, totalPages, page: pagina, perPage } }
}

export async function totaisChamados(): Promise<TotaisChamados> {
  await latencia(260)
  const abertos = chamados.filter(emAberto)
  const respondidos = chamados.filter((c) => c.primeiraRespostaEm)
  const fechados = chamados.filter((c) => ['resolvido', 'fechado'].includes(c.situacao))

  return {
    abertos: abertos.length,
    semResponsavel: abertos.filter((c) => !c.responsavel).length,
    slaEstourado: abertos.filter(slaResolucaoEstourado).length,
    slaEmRisco: abertos.filter(slaEmRisco).length,
    primeiraRespostaMedia: respondidos.length
      ? Math.round(respondidos.reduce((s, c) => s + minutosParaPrimeiraResposta(c), 0) / respondidos.length)
      : 0,
    taxaReabertura: fechados.length ? fechados.filter((c) => c.reaberturas > 0).length / fechados.length : 0,
  }
}

export async function obterChamado(id: number): Promise<Chamado> {
  await latencia(240)
  const c = chamados.find((x) => x.id === id)
  if (!c) throw new Error('Chamado não encontrado.')
  return { ...c }
}

// ── Conversa ─────────────────────────────────────────────────────────────────

const mensagens = new Map<number, MensagemChamado[]>()
let seqMensagem = 1

function garantirMensagens(chamadoId: number): MensagemChamado[] {
  const existente = mensagens.get(chamadoId)
  if (existente) return existente
  const chamado = chamados.find((c) => c.id === chamadoId)
  const lista: MensagemChamado[] = []
  if (chamado) {
    lista.push({
      id: seqMensagem++, chamadoId, autor: chamado.solicitante, interno: false, automatica: false,
      texto: chamado.descricao, criadoEm: chamado.abertoEm,
    })
    // A automática NÃO é primeira resposta — está aqui para deixar isso claro.
    lista.push({
      id: seqMensagem++, chamadoId, autor: 'Sistema', interno: false, automatica: true,
      texto: `Recebemos seu chamado ${chamado.numero}. Em breve um atendente responde.`,
      criadoEm: new Date(+new Date(chamado.abertoEm) + 30000).toISOString(),
    })
    if (chamado.primeiraRespostaEm) {
      lista.push({
        id: seqMensagem++, chamadoId, autor: chamado.responsavel ?? 'Suporte', interno: false, automatica: false,
        texto: 'Olá! Já estou olhando o caso. Pode confirmar em qual tela o erro aparece?',
        criadoEm: chamado.primeiraRespostaEm,
      })
    }
  }
  mensagens.set(chamadoId, lista)
  return lista
}

export async function listarMensagens(chamadoId: number): Promise<MensagemChamado[]> {
  await latencia(280)
  return garantirMensagens(chamadoId)
}

/**
 * Responder marca a primeira resposta HUMANA — e só ela. Deixar o "recebemos
 * seu chamado" parar o relógio é o truque que faz o painel de SLA ficar verde
 * enquanto o cliente segue esperando alguém de verdade.
 */
export async function responder(chamadoId: number, texto: string, interno: boolean): Promise<void> {
  await latencia(520)
  if (texto.trim().length < 2) throw new Error('Escreva a resposta.')
  const chamado = chamados.find((c) => c.id === chamadoId)
  if (!chamado) throw new Error('Chamado não encontrado.')

  garantirMensagens(chamadoId).push({
    id: seqMensagem++, chamadoId, autor: 'Paulo Roberto', interno, automatica: false,
    texto, criadoEm: new Date().toISOString(),
  })

  if (!interno) {
    if (!chamado.primeiraRespostaEm) chamado.primeiraRespostaEm = new Date().toISOString()
    if (chamado.situacao === 'novo') chamado.situacao = 'em_atendimento'
    // Responder ao cliente devolve a bola: o relógio volta a correr.
    if (chamado.pausadoDesde) {
      chamado.minutosPausados += minutosEntre(chamado.pausadoDesde, null)
      chamado.pausadoDesde = null
    }
  }
}

/** Aguardar cliente pausa o relógio — e o chamado precisa de vigilância. */
export async function aguardarCliente(chamadoId: number): Promise<void> {
  await latencia(420)
  const chamado = chamados.find((c) => c.id === chamadoId)
  if (!chamado) throw new Error('Chamado não encontrado.')
  if (!chamado.primeiraRespostaEm) throw new Error('Responda ao cliente antes de colocar o chamado em espera.')
  chamado.situacao = 'aguardando_cliente'
  chamado.pausadoDesde = new Date().toISOString()
}

export async function resolver(chamadoId: number, solucao: string): Promise<void> {
  await latencia(560)
  const chamado = chamados.find((c) => c.id === chamadoId)
  if (!chamado) throw new Error('Chamado não encontrado.')
  if (solucao.trim().length < 10) throw new Error('Descreva a solução — é o que vira base de conhecimento e evita o próximo chamado igual.')
  if (chamado.pausadoDesde) {
    chamado.minutosPausados += minutosEntre(chamado.pausadoDesde, null)
    chamado.pausadoDesde = null
  }
  garantirMensagens(chamadoId).push({
    id: seqMensagem++, chamadoId, autor: 'Paulo Roberto', interno: false, automatica: false,
    texto: `Solução: ${solucao}`, criadoEm: new Date().toISOString(),
  })
  chamado.situacao = 'resolvido'
  chamado.resolvidoEm = new Date().toISOString()
}

/**
 * Reabrir CONTA. Resolver rápido e reabrir três vezes é pior que resolver uma
 * vez devagar — e o painel que só mede tempo de resolução premia exatamente o
 * comportamento errado.
 */
export async function reabrir(chamadoId: number, motivo: string): Promise<void> {
  await latencia(480)
  const chamado = chamados.find((c) => c.id === chamadoId)
  if (!chamado) throw new Error('Chamado não encontrado.')
  if (!['resolvido', 'fechado'].includes(chamado.situacao)) throw new Error('Só chamado resolvido é reaberto.')
  chamado.situacao = 'em_atendimento'
  chamado.resolvidoEm = null
  chamado.reaberturas += 1
  garantirMensagens(chamadoId).push({
    id: seqMensagem++, chamadoId, autor: 'Paulo Roberto', interno: true, automatica: false,
    texto: `Reaberto: ${motivo}`, criadoEm: new Date().toISOString(),
  })
}

export async function atribuirChamado(chamadoId: number, pessoa: string | null): Promise<void> {
  await latencia(320)
  const chamado = chamados.find((c) => c.id === chamadoId)
  if (chamado) chamado.responsavel = pessoa
}

export const categoriasChamado = [...CATEGORIAS]
