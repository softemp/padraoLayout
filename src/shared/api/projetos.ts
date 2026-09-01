import { clientes } from './mock-db'
import type {
  Apontamento, ListParams, ListResponse, Marco, Projeto, Replanejamento, Risco,
  SituacaoProjeto, TotaisProjetos,
} from './types'

/**
 * Projetos — o módulo onde mora a armadilha clássica: **consumo de horas não é
 * avanço**. Os dois números andam sempre juntos aqui.
 */
const latencia = (ms = 360) => new Promise((r) => setTimeout(r, ms + Math.random() * 200))

function prng(seed: number) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
}
const rnd = prng(20260910)
const entre = (min: number, max: number) => Math.round(min + rnd() * (max - min))
const escolher = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]
const somarDias = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString() }

const RESPONSAVEIS = ['Camila Bonfim', 'Rafael Quintana', 'Ana Beatriz', 'Paulo Roberto'] as const
const EQUIPE = ['Camila Bonfim', 'Rafael Quintana', 'Ana Beatriz', 'Diego Ferrari', 'Mariana Duarte'] as const
const NOMES = [
  'Implantação da plataforma', 'Integração com ERP', 'Migração de dados legados',
  'Portal do cliente', 'App de campo', 'Reforma do e-commerce', 'BI e relatórios',
  'Automação de cobrança', 'Módulo fiscal', 'Onboarding digital',
] as const

const ativos = clientes.filter((c) => c.excluidoEm === null)

let proximoId = 1
export const projetos: Projeto[] = NOMES.flatMap((nome, i) =>
  Array.from({ length: entre(1, 2) }, () => {
    const cliente = ativos[i % ativos.length]
    const inicio = somarDias(-entre(30, 400))
    const prazoBaseline = somarDias(entre(-60, 180))
    const atrasou = rnd() > 0.6
    const horasBaseline = entre(120, 1400)
    const sorteio = rnd()
    const situacao: SituacaoProjeto =
      sorteio > 0.9 ? 'planejado' : sorteio > 0.78 ? 'concluido' : sorteio > 0.72 ? 'pausado'
        : sorteio > 0.62 ? 'em_risco' : sorteio > 0.06 ? 'em_andamento' : 'cancelado'

    return {
      id: proximoId++,
      codigo: `PRJ-${String(proximoId).padStart(3, '0')}`,
      nome,
      cliente: cliente.nome,
      clienteId: cliente.id,
      responsavel: escolher(RESPONSAVEIS),
      situacao,
      inicio,
      prazo: atrasou ? somarDias(entre(-30, 90)) : prazoBaseline,
      prazoBaseline,
      horasOrcadas: atrasou ? Math.round(horasBaseline * 1.2) : horasBaseline,
      horasBaseline,
      valorContrato: entre(28_000, 480_000),
      custoHora: entre(9000, 22000) / 100,
      despesas: entre(0, 24_000),
    }
  }),
)

// ── Marcos, apontamentos, riscos ─────────────────────────────────────────────

const marcos = new Map<number, Marco[]>()
const apontamentos = new Map<number, Apontamento[]>()
const riscos = new Map<number, Risco[]>()
const replanejamentos = new Map<number, Replanejamento[]>()
let seqMarco = 1, seqApont = 1, seqRisco = 1, seqReplan = 1

function garantirMarcos(projetoId: number): Marco[] {
  const existente = marcos.get(projetoId)
  if (existente) return existente
  const projeto = projetos.find((p) => p.id === projetoId)
  const nomes = ['Kickoff e levantamento', 'Modelagem e protótipo', 'Desenvolvimento', 'Homologação', 'Go-live e treinamento']
  const pesos = [10, 20, 40, 20, 10]
  const lista: Marco[] = nomes.map((nome, i) => {
    const previsto = projeto ? somarDias(entre(-120, 120)) : somarDias(i * 30)
    const concluido = projeto ? rnd() < 0.45 : false
    return {
      id: seqMarco++, projetoId, nome,
      previsto,
      previstoBaseline: previsto,
      entregue: concluido ? somarDias(-entre(1, 60)) : null,
      peso: pesos[i],
      concluido,
    }
  })
  marcos.set(projetoId, lista)
  return lista
}

