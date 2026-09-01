import { clientes } from './mock-db'
import { USUARIO_ATUAL } from './tarefas'
import type {
  Atendente, CanalChat, Conversa, MensagemChat, Prioridade, RelogiosConversa, SituacaoConversa,
  StatusAtendente, TotaisChat, TransferenciaChat,
} from './types'

/**
 * Chat de atendimento — o módulo tem UMA regra que decide todo o resto:
 *
 *   o relógio é do CLIENTE, não do atendente.
 *
 * Transferir NÃO zera o SLA. Se zerasse, transferir viraria a forma barata de
 * nunca estourar meta: passa adiante aos 14 minutos e o painel fica verde
 * enquanto o cliente está esperando há uma hora.
 */
const latencia = (ms = 260) => new Promise((r) => setTimeout(r, ms + Math.random() * 180))

function prng(seed: number) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
}
const rnd = prng(20260901)
const entre = (min: number, max: number) => Math.round(min + rnd() * (max - min))
const escolher = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]
const minutosAtras = (m: number) => new Date(Date.now() - m * 60000).toISOString()
const minutosEntre = (de: string, ate: string | number = Date.now()) =>
  Math.max(0, Math.round((+new Date(ate) - +new Date(de)) / 60000))

/** Os atendentes são PRÉ-DEFINIDOS: transferência escolhe daqui, não digita nome. */
export const atendentes: Atendente[] = [
  { nome: USUARIO_ATUAL, status: 'disponivel', capacidade: 5, emAtendimento: 0, equipe: 'Suporte N1' },
  { nome: 'Camila Bonfim', status: 'disponivel', capacidade: 5, emAtendimento: 0, equipe: 'Suporte N1' },
  { nome: 'Rafael Quintana', status: 'disponivel', capacidade: 4, emAtendimento: 0, equipe: 'Suporte N2' },
  { nome: 'Ana Beatriz', status: 'ocupado', capacidade: 3, emAtendimento: 0, equipe: 'Financeiro' },
  { nome: 'Diego Ferrari', status: 'ausente', capacidade: 4, emAtendimento: 0, equipe: 'Suporte N2' },
  { nome: 'Marina Alves', status: 'offline', capacidade: 4, emAtendimento: 0, equipe: 'Comercial' },
]

/** Meta por prioridade: minutos de espera na fila e de primeira resposta. */
export const METAS: Record<Prioridade, { fila: number; resposta: number }> = {
  P1: { fila: 1, resposta: 3 },
  P2: { fila: 3, resposta: 8 },
  P3: { fila: 8, resposta: 15 },
  P4: { fila: 15, resposta: 30 },
}

const CANAIS: CanalChat[] = ['whatsapp', 'site', 'email', 'telefone']
const ASSUNTOS = [
  'Não consigo emitir a segunda via', 'Cobrança em duplicidade na fatura', 'Erro ao subir documento',
  'Como faço para trocar o plano?', 'Pedido não chegou no prazo', 'Preciso do relatório do mês',
  'Integração parou de sincronizar', 'Solicitar aumento de limite', 'Dúvida sobre a nota fiscal',
  'Acesso bloqueado depois da troca de senha',
]
const FALAS_CLIENTE = [
  'Bom dia! Estou com um problema aqui e preciso de ajuda.',
  'Já tentei pelo site e não deu certo.',
  'Consegue verificar pra mim, por favor?',
  'Isso é urgente, tenho que resolver hoje.',
  'Obrigado! Fico no aguardo.',
]
const FALAS_ATENDENTE = [
  'Olá! Sou eu quem vai te atender. Já estou verificando.',
  'Localizei seu cadastro aqui, um instante.',
  'Consegue confirmar o número do pedido, por favor?',
  'Encontrei o problema — vou corrigir agora.',
  'Pronto, ajustado. Pode conferir?',
]

const ativos = clientes.filter((c) => c.excluidoEm === null)
let seqMensagem = 1
let seqTransferencia = 1

export const mensagens: MensagemChat[] = []
export const transferencias: TransferenciaChat[] = []

