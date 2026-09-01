import { clientes } from './mock-db'
import type {
  Aditivo, AssinaturaContrato, Contrato, EventoContrato, IndiceReajuste, ListParams,
  ListResponse, StatusContrato, TotaisContratos,
} from './types'

/** Gestão de contratos — dados fictícios com as regras do domínio ligadas. */
const latencia = (ms = 380) => new Promise((r) => setTimeout(r, ms + Math.random() * 200))

function prng(seed: number) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
}
const rnd = prng(20260903)
const entre = (min: number, max: number) => Math.round(min + rnd() * (max - min))
const escolher = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]
const somarDias = (base: Date, d: number) => { const x = new Date(base); x.setDate(x.getDate() + d); return x }

const OBJETOS = [
  'Licença de uso da plataforma',
  'Licença + suporte dedicado',
  'Implantação e treinamento',
  'Sustentação mensal',
  'Consultoria recorrente',
  'Integração com ERP',
] as const
const GESTORES = ['Camila Bonfim', 'Rafael Quintana', 'Ana Beatriz', 'Paulo Roberto'] as const
const INDICES: IndiceReajuste[] = ['IPCA', 'IGP-M', 'INPC', 'sem_reajuste']

const ativos = clientes.filter((c) => c.excluidoEm === null)

export const contratos: Contrato[] = Array.from({ length: 64 }, (_, i) => {
  const cliente = ativos[i % ativos.length]
  const inicio = somarDias(new Date(), -entre(30, 1000))
  const meses = escolher([12, 12, 24, 36] as const)
  const fim = new Date(inicio)
  fim.setMonth(fim.getMonth() + meses)

  const sorteio = rnd()
  const status: StatusContrato =
    sorteio > 0.9 ? 'em_assinatura'
      : sorteio > 0.86 ? 'rascunho'
      : sorteio > 0.8 ? 'encerrado'
      : sorteio > 0.76 ? 'rescindido'
      : 'vigente'

  return {
    id: i + 1,
    numero: `CT-${new Date(inicio).getFullYear()}-${String(i + 1).padStart(3, '0')}`,
    clienteId: cliente.id,
    cliente: cliente.nome,
    objeto: escolher(OBJETOS),
    valorMensal: cliente.mrr || entre(700, 9800),
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    status,
    renovacaoAutomatica: rnd() > 0.35,
    avisoPrevioDias: escolher([30, 30, 60, 90] as const),
    indice: escolher(INDICES),
    dataBaseReajuste: inicio.toISOString(),
    ultimoReajusteEm: rnd() > 0.5 ? somarDias(new Date(), -entre(30, 400)).toISOString() : null,
    gestor: escolher(GESTORES),
  }
})

// ── Derivações (nada disso é status gravado) ─────────────────────────────────

export const diasParaVencer = (c: Contrato) =>
  Math.ceil((+new Date(c.fim) - Date.now()) / 86400000)

/** Vencendo = vigente e dentro da janela de aviso prévio. */
export const estaVencendo = (c: Contrato) => {
  const dias = diasParaVencer(c)
  return c.status === 'vigente' && dias >= 0 && dias <= c.avisoPrevioDias
}

/**
 * O aviso precisa nascer ANTES do prazo de denúncia: se são 60 dias de aviso
 * prévio e o alerta aparece com 30, a renovação automática já aconteceu na
 * prática — e o contrato virou mais um ano.
 */
export const prazoDeAvisoPerdido = (c: Contrato) =>
  c.status === 'vigente' && c.renovacaoAutomatica && diasParaVencer(c) >= 0 && diasParaVencer(c) < c.avisoPrevioDias

/** Reajuste devido: passou um ano da data-base (ou do último reajuste). */
export const reajusteDevido = (c: Contrato) => {
  if (c.indice === 'sem_reajuste' || c.status !== 'vigente') return false
  const base = new Date(c.ultimoReajusteEm ?? c.dataBaseReajuste)
  const aniversario = new Date(base)
  aniversario.setFullYear(aniversario.getFullYear() + 1)
  return aniversario <= new Date()
}