function garantirApontamentos(projetoId: number): Apontamento[] {
  const existente = apontamentos.get(projetoId)
  if (existente) return existente
  const projeto = projetos.find((p) => p.id === projetoId)
  const alvo = projeto ? Math.round(projeto.horasOrcadas * (0.2 + rnd() * 1.1)) : 100
  const lista: Apontamento[] = []
  let acumulado = 0
  while (acumulado < alvo) {
    const horas = entre(2, 8)
    acumulado += horas
    lista.push({
      id: seqApont++, projetoId,
      pessoa: escolher(EQUIPE),
      data: somarDias(-entre(0, 200)),
      horas,
      atividade: escolher(['Desenvolvimento', 'Reunião com cliente', 'Documentação', 'Correção de bug', 'Testes', 'Suporte'] as const),
      faturavel: rnd() > 0.2,
    })
  }
  const ordenado = lista.sort((a, b) => +new Date(b.data) - +new Date(a.data))
  apontamentos.set(projetoId, ordenado)
  return ordenado
}

function garantirRiscos(projetoId: number): Risco[] {
  const existente = riscos.get(projetoId)
  if (existente) return existente
  const catalogo = [
    ['Dependência de dado do cliente que ainda não chegou', 'Cobrança semanal + prazo suspenso no cronograma'],
    ['Integração com sistema legado sem documentação', 'Reserva de 40h de investigação no orçamento'],
    ['Equipe alocada em dois projetos ao mesmo tempo', 'Prioridade definida com a diretoria'],
    ['Homologação depende de janela do cliente', 'Datas acordadas com 30 dias de antecedência'],
  ] as const
  const lista: Risco[] = catalogo.slice(0, entre(1, 4)).map(([descricao, mitigacao]) => ({
    id: seqRisco++, projetoId, descricao,
    probabilidade: escolher(['baixa', 'media', 'alta'] as const),
    impacto: escolher(['baixo', 'medio', 'alto'] as const),
    mitigacao,
    aberto: rnd() > 0.3,
  }))
  riscos.set(projetoId, lista)
  return lista
}

// ── Derivados: os dois números que precisam andar juntos ─────────────────────

/** Avanço FÍSICO: soma do peso dos marcos concluídos. */
export const avancoFisico = (projetoId: number) => {
  const lista = garantirMarcos(projetoId)
  const total = lista.reduce((s, m) => s + m.peso, 0) || 1
  return lista.filter((m) => m.concluido).reduce((s, m) => s + m.peso, 0) / total
}

export const horasGastas = (projetoId: number) =>
  garantirApontamentos(projetoId).reduce((s, a) => s + a.horas, 0)

/** Consumo do ORÇAMENTO de horas — que não é avanço. */
export const consumoHoras = (p: Projeto) => (p.horasOrcadas > 0 ? horasGastas(p.id) / p.horasOrcadas : 0)

/**
 * O sinal que interessa: consumo menos avanço. Positivo grande = gastou muito
 * e entregou pouco. É a conta que ninguém faz até o projeto estourar.
 */
export const desvio = (p: Projeto) => consumoHoras(p) - avancoFisico(p.id)

export const custoRealizado = (p: Projeto) => horasGastas(p.id) * p.custoHora + p.despesas
export const custoPrevisto = (p: Projeto) => p.horasOrcadas * p.custoHora + p.despesas
export const margemProjeto = (p: Projeto) =>
  p.valorContrato > 0 ? (p.valorContrato - custoRealizado(p)) / p.valorContrato : 0

export const atrasado = (p: Projeto) =>
  ['em_andamento', 'em_risco', 'pausado'].includes(p.situacao) && new Date(p.prazo) < new Date()

export const estourandoHoras = (p: Projeto) => consumoHoras(p) > 1
export const derrapando = (p: Projeto) => desvio(p) > 0.2 && !['concluido', 'cancelado'].includes(p.situacao)

