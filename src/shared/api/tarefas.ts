import { clientes } from './mock-db'
import { contratos } from './contratos'
import type {
  ComentarioTarefa, ListParams, ListResponse, PrioridadeTarefa, SituacaoTarefa, Tarefa,
  TotaisTarefas, VinculoTarefa,
} from './types'

/** Gestão de tarefas — dados fictícios. */
const latencia = (ms = 340) => new Promise((r) => setTimeout(r, ms + Math.random() * 200))

function prng(seed: number) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
}
const rnd = prng(20260905)
const entre = (min: number, max: number) => Math.round(min + rnd() * (max - min))
const escolher = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]
const somarDias = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString() }

export const USUARIO_ATUAL = 'Paulo Roberto'
export const RESPONSAVEIS = ['Paulo Roberto', 'Camila Bonfim', 'Rafael Quintana', 'Ana Beatriz', 'Diego Ferrari'] as const
const ETIQUETAS = ['cobrança', 'onboarding', 'suporte', 'jurídico', 'financeiro', 'melhoria'] as const

export const SITUACOES: { id: SituacaoTarefa; rotulo: string; limite?: number }[] = [
  { id: 'a_fazer', rotulo: 'A fazer' },
  // Limite por coluna: sem teto, "em andamento" vira lista de desejos.
  { id: 'em_andamento', rotulo: 'Em andamento', limite: 6 },
  { id: 'em_revisao', rotulo: 'Em revisão', limite: 4 },
  { id: 'concluida', rotulo: 'Concluída' },
]

const TITULOS = [
  'Cobrar fatura vencida', 'Revisar minuta do contrato', 'Configurar integração de e-mail',
  'Renovar certidão negativa', 'Ligar para o cliente sobre o reajuste', 'Conferir conciliação do mês',
  'Preparar relatório para a diretoria', 'Atualizar dados cadastrais', 'Fechar chamado de suporte',
  'Enviar proposta revisada', 'Validar dados da nota fiscal', 'Agendar reunião de renovação',
] as const

const ativos = clientes.filter((c) => c.excluidoEm === null)

function vinculo(i: number): VinculoTarefa {
  const s = rnd()
  if (s > 0.8) return { tipo: 'nenhum', id: null, rotulo: 'Sem vínculo' }
  if (s > 0.5) {
    const contrato = contratos[i % contratos.length]
    return { tipo: 'contrato', id: contrato.id, rotulo: contrato.numero }
  }
  const cliente = ativos[i % ativos.length]
  return { tipo: 'cliente', id: cliente.id, rotulo: cliente.nome }
}

let proximoId = 1
export const tarefas: Tarefa[] = Array.from({ length: 46 }, (_, i) => {
  const situacao: SituacaoTarefa =
    rnd() > 0.78 ? 'concluida' : rnd() > 0.72 ? 'em_revisao' : rnd() > 0.5 ? 'em_andamento' : 'a_fazer'
  const prioridade: PrioridadeTarefa = escolher(['baixa', 'media', 'media', 'alta', 'urgente'] as const)
  const temResponsavel = rnd() > 0.15
  const temPrazo = rnd() > 0.2

  return {
    id: proximoId++,
    titulo: `${escolher(TITULOS)}`,
    descricao: 'Descrição de exemplo com o contexto necessário para alguém executar sem perguntar.',
    situacao,
    prioridade,
    responsavel: temResponsavel ? (rnd() > 0.55 ? USUARIO_ATUAL : escolher(RESPONSAVEIS)) : null,
    criadoPor: escolher(RESPONSAVEIS),
    criadoEm: somarDias(-entre(1, 60)),
    prazo: temPrazo ? somarDias(entre(-12, 25)) : null,
    concluidaEm: situacao === 'concluida' ? somarDias(-entre(0, 10)) : null,
    concluidaPor: situacao === 'concluida' ? escolher(RESPONSAVEIS) : null,
    vinculo: vinculo(i),
    etiquetas: [escolher(ETIQUETAS), ...(rnd() > 0.7 ? [escolher(ETIQUETAS)] : [])].filter((v, idx, a) => a.indexOf(v) === idx),
    checklist: Array.from({ length: entre(0, 4) }, (_, k) => ({ id: k + 1, texto: `Passo ${k + 1} da tarefa`, feito: rnd() > 0.5 })),
    comentarios: entre(0, 5),
  }
})

// ── Derivados ────────────────────────────────────────────────────────────────