export const conversas: Conversa[] = Array.from({ length: 18 }, (_, i) => {
  const cliente = ativos[i % ativos.length]
  const prioridade = escolher(['P1', 'P2', 'P3', 'P3', 'P4'] as const) as Prioridade
  const situacao: SituacaoConversa =
    i < 4 ? 'na_fila' : i < 12 ? 'em_atendimento' : i < 15 ? 'aguardando_cliente' : 'encerrada'
  const abertaHa = entre(2, 240)
  const naFila = situacao === 'na_fila'
  const esperaFila = naFila ? abertaHa : entre(1, 12)
  const assumidaEm = naFila ? null : minutosAtras(abertaHa - esperaFila)
  const respondeuEm = naFila ? null : minutosAtras(Math.max(1, abertaHa - esperaFila - entre(0, 6)))
  const encerrada = situacao === 'encerrada'

  return {
    id: i + 1,
    protocolo: `AT-${String(2601 + i).padStart(4, '0')}`,
    clienteId: cliente.id,
    cliente: cliente.nome,
    canal: escolher(CANAIS),
    assunto: ASSUNTOS[i % ASSUNTOS.length],
    situacao,
    atendente: naFila ? null : escolher(atendentes.slice(0, 5)).nome,
    prioridade,
    abertaEm: minutosAtras(abertaHa),
    assumidaEm,
    primeiraRespostaEm: respondeuEm,
    ultimaMensagemEm: minutosAtras(encerrada ? entre(60, 200) : entre(0, 20)),
    ultimaMensagemDe: situacao === 'em_atendimento' && rnd() > 0.5 ? 'cliente' : 'atendente',
    encerradaEm: encerrada ? minutosAtras(entre(30, 90)) : null,
    transferencias: rnd() > 0.75 ? entre(1, 3) : 0,
    naoLidas: situacao === 'em_atendimento' && rnd() > 0.6 ? entre(1, 4) : 0,
    tags: [escolher(['financeiro', 'suporte', 'comercial', 'urgente'])],
  }
})

// Histórico de mensagens por conversa
conversas.forEach((c) => {
  const n = c.situacao === 'na_fila' ? 1 : entre(4, 9)
  let quando = minutosEntre(c.abertaEm)
  for (let i = 0; i < n; i++) {
    const doCliente = i === 0 || i % 2 === 0
    quando = Math.max(0, quando - entre(1, 8))
    mensagens.push({
      id: seqMensagem++,
      conversaId: c.id,
      autor: doCliente ? 'cliente' : 'atendente',
      de: doCliente ? c.cliente : c.atendente,
      texto: doCliente ? FALAS_CLIENTE[i % FALAS_CLIENTE.length] : FALAS_ATENDENTE[i % FALAS_ATENDENTE.length],
      em: minutosAtras(quando),
      interna: false,
    })
  }
})

const recalcularCarga = () => {
  atendentes.forEach((a) => {
    a.emAtendimento = conversas.filter(
      (c) => c.atendente === a.nome && (c.situacao === 'em_atendimento' || c.situacao === 'aguardando_cliente'),
    ).length
  })
}
recalcularCarga()

/**
 * Os três relógios do chat. No chamado bastam dois (primeira resposta e
 * resolução); no chat o cliente sente também a ESPERA NA FILA — e ela é a
 * única que ninguém vê no painel de quem já está atendendo.
 *
 * O relógio de espera PARA quando a bola está com o cliente
 * (`aguardando_cliente`): medir tempo que a equipe não controla vira meta que
 * ninguém respeita.
 */
export function relogios(c: Conversa): RelogiosConversa {
  const meta = METAS[c.prioridade]
  const fila = c.assumidaEm ? minutosEntre(c.abertaEm, c.assumidaEm) : minutosEntre(c.abertaEm)
  const primeiraResposta = c.primeiraRespostaEm
    ? minutosEntre(c.abertaEm, c.primeiraRespostaEm)
    : c.encerradaEm ? minutosEntre(c.abertaEm, c.encerradaEm) : minutosEntre(c.abertaEm)
  const aguardando =
    c.situacao === 'em_atendimento' && c.ultimaMensagemDe === 'cliente' ? minutosEntre(c.ultimaMensagemEm) : 0

  return {
    fila, primeiraResposta, aguardando,
    metaFila: meta.fila, metaResposta: meta.resposta,
    estourouFila: fila > meta.fila,
    estourouResposta: primeiraResposta > meta.resposta,
  }
}

