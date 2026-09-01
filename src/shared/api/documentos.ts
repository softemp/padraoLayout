import { clientes } from './mock-db'
import { contratos } from './contratos'
import type {
  CompartilhamentoDocumento, Confidencialidade, Documento, ListParams, ListResponse,
  TipoDocumento, TotaisDocumentos, VersaoDocumento, VinculoDocumento,
} from './types'

/** Gestão de documentos — dados fictícios com as regras do domínio ligadas. */
const latencia = (ms = 380) => new Promise((r) => setTimeout(r, ms + Math.random() * 200))

function prng(seed: number) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
}
const rnd = prng(20260904)
const entre = (min: number, max: number) => Math.round(min + rnd() * (max - min))
const escolher = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]
const somarDias = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString() }
const hashFalso = () => Array.from({ length: 8 }, () => Math.floor(rnd() * 16).toString(16)).join('')

const TIPOS: TipoDocumento[] = ['contrato', 'aditivo', 'nota_fiscal', 'certidao', 'procuracao', 'identidade', 'comprovante', 'apolice', 'outro']
const AUTORES = ['Paulo Roberto', 'Camila Bonfim', 'Rafael Quintana', 'Ana Beatriz'] as const
const TAGS = ['jurídico', 'fiscal', 'financeiro', 'rh', 'comercial', 'operação'] as const

/** Só estes vencem: os demais são fato consumado e não têm validade. */
const TIPOS_COM_VALIDADE: TipoDocumento[] = ['certidao', 'procuracao', 'identidade', 'apolice']

const ativos = clientes.filter((c) => c.excluidoEm === null)

function vinculoAleatorio(i: number): VinculoDocumento {
  const sorteio = rnd()
  if (sorteio > 0.94) return { tipo: 'empresa', id: null, rotulo: 'SoftEmp Tecnologia e Sistemas Ltda' }
  if (sorteio > 0.62) {
    const contrato = contratos[i % contratos.length]
    return { tipo: 'contrato', id: contrato.id, rotulo: `${contrato.numero} · ${contrato.cliente}` }
  }
  const cliente = ativos[i % ativos.length]
  return { tipo: 'cliente', id: cliente.id, rotulo: cliente.nome }
}

const nomePorTipo: Record<TipoDocumento, string> = {
  contrato: 'Contrato assinado',
  aditivo: 'Aditivo contratual',
  nota_fiscal: 'Nota fiscal de serviço',
  certidao: 'Certidão negativa de débitos',
  procuracao: 'Procuração',
  identidade: 'Documento de identificação',
  comprovante: 'Comprovante de pagamento',
  apolice: 'Apólice de seguro',
  outro: 'Documento diverso',
}

export const documentos: Documento[] = Array.from({ length: 78 }, (_, i) => {
  const tipo = escolher(TIPOS)
  const vence = TIPOS_COM_VALIDADE.includes(tipo)
  const confidencialidade: Confidencialidade =
    tipo === 'identidade' || tipo === 'procuracao' ? 'confidencial' : rnd() > 0.7 ? 'restrito' : 'interno'

  return {
    id: i + 1,
    nome: `${nomePorTipo[tipo]} ${String(i + 1).padStart(3, '0')}`,
    tipo,
    vinculo: vinculoAleatorio(i),
    confidencialidade,
    tags: [escolher(TAGS), ...(rnd() > 0.6 ? [escolher(TAGS)] : [])].filter((v, idx, arr) => arr.indexOf(v) === idx),
    versaoAtual: rnd() > 0.7 ? entre(2, 4) : 1,
    extensao: escolher(['pdf', 'pdf', 'pdf', 'docx', 'xlsx', 'png'] as const),
    tamanhoBytes: entre(80_000, 8_400_000),
    enviadoPor: escolher(AUTORES),
    enviadoEm: somarDias(-entre(1, 600)),
    validade: vence ? somarDias(entre(-90, 420)) : null,
    arquivadoEm: null,
  }
})

// ── Derivados (nada gravado) ─────────────────────────────────────────────────

export const diasParaVencer = (d: Documento) =>
  d.validade ? Math.ceil((+new Date(d.validade) - Date.now()) / 86400000) : null