export async function listarProjetos(params: ListParams): Promise<ListResponse<Projeto>> {
  await latencia()
  const { page, perPage, sortBy, sortDir, search, filters } = params
  let linhas = [...projetos]

  if (search?.trim()) {
    const q = search.trim().toLowerCase()
    linhas = linhas.filter((p) => p.nome.toLowerCase().includes(q) || p.cliente.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q))
  }
  if (filters?.situacao === 'atrasado') linhas = linhas.filter(atrasado)
  else if (filters?.situacao === 'derrapando') linhas = linhas.filter(derrapando)
  else if (filters?.situacao) linhas = linhas.filter((p) => p.situacao === filters.situacao)
  if (filters?.responsavel) linhas = linhas.filter((p) => p.responsavel === filters.responsavel)

  const dir = sortDir === 'asc' ? 1 : -1
  linhas.sort((a, b) => {
    if (sortBy === 'desvio') return (desvio(a) - desvio(b)) * dir
    if (sortBy === 'margem') return (margemProjeto(a) - margemProjeto(b)) * dir
    const va = a[sortBy as keyof Projeto]
    const vb = b[sortBy as keyof Projeto]
    if (va === vb) return a.id - b.id
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va).localeCompare(String(vb), 'pt-BR') * dir
  })

  const total = linhas.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const pagina = Math.min(page, totalPages)
  return { data: linhas.slice((pagina - 1) * perPage, pagina * perPage), meta: { total, totalPages, page: pagina, perPage } }
}

export async function totaisProjetos(): Promise<TotaisProjetos> {
  await latencia(280)
  const vivos = projetos.filter((p) => ['em_andamento', 'em_risco', 'pausado'].includes(p.situacao))
  const inicioMes = new Date(); inicioMes.setDate(1)
  const horasMes = projetos.reduce(
    (s, p) => s + garantirApontamentos(p.id).filter((a) => new Date(a.data) >= inicioMes).reduce((t, a) => t + a.horas, 0),
    0,
  )
  const margens = vivos.map(margemProjeto)
  return {
    emAndamento: vivos.length,
    atrasados: projetos.filter(atrasado).length,
    estourandoHoras: projetos.filter(estourandoHoras).length,
    margemMedia: margens.length ? margens.reduce((s, m) => s + m, 0) / margens.length : 0,
    horasMes,
  }
}

export async function obterProjeto(id: number): Promise<Projeto> {
  await latencia(240)
  const p = projetos.find((x) => x.id === id)
  if (!p) throw new Error('Projeto não encontrado.')
  return { ...p }
}

export async function obterMarcos(projetoId: number) { await latencia(280); return garantirMarcos(projetoId) }
export async function obterApontamentos(projetoId: number) { await latencia(300); return garantirApontamentos(projetoId) }
export async function obterRiscos(projetoId: number) { await latencia(260); return garantirRiscos(projetoId) }
export async function obterReplanejamentos(projetoId: number) { await latencia(240); return replanejamentos.get(projetoId) ?? [] }

export async function concluirMarco(projetoId: number, marcoId: number): Promise<void> {
  await latencia(420)
  const marco = garantirMarcos(projetoId).find((m) => m.id === marcoId)
  if (!marco) throw new Error('Marco não encontrado.')
  marco.concluido = !marco.concluido
  marco.entregue = marco.concluido ? new Date().toISOString() : null
}

export async function apontarHoras(projetoId: number, dados: { horas: number; atividade: string; faturavel: boolean }): Promise<void> {
  await latencia(520)
  if (!(dados.horas > 0) || dados.horas > 24) throw new Error('Aponte entre 0 e 24 horas.')
  if (dados.atividade.trim().length < 3) throw new Error('Descreva a atividade.')
  garantirApontamentos(projetoId).unshift({
    id: seqApont++, projetoId, pessoa: 'Paulo Roberto', data: new Date().toISOString(),
    horas: dados.horas, atividade: dados.atividade, faturavel: dados.faturavel,
  })
}