export const emRisco = (c: Conversa) => {
  const r = relogios(c)
  return c.situacao !== 'encerrada' && (r.estourouFila || r.estourouResposta || r.aguardando > r.metaResposta)
}

export async function listarConversas(filtro?: {
  situacao?: SituacaoConversa | 'minhas'
  busca?: string
}): Promise<Conversa[]> {
  await latencia(240)
  const termo = filtro?.busca?.trim().toLowerCase() ?? ''
  return conversas
    .filter((c) => {
      if (filtro?.situacao === 'minhas') return c.atendente === USUARIO_ATUAL && c.situacao !== 'encerrada'
      if (filtro?.situacao) return c.situacao === filtro.situacao
      return true
    })
    .filter((c) => !termo || `${c.cliente} ${c.assunto} ${c.protocolo}`.toLowerCase().includes(termo))
    .sort((a, b) => {
      if (a.situacao === 'na_fila' && b.situacao !== 'na_fila') return -1
      if (b.situacao === 'na_fila' && a.situacao !== 'na_fila') return 1
      const risco = Number(emRisco(b)) - Number(emRisco(a))
      return risco || +new Date(b.ultimaMensagemEm) - +new Date(a.ultimaMensagemEm)
    })
}

export async function obterConversa(id: number): Promise<Conversa> {
  await latencia(200)
  const c = conversas.find((x) => x.id === id)
  if (!c) throw new Error('Conversa não encontrada.')
  return c
}

export async function listarMensagens(conversaId: number): Promise<MensagemChat[]> {
  await latencia(180)
  return mensagens.filter((m) => m.conversaId === conversaId).sort((a, b) => +new Date(a.em) - +new Date(b.em))
}

export async function listarTransferencias(conversaId: number): Promise<TransferenciaChat[]> {
  await latencia(160)
  return transferencias.filter((t) => t.conversaId === conversaId).sort((a, b) => +new Date(b.em) - +new Date(a.em))
}

/** Assumir tira da fila e fecha o relógio da fila — mas NÃO é responder. */
export async function assumirConversa(id: number, quem = USUARIO_ATUAL): Promise<void> {
  await latencia(320)
  const c = conversas.find((x) => x.id === id)
  if (!c) throw new Error('Conversa não encontrada.')
  if (c.situacao !== 'na_fila') throw new Error('Esta conversa já tem atendente.')
  const eu = atendentes.find((a) => a.nome === quem)
  if (eu && eu.emAtendimento >= eu.capacidade) {
    throw new Error(`Você já está com ${eu.emAtendimento} conversas abertas (limite ${eu.capacidade}). Encerre uma antes de assumir outra.`)
  }
  c.atendente = quem
  c.situacao = 'em_atendimento'
  c.assumidaEm = new Date().toISOString()
  registrarSistema(c.id, `${quem} assumiu o atendimento.`)
  recalcularCarga()
}

export async function enviarMensagem(conversaId: number, texto: string, interna = false): Promise<void> {
  await latencia(220)
  const c = conversas.find((x) => x.id === conversaId)
  if (!c) throw new Error('Conversa não encontrada.')
  if (c.situacao === 'encerrada') throw new Error('Conversa encerrada não recebe mensagem — reabra ou abra outra.')
  if (!texto.trim()) throw new Error('Mensagem vazia.')

  const agora = new Date().toISOString()
  mensagens.push({
    id: seqMensagem++, conversaId, autor: 'atendente', de: c.atendente ?? USUARIO_ATUAL,
    texto: texto.trim(), em: agora, interna,
  })
  // Nota interna não conta como resposta ao cliente: o cliente não a vê.
  if (!interna) {
    if (!c.primeiraRespostaEm) c.primeiraRespostaEm = agora
    c.ultimaMensagemEm = agora
    c.ultimaMensagemDe = 'atendente'
    c.naoLidas = 0
    if (c.situacao === 'aguardando_cliente') c.situacao = 'em_atendimento'
  }
}