const aberta = (t: Tarefa) => t.situacao !== 'concluida' && t.situacao !== 'cancelada'

export const estaAtrasada = (t: Tarefa) => aberta(t) && !!t.prazo && new Date(t.prazo) < new Date()

export const venceHoje = (t: Tarefa) =>
  aberta(t) && !!t.prazo && new Date(t.prazo).toDateString() === new Date().toDateString()

/** Sem responsável ou sem prazo, é lembrete — não tarefa. */
export const semDono = (t: Tarefa) => aberta(t) && !t.responsavel
export const semPrazo = (t: Tarefa) => aberta(t) && !t.prazo

export type FiltroTarefas = ListParams & { responsavel?: string }

function aplicar(params: FiltroTarefas) {
  const { search, filters, responsavel } = params
  let linhas = [...tarefas]

  if (responsavel) linhas = linhas.filter((t) => t.responsavel === responsavel)
  if (search?.trim()) {
    const q = search.trim().toLowerCase()
    linhas = linhas.filter((t) => t.titulo.toLowerCase().includes(q) || t.vinculo.rotulo.toLowerCase().includes(q))
  }
  if (filters?.situacao) linhas = linhas.filter((t) => t.situacao === filters.situacao)
  if (filters?.prioridade) linhas = linhas.filter((t) => t.prioridade === filters.prioridade)
  if (filters?.prazo === 'atrasada') linhas = linhas.filter(estaAtrasada)
  if (filters?.prazo === 'hoje') linhas = linhas.filter(venceHoje)
  if (filters?.prazo === 'sem_prazo') linhas = linhas.filter(semPrazo)
  if (filters?.etiqueta) linhas = linhas.filter((t) => t.etiquetas.includes(filters.etiqueta!))
  return linhas
}

export async function listarTarefas(params: FiltroTarefas): Promise<ListResponse<Tarefa>> {
  await latencia()
  const { page, perPage, sortBy, sortDir } = params
  const linhas = aplicar(params)

  const dir = sortDir === 'asc' ? 1 : -1
  linhas.sort((a, b) => {
    const va = a[sortBy as keyof Tarefa]
    const vb = b[sortBy as keyof Tarefa]
    if (va === vb) return a.id - b.id
    if (va == null) return 1
    if (vb == null) return -1
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va).localeCompare(String(vb), 'pt-BR') * dir
  })

  const total = linhas.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const pagina = Math.min(page, totalPages)
  return { data: linhas.slice((pagina - 1) * perPage, pagina * perPage), meta: { total, totalPages, page: pagina, perPage } }
}

/** O quadro devolve TODAS as tarefas do recorte, agrupadas por coluna. */
export async function obterQuadro(params: FiltroTarefas): Promise<Record<SituacaoTarefa, Tarefa[]>> {
  await latencia(420)
  const linhas = aplicar({ ...params, page: 1, perPage: 1000 })
  const quadro = { a_fazer: [], em_andamento: [], em_revisao: [], concluida: [], cancelada: [] } as Record<SituacaoTarefa, Tarefa[]>
  linhas.forEach((t) => quadro[t.situacao].push(t))
  // Dentro da coluna: atrasada primeiro, depois prioridade, depois prazo.
  const peso: Record<PrioridadeTarefa, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 }
  Object.values(quadro).forEach((coluna) =>
    coluna.sort((a, b) => {
      if (estaAtrasada(a) !== estaAtrasada(b)) return estaAtrasada(a) ? -1 : 1
      if (peso[a.prioridade] !== peso[b.prioridade]) return peso[a.prioridade] - peso[b.prioridade]
      return +new Date(a.prazo ?? '2999-01-01') - +new Date(b.prazo ?? '2999-01-01')
    }),
  )
  return quadro
}

export async function totaisTarefas(): Promise<TotaisTarefas> {
  await latencia(240)
  const semanaAtras = Date.now() - 7 * 86400000
  return {
    minhas: tarefas.filter((t) => aberta(t) && t.responsavel === USUARIO_ATUAL).length,
    atrasadas: tarefas.filter(estaAtrasada).length,
    semResponsavel: tarefas.filter(semDono).length,
    semPrazo: tarefas.filter(semPrazo).length,
    concluidasSemana: tarefas.filter((t) => t.concluidaEm && +new Date(t.concluidaEm) >= semanaAtras).length,
  }
}