/**
 * Replanejar NÃO reescreve a linha de base: cria um registro com o antes e o
 * depois. Sem isso, o projeto que estourou o prazo três vezes aparece como
 * "no prazo" — cada replanejamento apaga a evidência do anterior.
 */
export async function replanejar(
  projetoId: number,
  dados: { prazoNovo: string; horasNovas: number; motivo: string },
): Promise<void> {
  await latencia(680)
  const projeto = projetos.find((p) => p.id === projetoId)
  if (!projeto) throw new Error('Projeto não encontrado.')
  if (dados.motivo.trim().length < 10) throw new Error('Descreva o motivo do replanejamento — é o que explica o desvio depois.')

  const lista = replanejamentos.get(projetoId) ?? []
  lista.unshift({
    id: seqReplan++, projetoId, criadoEm: new Date().toISOString(), autor: 'Paulo Roberto',
    motivo: dados.motivo,
    prazoAnterior: projeto.prazo, prazoNovo: dados.prazoNovo,
    horasAnteriores: projeto.horasOrcadas, horasNovas: dados.horasNovas,
  })
  replanejamentos.set(projetoId, lista)

  projeto.prazo = dados.prazoNovo
  projeto.horasOrcadas = dados.horasNovas
  // prazoBaseline e horasBaseline NÃO mudam: é contra elas que o desvio é medido.
}

export const responsaveisProjeto = [...RESPONSAVEIS]

// ── Estrutura: fases e tarefas ───────────────────────────────────────────────

import type { CapacidadePessoa, Fase, NovoProjeto, TarefaProjeto } from './types'

const fases = new Map<number, Fase[]>()
const tarefasProjeto = new Map<number, TarefaProjeto[]>()
let seqFase = 1, seqTarefa = 1

const NOMES_FASE = ['Descoberta', 'Modelagem', 'Desenvolvimento', 'Homologação', 'Implantação'] as const
const NOMES_TAREFA = [
  'Levantar requisitos com o cliente', 'Desenhar o modelo de dados', 'Implementar a API',
  'Construir as telas', 'Escrever os testes', 'Configurar o ambiente', 'Treinar a equipe do cliente',
  'Migrar os dados', 'Revisar com o time', 'Documentar a entrega',
] as const

function garantirEstrutura(projetoId: number) {
  if (fases.has(projetoId)) return
  const projeto = projetos.find((p) => p.id === projetoId)
  if (!projeto) { fases.set(projetoId, []); tarefasProjeto.set(projetoId, []); return }

  const listaFases: Fase[] = NOMES_FASE.map((nome, i) => ({
    id: seqFase++, projetoId, nome, ordem: i + 1,
    inicioPrevisto: somarDias(-120 + i * 30),
    fimPrevisto: somarDias(-120 + (i + 1) * 30),
    concluida: rnd() < 0.4,
  }))
  const listaTarefas: TarefaProjeto[] = []
  listaFases.forEach((fase) => {
    const quantas = entre(2, 5)
    for (let i = 0; i < quantas; i++) {
      const horas = entre(4, 60)
      listaTarefas.push({
        id: seqTarefa++, projetoId, faseId: fase.id,
        nome: escolher(NOMES_TAREFA),
        responsavel: rnd() > 0.12 ? escolher(EQUIPE) : null,
        horasEstimadas: horas,
        horasApontadas: fase.concluida ? Math.round(horas * (0.8 + rnd() * 0.6)) : Math.round(horas * rnd() * 0.7),
        inicioPrevisto: fase.inicioPrevisto,
        fimPrevisto: fase.fimPrevisto,
        dependeDe: null,
        concluida: fase.concluida || rnd() < 0.3,
      })
    }
  })
  fases.set(projetoId, listaFases)
  tarefasProjeto.set(projetoId, listaTarefas)
}

export async function obterFases(projetoId: number): Promise<Fase[]> {
  await latencia(280); garantirEstrutura(projetoId)
  return (fases.get(projetoId) ?? []).sort((a, b) => a.ordem - b.ordem)
}