export const estaVencido = (d: Documento) => {
  const dias = diasParaVencer(d)
  return dias !== null && dias < 0 && !d.arquivadoEm
}

/**
 * Vencendo = dentro da janela de renovação. A janela é o prazo de DECISÃO:
 * tirar certidão nova leva dias, então avisar no vencimento é avisar tarde.
 */
export const JANELA_RENOVACAO_DIAS = 45
export const estaVencendo = (d: Documento) => {
  const dias = diasParaVencer(d)
  return dias !== null && dias >= 0 && dias <= JANELA_RENOVACAO_DIAS && !d.arquivadoEm
}

export const semVinculo = (d: Documento) => d.vinculo.id === null && d.vinculo.tipo !== 'empresa'

export async function listarDocumentos(params: ListParams): Promise<ListResponse<Documento>> {
  await latencia()
  const { page, perPage, sortBy, sortDir, search, filters, escopo = 'ativos' } = params

  let linhas = documentos.filter((d) => (escopo === 'lixeira' ? d.arquivadoEm !== null : d.arquivadoEm === null))

  if (search?.trim()) {
    const q = search.trim().toLowerCase()
    linhas = linhas.filter(
      (d) => d.nome.toLowerCase().includes(q) || d.vinculo.rotulo.toLowerCase().includes(q) || d.tags.some((t) => t.includes(q)),
    )
  }
  if (filters?.tipo) linhas = linhas.filter((d) => d.tipo === filters.tipo)
  if (filters?.confidencialidade) linhas = linhas.filter((d) => d.confidencialidade === filters.confidencialidade)
  if (filters?.validade === 'vencendo') linhas = linhas.filter(estaVencendo)
  if (filters?.validade === 'vencido') linhas = linhas.filter(estaVencido)
  if (filters?.validade === 'sem_validade') linhas = linhas.filter((d) => d.validade === null)

  const dir = sortDir === 'asc' ? 1 : -1
  linhas.sort((a, b) => {
    const va = a[sortBy as keyof Documento]
    const vb = b[sortBy as keyof Documento]
    if (va === vb) return a.id - b.id
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va).localeCompare(String(vb), 'pt-BR') * dir
  })

  const total = linhas.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const pagina = Math.min(page, totalPages)
  return { data: linhas.slice((pagina - 1) * perPage, pagina * perPage), meta: { total, totalPages, page: pagina, perPage } }
}

export async function totaisDocumentos(): Promise<TotaisDocumentos> {
  await latencia(240)
  const vivos = documentos.filter((d) => !d.arquivadoEm)
  return {
    total: vivos.length,
    vencendo: vivos.filter(estaVencendo).length,
    vencidos: vivos.filter(estaVencido).length,
    semVinculo: vivos.filter(semVinculo).length,
    espacoBytes: vivos.reduce((s, d) => s + d.tamanhoBytes, 0),
  }
}

export async function obterDocumento(id: number): Promise<Documento> {
  await latencia(260)
  const doc = documentos.find((d) => d.id === id)
  if (!doc) throw new Error('Documento não encontrado.')
  return { ...doc }
}

// ── Versões: o arquivo nunca é substituído ───────────────────────────────────

const versoes = new Map<number, VersaoDocumento[]>()
let proximaVersao = 1

function garantirVersoes(documentoId: number): VersaoDocumento[] {
  const existente = versoes.get(documentoId)
  if (existente) return existente
  const doc = documentos.find((d) => d.id === documentoId)
  const lista: VersaoDocumento[] = []
  if (doc) {
    for (let n = doc.versaoAtual; n >= 1; n--) {
      lista.push({
        id: proximaVersao++,
        documentoId,
        numero: n,
        nome: `${doc.nome} (v${n}).${doc.extensao}`,
        tamanhoBytes: doc.tamanhoBytes - (doc.versaoAtual - n) * entre(1_000, 40_000),
        enviadoPor: escolher(AUTORES),
        enviadoEm: somarDias(-entre(1, 500) - (doc.versaoAtual - n) * 60),
        motivo: n === 1 ? 'Envio inicial' : escolher(['Correção de dados', 'Documento reemitido', 'Nova assinatura', 'Atualização de validade'] as const),
        hash: hashFalso(),
        vigente: n === doc.versaoAtual,
      })
    }
  }
  versoes.set(documentoId, lista)
  return lista
}