export async function listarContratos(params: ListParams): Promise<ListResponse<Contrato>> {
  await latencia()
  const { page, perPage, sortBy, sortDir, search, filters } = params
  let linhas = [...contratos]

  if (search?.trim()) {
    const q = search.trim().toLowerCase()
    linhas = linhas.filter((c) => c.numero.toLowerCase().includes(q) || c.cliente.toLowerCase().includes(q) || c.objeto.toLowerCase().includes(q))
  }
  if (filters?.status) {
    // "vencendo" e "reajuste" são filtros DERIVADOS, não estados gravados.
    linhas =
      filters.status === 'vencendo' ? linhas.filter(estaVencendo)
        : filters.status === 'reajuste' ? linhas.filter(reajusteDevido)
        : linhas.filter((c) => c.status === filters.status)
  }
  if (filters?.gestor) linhas = linhas.filter((c) => c.gestor === filters.gestor)
  if (filters?.indice) linhas = linhas.filter((c) => c.indice === filters.indice)

  const dir = sortDir === 'asc' ? 1 : -1
  linhas.sort((a, b) => {
    const va = a[sortBy as keyof Contrato]
    const vb = b[sortBy as keyof Contrato]
    if (va === vb) return a.id - b.id
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va).localeCompare(String(vb), 'pt-BR') * dir
  })

  const total = linhas.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const pagina = Math.min(page, totalPages)
  return { data: linhas.slice((pagina - 1) * perPage, pagina * perPage), meta: { total, totalPages, page: pagina, perPage } }
}

export async function totaisContratos(): Promise<TotaisContratos> {
  await latencia(260)
  const vigentes = contratos.filter((c) => c.status === 'vigente')
  return {
    vigentes: vigentes.length,
    receitaMensal: vigentes.reduce((s, c) => s + c.valorMensal, 0),
    vencendo: contratos.filter(estaVencendo).length,
    semAssinatura: contratos.filter((c) => c.status === 'em_assinatura').length,
    reajustePendente: contratos.filter(reajusteDevido).length,
  }
}

export async function obterContrato(id: number): Promise<Contrato> {
  await latencia(280)
  const contrato = contratos.find((c) => c.id === id)
  if (!contrato) throw new Error('Contrato não encontrado.')
  return { ...contrato }
}

// ── Aditivos: o contrato vigente não se edita ────────────────────────────────

const aditivos = new Map<number, Aditivo[]>()
let proximoAditivo = 1

function garantirAditivos(contratoId: number): Aditivo[] {
  const existente = aditivos.get(contratoId)
  if (existente) return existente
  const contrato = contratos.find((c) => c.id === contratoId)
  const lista: Aditivo[] = []
  if (contrato && contrato.ultimoReajusteEm) {
    lista.push({
      id: proximoAditivo++,
      contratoId,
      numero: `${contrato.numero}-A1`,
      tipo: 'reajuste',
      criadoEm: contrato.ultimoReajusteEm,
      vigenciaEm: contrato.ultimoReajusteEm,
      descricao: `Reajuste anual pelo ${contrato.indice}`,
      valorAnterior: Math.round(contrato.valorMensal / 1.045),
      valorNovo: contrato.valorMensal,
      fimAnterior: null,
      fimNovo: null,
      autor: contrato.gestor,
    })
  }
  aditivos.set(contratoId, lista)
  return lista
}

export async function listarAditivos(contratoId: number): Promise<Aditivo[]> {
  await latencia(300)
  return garantirAditivos(contratoId)
}

export type NovoAditivo = {
  tipo: Aditivo['tipo']
  vigenciaEm: string
  descricao: string
  valorNovo?: number
  fimNovo?: string
}

/**
 * ÚNICO caminho para mudar um contrato vigente. O contrato não é sobrescrito
 * "no lugar": o aditivo guarda o antes e o depois, e é ele que explica por que
 * o valor de hoje é diferente do assinado.
 */