export async function obterTarefasProjeto(projetoId: number): Promise<TarefaProjeto[]> {
  await latencia(300); garantirEstrutura(projetoId)
  return tarefasProjeto.get(projetoId) ?? []
}

/** Horas PLANEJADAS: a soma das tarefas. Se não bate com o orçado, um dos dois é ficção. */
export const horasPlanejadas = (projetoId: number) => {
  garantirEstrutura(projetoId)
  return (tarefasProjeto.get(projetoId) ?? []).reduce((s, t) => s + t.horasEstimadas, 0)
}

/**
 * O peso da fase é DERIVADO das horas estimadas das tarefas dela — não é um
 * número digitado. Peso na mão descola do plano no primeiro replanejamento, e
 * o avanço físico vira chute com aparência de métrica.
 */
export const pesoFase = (projetoId: number, faseId: number) => {
  const total = horasPlanejadas(projetoId) || 1
  const daFase = (tarefasProjeto.get(projetoId) ?? []).filter((t) => t.faseId === faseId).reduce((s, t) => s + t.horasEstimadas, 0)
  return daFase / total
}

export const avancoPorTarefas = (projetoId: number) => {
  garantirEstrutura(projetoId)
  const lista = tarefasProjeto.get(projetoId) ?? []
  const total = lista.reduce((s, t) => s + t.horasEstimadas, 0) || 1
  return lista.filter((t) => t.concluida).reduce((s, t) => s + t.horasEstimadas, 0) / total
}

export async function criarFase(projetoId: number, nome: string, inicio: string, fim: string): Promise<Fase> {
  await latencia(480)
  garantirEstrutura(projetoId)
  if (nome.trim().length < 3) throw new Error('Dê um nome à fase.')
  if (new Date(fim) <= new Date(inicio)) throw new Error('O fim da fase precisa ser depois do início.')
  const projeto = projetos.find((p) => p.id === projetoId)
  if (projeto && new Date(fim) > new Date(projeto.prazo)) {
    throw new Error(`A fase termina depois do prazo do projeto (${new Date(projeto.prazo).toLocaleDateString('pt-BR')}). Replaneje o projeto ou encurte a fase.`)
  }
  const lista = fases.get(projetoId)!
  const fase: Fase = { id: seqFase++, projetoId, nome, ordem: lista.length + 1, inicioPrevisto: inicio, fimPrevisto: fim, concluida: false }
  lista.push(fase)
  return fase
}

export type NovaTarefaProjeto = {
  faseId: number
  nome: string
  responsavel: string | null
  horasEstimadas: number
  inicioPrevisto: string
  fimPrevisto: string
}

/**
 * A tarefa não pode ultrapassar a fase, e a fase não pode ultrapassar o
 * projeto: o prazo de cima é o contrato com quem está de fora, e estourar por
 * dentro sem ninguém ver é como o atraso só aparece na véspera.
 */
export async function criarTarefaProjeto(projetoId: number, dados: NovaTarefaProjeto): Promise<TarefaProjeto> {
  await latencia(520)
  garantirEstrutura(projetoId)
  if (dados.nome.trim().length < 3) throw new Error('Dê um nome à tarefa.')
  if (!(dados.horasEstimadas > 0)) throw new Error('Informe a estimativa de horas.')

  const fase = fases.get(projetoId)!.find((f) => f.id === dados.faseId)
  if (!fase) throw new Error('Fase não encontrada.')
  if (new Date(dados.fimPrevisto) > new Date(fase.fimPrevisto)) {
    throw new Error(`A tarefa termina depois da fase "${fase.nome}" (${new Date(fase.fimPrevisto).toLocaleDateString('pt-BR')}). Ajuste a data ou estenda a fase.`)
  }

  const tarefa: TarefaProjeto = {
    id: seqTarefa++, projetoId, faseId: dados.faseId, nome: dados.nome,
    responsavel: dados.responsavel, horasEstimadas: dados.horasEstimadas,
    horasApontadas: 0, inicioPrevisto: dados.inicioPrevisto, fimPrevisto: dados.fimPrevisto,
    dependeDe: null, concluida: false,
  }
  tarefasProjeto.get(projetoId)!.push(tarefa)
  return tarefa
}