export async function listarVersoes(documentoId: number): Promise<VersaoDocumento[]> {
  await latencia(300)
  return garantirVersoes(documentoId)
}

/**
 * Nova versão NUNCA sobrescreve a anterior: ela entra no topo e passa a ser a
 * vigente. A versão antiga continua baixável — é ela que prova o que estava
 * valendo na data em que alguém decidiu com base nela.
 */
export async function enviarNovaVersao(documentoId: number, motivo: string, novaValidade?: string): Promise<VersaoDocumento> {
  await latencia(760)
  const doc = documentos.find((d) => d.id === documentoId)
  if (!doc) throw new Error('Documento não encontrado.')
  if (doc.arquivadoEm) throw new Error('Documento arquivado não recebe nova versão — restaure antes.')
  if (motivo.trim().length < 5) throw new Error('Descreva o motivo da nova versão.')

  const lista = garantirVersoes(documentoId)
  lista.forEach((v) => (v.vigente = false))
  const versao: VersaoDocumento = {
    id: proximaVersao++,
    documentoId,
    numero: doc.versaoAtual + 1,
    nome: `${doc.nome} (v${doc.versaoAtual + 1}).${doc.extensao}`,
    tamanhoBytes: doc.tamanhoBytes + entre(-30_000, 60_000),
    enviadoPor: 'Paulo Roberto',
    enviadoEm: new Date().toISOString(),
    motivo,
    hash: hashFalso(),
    vigente: true,
  }
  lista.unshift(versao)
  doc.versaoAtual = versao.numero
  doc.enviadoEm = versao.enviadoEm
  doc.enviadoPor = versao.enviadoPor
  if (novaValidade) doc.validade = novaValidade
  return versao
}

// ── Compartilhamento com prazo ───────────────────────────────────────────────

const compartilhamentos = new Map<number, CompartilhamentoDocumento[]>()
let proximoLink = 1

export async function listarCompartilhamentos(documentoId: number): Promise<CompartilhamentoDocumento[]> {
  await latencia(280)
  return compartilhamentos.get(documentoId) ?? []
}

/**
 * Link de acesso externo nasce com PRAZO e é revogável. Link eterno vira a
 * porta dos fundos do sistema: quem tem a URL entra para sempre, sem passar
 * por login nem por permissão.
 */
export async function criarCompartilhamento(documentoId: number, destinatario: string, dias: number): Promise<CompartilhamentoDocumento> {
  await latencia(620)
  if (!destinatario.includes('@')) throw new Error('Informe um e-mail válido.')
  if (dias < 1 || dias > 30) throw new Error('O prazo precisa ficar entre 1 e 30 dias.')

  const link: CompartilhamentoDocumento = {
    id: proximoLink++,
    documentoId,
    destinatario,
    criadoEm: new Date().toISOString(),
    expiraEm: somarDias(dias),
    revogadoEm: null,
    acessos: 0,
    criadoPor: 'Paulo Roberto',
  }
  const lista = compartilhamentos.get(documentoId) ?? []
  lista.unshift(link)
  compartilhamentos.set(documentoId, lista)
  return link
}

export async function revogarCompartilhamento(documentoId: number, linkId: number): Promise<void> {
  await latencia(420)
  const link = compartilhamentos.get(documentoId)?.find((l) => l.id === linkId)
  if (!link) throw new Error('Link não encontrado.')
  link.revogadoEm = new Date().toISOString()
}

export const linkExpirado = (l: CompartilhamentoDocumento) =>
  !!l.revogadoEm || new Date(l.expiraEm) < new Date()

// ── Arquivamento (exclusão lógica) ───────────────────────────────────────────

export async function arquivarDocumento(id: number): Promise<void> {
  await latencia(420)
  const doc = documentos.find((d) => d.id === id)
  if (!doc) throw new Error('Documento não encontrado.')
  doc.arquivadoEm = new Date().toISOString()
}

export async function restaurarDocumento(id: number): Promise<void> {
  await latencia(420)
  const doc = documentos.find((d) => d.id === id)
  if (!doc) throw new Error('Documento não encontrado.')
  doc.arquivadoEm = null
}

export const formatarTamanho = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}