function registrarSistema(conversaId: number, texto: string) {
  mensagens.push({
    id: seqMensagem++, conversaId, autor: 'sistema', de: null,
    texto, em: new Date().toISOString(), interna: false,
  })
}

/** Quem pode receber uma transferência agora — e por que os outros não podem. */
export function destinosTransferencia(conversaId: number): (Atendente & { impedimento: string | null })[] {
  const c = conversas.find((x) => x.id === conversaId)
  return atendentes
    .filter((a) => a.nome !== c?.atendente)
    .map((a) => ({
      ...a,
      impedimento:
        a.status === 'offline' ? 'offline'
        : a.status === 'ausente' ? 'ausente'
        : a.emAtendimento >= a.capacidade ? `no limite (${a.emAtendimento}/${a.capacidade})`
        : null,
    }))
}

/**
 * Transferir é um REGISTRO, não a troca de um campo.
 *
 * Trocar `atendente` direto apaga de quem veio, por quê e quando — e é
 * exatamente isso que se precisa saber quando a conversa volta pela terceira
 * vez. Além disso a transferência fica PENDENTE de aceite: até alguém aceitar,
 * a conversa continua com quem já a tinha. Conversa não pode ficar sem dono
 * enquanto os dois lados acham que é do outro.
 */
export async function transferir(conversaId: number, para: string, motivo: string): Promise<TransferenciaChat> {
  await latencia(420)
  const c = conversas.find((x) => x.id === conversaId)
  if (!c) throw new Error('Conversa não encontrada.')
  if (c.situacao === 'encerrada') throw new Error('Conversa encerrada não se transfere.')
  if (!c.atendente) throw new Error('Conversa na fila não se transfere: ela é de quem assumir.')
  if (para === c.atendente) throw new Error('A conversa já é dessa pessoa.')
  if (motivo.trim().length < 10) {
    throw new Error('Descreva o motivo (mín. 10 caracteres): sem contexto, o cliente repete tudo de novo para o próximo.')
  }
  const destino = atendentes.find((a) => a.nome === para)
  if (!destino) throw new Error('Atendente não encontrado.')
  if (destino.status === 'offline' || destino.status === 'ausente') {
    throw new Error(`${para} está ${destino.status}. Transferir para quem não está na mesa deixa o cliente falando sozinho.`)
  }
  if (destino.emAtendimento >= destino.capacidade) {
    throw new Error(`${para} está com ${destino.emAtendimento}/${destino.capacidade} conversas. Escolha outra pessoa ou devolva para a fila.`)
  }
  if (transferencias.some((t) => t.conversaId === conversaId && t.situacao === 'pendente')) {
    throw new Error('Já existe uma transferência pendente nesta conversa.')
  }

  const t: TransferenciaChat = {
    id: seqTransferencia++, conversaId, de: c.atendente, para, motivo: motivo.trim(),
    em: new Date().toISOString(), situacao: 'pendente', resolvidaEm: null,
  }
  transferencias.push(t)
  registrarSistema(conversaId, `${c.atendente} pediu transferência para ${para}: "${t.motivo}"`)
  return t
}

/** O aceite é o que efetiva a troca — e o relógio do cliente segue correndo. */
export async function aceitarTransferencia(id: number): Promise<void> {
  await latencia(380)
  const t = transferencias.find((x) => x.id === id)
  if (!t) throw new Error('Transferência não encontrada.')
  if (t.situacao !== 'pendente') throw new Error('Esta transferência já foi resolvida.')
  const c = conversas.find((x) => x.id === t.conversaId)!

  t.situacao = 'aceita'
  t.resolvidaEm = new Date().toISOString()
  c.atendente = t.para
  c.transferencias += 1
  // NÃO se mexe em abertaEm nem em primeiraRespostaEm: o relógio é do cliente.
  registrarSistema(c.id, `${t.para} assumiu a conversa (transferida por ${t.de}).`)
  recalcularCarga()
}