export async function alternarTarefaProjeto(projetoId: number, tarefaId: number): Promise<void> {
  await latencia(300)
  const t = tarefasProjeto.get(projetoId)?.find((x) => x.id === tarefaId)
  if (t) t.concluida = !t.concluida
}

export async function atribuirTarefa(projetoId: number, tarefaId: number, pessoa: string | null): Promise<void> {
  await latencia(320)
  const t = tarefasProjeto.get(projetoId)?.find((x) => x.id === tarefaId)
  if (t) t.responsavel = pessoa
}

// ── Alocação: capacidade é recurso finito ────────────────────────────────────

const CAPACIDADE_DIARIA = 6 // 6h úteis por dia para projeto; o resto é reunião e imprevisto

/**
 * Capacidade da pessoa no período do projeto × horas alocadas a ela.
 * Alocar acima da capacidade não é otimismo: é atraso já contratado, e ele só
 * aparece quando a data chega.
 */
export async function capacidadeEquipe(projetoId: number): Promise<CapacidadePessoa[]> {
  await latencia(360)
  garantirEstrutura(projetoId)
  const projeto = projetos.find((p) => p.id === projetoId)
  const lista = tarefasProjeto.get(projetoId) ?? []

  const dias = projeto ? Math.max(Math.ceil((+new Date(projeto.prazo) - +new Date(projeto.inicio)) / 86400000), 1) : 30
  const diasUteis = Math.round(dias * (5 / 7))

  const mapa = new Map<string, number>()
  lista.filter((t) => !t.concluida).forEach((t) => {
    const pessoa = t.responsavel ?? '— sem responsável'
    mapa.set(pessoa, (mapa.get(pessoa) ?? 0) + t.horasEstimadas)
  })

  return [...mapa.entries()]
    .map(([pessoa, horasAlocadas]) => ({
      pessoa,
      capacidadeDiaria: CAPACIDADE_DIARIA,
      horasAlocadas,
      diasUteisNoPeriodo: diasUteis,
      capacidadeTotal: diasUteis * CAPACIDADE_DIARIA,
    }))
    .sort((a, b) => b.horasAlocadas / b.capacidadeTotal - a.horasAlocadas / a.capacidadeTotal)
}

export const ocupacao = (c: CapacidadePessoa) => (c.capacidadeTotal > 0 ? c.horasAlocadas / c.capacidadeTotal : 0)

// ── Criação de projeto ───────────────────────────────────────────────────────

export async function criarProjeto(dados: NovoProjeto): Promise<Projeto> {
  await latencia(720)
  if (dados.nome.trim().length < 3) throw new Error('Dê um nome ao projeto.')
  if (new Date(dados.prazo) <= new Date(dados.inicio)) throw new Error('O prazo precisa ser depois do início.')
  if (!(dados.horasOrcadas > 0)) throw new Error('Informe as horas orçadas.')

  const projeto: Projeto = {
    id: proximoId++,
    codigo: `PRJ-${String(proximoId).padStart(3, '0')}`,
    nome: dados.nome,
    cliente: dados.cliente,
    clienteId: dados.clienteId,
    responsavel: dados.responsavel,
    situacao: 'planejado',
    inicio: dados.inicio,
    prazo: dados.prazo,
    prazoBaseline: dados.prazo,
    horasOrcadas: dados.horasOrcadas,
    horasBaseline: dados.horasOrcadas,
    valorContrato: dados.valorContrato,
    custoHora: dados.custoHora,
    despesas: 0,
  }
  projetos.unshift(projeto)
  // Projeto novo nasce com a estrutura vazia — as fases são do plano, não do molde.
  fases.set(projeto.id, [])
  tarefasProjeto.set(projeto.id, [])
  marcos.set(projeto.id, [])
  apontamentos.set(projeto.id, [])
  riscos.set(projeto.id, [])
  return projeto
}

export const equipeDisponivel = [...EQUIPE]