export async function criarAditivo(contratoId: number, dados: NovoAditivo): Promise<Aditivo> {
  await latencia(620)
  const contrato = contratos.find((c) => c.id === contratoId)
  if (!contrato) throw new Error('Contrato não encontrado.')
  if (contrato.status === 'rascunho') throw new Error('Rascunho ainda pode ser editado direto — aditivo é para contrato assinado.')
  if (contrato.status === 'encerrado' || contrato.status === 'rescindido') {
    throw new Error('Contrato encerrado não recebe aditivo.')
  }

  const lista = garantirAditivos(contratoId)
  const aditivo: Aditivo = {
    id: proximoAditivo++,
    contratoId,
    numero: `${contrato.numero}-A${lista.length + 1}`,
    tipo: dados.tipo,
    criadoEm: new Date().toISOString(),
    vigenciaEm: dados.vigenciaEm,
    descricao: dados.descricao,
    valorAnterior: dados.valorNovo != null ? contrato.valorMensal : null,
    valorNovo: dados.valorNovo ?? null,
    fimAnterior: dados.fimNovo ? contrato.fim : null,
    fimNovo: dados.fimNovo ?? null,
    autor: 'Paulo Roberto',
  }

  // O contrato passa a valer com o que o aditivo definiu.
  if (dados.valorNovo != null) contrato.valorMensal = dados.valorNovo
  if (dados.fimNovo) contrato.fim = dados.fimNovo
  if (dados.tipo === 'reajuste') contrato.ultimoReajusteEm = dados.vigenciaEm
  if (dados.tipo === 'rescisao') contrato.status = 'rescindido'

  lista.unshift(aditivo)
  registrarEvento(contratoId, `criou o aditivo ${aditivo.numero}`, dados.descricao)
  return aditivo
}

// ── Assinaturas ──────────────────────────────────────────────────────────────

const assinaturas = new Map<number, AssinaturaContrato[]>()
let proximaAssinatura = 1

export async function listarAssinaturas(contratoId: number): Promise<AssinaturaContrato[]> {
  await latencia(280)
  const existente = assinaturas.get(contratoId)
  if (existente) return existente.map((a) => ({ ...a }))

  const contrato = contratos.find((c) => c.id === contratoId)
  const assinado = contrato?.status === 'vigente' || contrato?.status === 'encerrado'
  const lista: AssinaturaContrato[] = [
    { id: proximaAssinatura++, contratoId, parte: contrato?.cliente ?? '', papel: 'contratante', email: 'contato@cliente.com.br', assinadoEm: assinado ? contrato!.inicio : null, meio: assinado ? 'digital' : null },
    { id: proximaAssinatura++, contratoId, parte: 'SoftEmp Tecnologia e Sistemas Ltda', papel: 'contratada', email: 'contratos@softemp.com.br', assinadoEm: assinado ? contrato!.inicio : null, meio: assinado ? 'digital' : null },
    { id: proximaAssinatura++, contratoId, parte: 'Camila Bonfim', papel: 'testemunha', email: 'camila@softemp.com.br', assinadoEm: assinado ? contrato!.inicio : null, meio: assinado ? 'digital' : null },
  ]
  assinaturas.set(contratoId, lista)
  return lista.map((a) => ({ ...a }))
}

export async function registrarAssinatura(contratoId: number, assinaturaId: number): Promise<void> {
  await latencia(520)
  const lista = assinaturas.get(contratoId)
  const alvo = lista?.find((a) => a.id === assinaturaId)
  if (!alvo) throw new Error('Assinatura não encontrada.')
  alvo.assinadoEm = new Date().toISOString()
  alvo.meio = 'digital'

  // O contrato só passa a vigorar quando TODAS as partes assinaram.
  const contrato = contratos.find((c) => c.id === contratoId)
  if (contrato && lista!.every((a) => a.assinadoEm)) {
    contrato.status = 'vigente'
    registrarEvento(contratoId, 'contrato passou a vigorar', 'Todas as partes assinaram')
  }
  registrarEvento(contratoId, `registrou a assinatura de ${alvo.parte}`, alvo.papel)
}

// ── Histórico ────────────────────────────────────────────────────────────────

const historico = new Map<number, EventoContrato[]>()
let proximoEvento = 1

function registrarEvento(contratoId: number, acao: string, detalhe: string) {
  const lista = historico.get(contratoId) ?? []
  lista.unshift({ id: proximoEvento++, contratoId, criadoEm: new Date().toISOString(), autor: 'Paulo Roberto', acao, detalhe })
  historico.set(contratoId, lista)
}

export async function listarHistorico(contratoId: number): Promise<EventoContrato[]> {
  await latencia(260)
  const existente = historico.get(contratoId)
  if (existente) return existente
  const contrato = contratos.find((c) => c.id === contratoId)
  const lista: EventoContrato[] = contrato
    ? [{ id: proximoEvento++, contratoId, criadoEm: contrato.inicio, autor: contrato.gestor, acao: 'cadastrou o contrato', detalhe: contrato.objeto }]
    : []
  historico.set(contratoId, lista)
  return lista
}

export const gestores = [...GESTORES]