export async function obterTarefa(id: number): Promise<Tarefa> {
  await latencia(240)
  const t = tarefas.find((x) => x.id === id)
  if (!t) throw new Error('Tarefa não encontrada.')
  return { ...t }
}

/**
 * Mover respeita o limite da coluna: o limite existe para forçar a conversa
 * ("o que a gente termina antes de começar mais?"), então recusar é a função
 * dele — não um detalhe a contornar.
 */
export async function moverTarefa(id: number, situacao: SituacaoTarefa, forcar = false): Promise<void> {
  await latencia(320)
  const tarefa = tarefas.find((t) => t.id === id)
  if (!tarefa) throw new Error('Tarefa não encontrada.')

  const coluna = SITUACOES.find((s) => s.id === situacao)
  if (coluna?.limite && !forcar) {
    const ocupadas = tarefas.filter((t) => t.situacao === situacao).length
    if (ocupadas >= coluna.limite) {
      throw new Error(`"${coluna.rotulo}" já está com ${ocupadas} de ${coluna.limite}. Termine algo antes de puxar mais.`)
    }
  }

  // Concluir registra QUEM e QUANDO; reabrir limpa e fica no histórico.
  if (situacao === 'concluida') {
    tarefa.concluidaEm = new Date().toISOString()
    tarefa.concluidaPor = USUARIO_ATUAL
  } else if (tarefa.situacao === 'concluida') {
    tarefa.concluidaEm = null
    tarefa.concluidaPor = null
  }
  tarefa.situacao = situacao
}

export type NovaTarefa = {
  titulo: string
  descricao: string
  responsavel: string | null
  prazo: string | null
  prioridade: PrioridadeTarefa
  etiquetas: string[]
}

export async function criarTarefa(dados: NovaTarefa): Promise<Tarefa> {
  await latencia(560)
  const tarefa: Tarefa = {
    id: proximoId++,
    titulo: dados.titulo,
    descricao: dados.descricao,
    situacao: 'a_fazer',
    prioridade: dados.prioridade,
    responsavel: dados.responsavel,
    criadoPor: USUARIO_ATUAL,
    criadoEm: new Date().toISOString(),
    prazo: dados.prazo,
    concluidaEm: null,
    concluidaPor: null,
    vinculo: { tipo: 'nenhum', id: null, rotulo: 'Sem vínculo' },
    etiquetas: dados.etiquetas,
    checklist: [],
    comentarios: 0,
  }
  tarefas.unshift(tarefa)
  return tarefa
}

export async function alternarChecklist(tarefaId: number, itemId: number): Promise<void> {
  await latencia(220)
  const item = tarefas.find((t) => t.id === tarefaId)?.checklist.find((c) => c.id === itemId)
  if (item) item.feito = !item.feito
}

const comentarios = new Map<number, ComentarioTarefa[]>()
let proximoComentario = 1

export async function listarComentarios(tarefaId: number): Promise<ComentarioTarefa[]> {
  await latencia(260)
  const existente = comentarios.get(tarefaId)
  if (existente) return existente
  const tarefa = tarefas.find((t) => t.id === tarefaId)
  const lista: ComentarioTarefa[] = Array.from({ length: tarefa?.comentarios ?? 0 }, () => ({
    id: proximoComentario++,
    tarefaId,
    autor: escolher(RESPONSAVEIS),
    texto: escolher([
      'Cliente pediu para retomar na semana que vem.',
      'Enviei o e-mail, aguardando retorno.',
      'Precisa da aprovação do financeiro antes de seguir.',
      'Documento anexado na ficha do contrato.',
    ] as const),
    criadoEm: somarDias(-entre(0, 20)),
  }))
  comentarios.set(tarefaId, lista)
  return lista
}

export async function comentar(tarefaId: number, texto: string): Promise<ComentarioTarefa> {
  await latencia(420)
  if (texto.trim().length < 2) throw new Error('Escreva algo antes de enviar.')
  const lista = comentarios.get(tarefaId) ?? []
  const comentario: ComentarioTarefa = {
    id: proximoComentario++, tarefaId, autor: USUARIO_ATUAL, texto: texto.trim(), criadoEm: new Date().toISOString(),
  }
  lista.unshift(comentario)
  comentarios.set(tarefaId, lista)
  const tarefa = tarefas.find((t) => t.id === tarefaId)
  if (tarefa) tarefa.comentarios = lista.length
  return comentario
}

export const etiquetasDisponiveis = [...ETIQUETAS]