export async function recusarTransferencia(id: number, motivo: string): Promise<void> {
  await latencia(300)
  const t = transferencias.find((x) => x.id === id)
  if (!t) throw new Error('Transferência não encontrada.')
  if (t.situacao !== 'pendente') throw new Error('Esta transferência já foi resolvida.')
  if (motivo.trim().length < 5) throw new Error('Diga por que está recusando.')
  t.situacao = 'recusada'
  t.resolvidaEm = new Date().toISOString()
  registrarSistema(t.conversaId, `${t.para} recusou a transferência: "${motivo.trim()}" — segue com ${t.de}.`)
}

/** Devolver à fila é honesto; sumir com a conversa não é. */
export async function devolverParaFila(conversaId: number, motivo: string): Promise<void> {
  await latencia(340)
  const c = conversas.find((x) => x.id === conversaId)
  if (!c) throw new Error('Conversa não encontrada.')
  if (motivo.trim().length < 5) throw new Error('Diga por que está devolvendo.')
  const anterior = c.atendente
  c.atendente = null
  c.situacao = 'na_fila'
  c.transferencias += 1
  registrarSistema(conversaId, `${anterior} devolveu para a fila: "${motivo.trim()}"`)
  recalcularCarga()
}

export async function marcarAguardandoCliente(conversaId: number): Promise<void> {
  await latencia(240)
  const c = conversas.find((x) => x.id === conversaId)
  if (!c) throw new Error('Conversa não encontrada.')
  if (c.situacao !== 'em_atendimento') throw new Error('Só conversa em atendimento entra em espera.')
  c.situacao = 'aguardando_cliente'
  registrarSistema(conversaId, 'Aguardando retorno do cliente — o relógio de resposta pausa aqui.')
}

export async function encerrarConversa(conversaId: number, resumo: string): Promise<void> {
  await latencia(420)
  const c = conversas.find((x) => x.id === conversaId)
  if (!c) throw new Error('Conversa não encontrada.')
  if (c.situacao === 'encerrada') throw new Error('Conversa já encerrada.')
  if (transferencias.some((t) => t.conversaId === conversaId && t.situacao === 'pendente')) {
    throw new Error('Há uma transferência pendente: resolva antes de encerrar.')
  }
  if (resumo.trim().length < 10) throw new Error('Escreva o resumo do que foi resolvido (mín. 10 caracteres).')
  c.situacao = 'encerrada'
  c.encerradaEm = new Date().toISOString()
  registrarSistema(conversaId, `Atendimento encerrado por ${c.atendente}: "${resumo.trim()}"`)
  recalcularCarga()
}

export async function definirStatus(nome: string, status: StatusAtendente): Promise<void> {
  await latencia(220)
  const a = atendentes.find((x) => x.nome === nome)
  if (!a) throw new Error('Atendente não encontrado.')
  if ((status === 'offline' || status === 'ausente') && a.emAtendimento > 0) {
    throw new Error(`${nome} ainda tem ${a.emAtendimento} conversa(s) aberta(s). Transfira ou devolva à fila antes de sair.`)
  }
  a.status = status
}

export async function listarAtendentes(): Promise<Atendente[]> {
  await latencia(200)
  recalcularCarga()
  return [...atendentes]
}

export async function totaisChat(): Promise<TotaisChat> {
  await latencia(220)
  const abertas = conversas.filter((c) => c.situacao !== 'encerrada')
  const atendidas = conversas.filter((c) => c.assumidaEm)
  const respondidas = conversas.filter((c) => c.primeiraRespostaEm)
  const media = (ns: number[]) => (ns.length ? Math.round(ns.reduce((s, n) => s + n, 0) / ns.length) : 0)

  return {
    naFila: conversas.filter((c) => c.situacao === 'na_fila').length,
    emAtendimento: conversas.filter((c) => c.situacao === 'em_atendimento').length,
    minhas: abertas.filter((c) => c.atendente === USUARIO_ATUAL).length,
    esperaMediaFila: media(atendidas.map((c) => relogios(c).fila)),
    primeiraRespostaMedia: media(respondidas.map((c) => relogios(c).primeiraResposta)),
    estouros: abertas.filter(emRisco).length,
    transferidasHoje: conversas.reduce((s, c) => s + c.transferencias, 0),
  }
}
