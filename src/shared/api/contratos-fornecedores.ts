import { pedidos } from './compras'
import { itens as itensEstoque } from './estoque'
import type {
  CertidaoFornecedor, ContratoFornecedor, DesvioPreco, IndiceReajuste, ItemContratado, ListParams,
  ListResponse, SituacaoContratoFornecedor, TipoContratoFornecedor, TotaisContratosFornecedor,
} from './types'

/**
 * Contratos de FORNECEDOR. A forma é a mesma do contrato de cliente (vigência,
 * aditivo, aviso prévio, reajuste) — o que muda é o risco: aqui o dinheiro
 * SAI, e três coisas vazam dinheiro em silêncio:
 *   1. renovação automática de contrato que ninguém usa mais;
 *   2. nota cobrada acima do preço acordado;
 *   3. pagamento a fornecedor com certidão vencida.
 */
const latencia = (ms = 360) => new Promise((r) => setTimeout(r, ms + Math.random() * 200))

function prng(seed: number) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
}
const rnd = prng(20260912)
const entre = (min: number, max: number) => Math.round(min + rnd() * (max - min))
const escolher = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]
const somarDias = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString() }

const FORNECEDORES = [
  'Nortesul Distribuidora', 'Atlas Suprimentos', 'TecnoParts', 'Import Ltda',
  'CloudHost Brasil', 'Contabilidade Nunes', 'Telecom Sul', 'Segurança Patrimonial SC',
] as const
const OBJETOS: Record<TipoContratoFornecedor, string[]> = {
  assinatura: ['Licenças de software', 'Hospedagem em nuvem', 'Ferramenta de BI', 'Antivírus corporativo'],
  fornecimento: ['Fornecimento de periféricos', 'Insumos de embalagem', 'Peças de reposição'],
  servico: ['Serviços contábeis', 'Assessoria jurídica', 'Limpeza e conservação'],
  locacao: ['Locação de impressoras', 'Locação da sede', 'Frota de veículos'],
  manutencao: ['Manutenção predial', 'Suporte de rede', 'Manutenção de ar-condicionado'],
}
const INDICES: IndiceReajuste[] = ['IPCA', 'IGP-M', 'INPC', 'sem_reajuste']

let seqId = 1, seqItem = 1, seqCert = 1

function itensDoContrato(tipo: TipoContratoFornecedor): ItemContratado[] {
  if (tipo !== 'fornecimento') return []
  return Array.from({ length: entre(2, 5) }, () => {
    const item = itensEstoque[Math.floor(rnd() * itensEstoque.length)]
    return {
      id: seqItem++,
      sku: item.sku,
      descricao: item.nome,
      // Preço de tabela do contrato: fica COPIADO aqui e é a régua da nota.
      precoContratado: Number((item.custoMedio * (0.88 + rnd() * 0.12)).toFixed(2)),
      unidade: item.unidade,
    }
  })
}

function certidoes(): CertidaoFornecedor[] {
  return (['CND federal', 'FGTS', 'Trabalhista'] as const).map((tipo) => ({
    id: seqCert++,
    tipo,
    validade: somarDias(entre(-60, 240)),
  }))
}

export const contratosFornecedor: ContratoFornecedor[] = Array.from({ length: 34 }, (_, i) => {
  const tipo = escolher(['assinatura', 'assinatura', 'fornecimento', 'servico', 'locacao', 'manutencao'] as const)
  const inicio = somarDias(-entre(60, 900))
  const fim = somarDias(entre(-40, 400))
  const sorteio = rnd()
  const situacao: SituacaoContratoFornecedor =
    sorteio > 0.9 ? 'em_negociacao' : sorteio > 0.84 ? 'encerrado' : sorteio > 0.79 ? 'rescindido' : 'vigente'

  return {
    id: seqId++,
    numero: `CF-${new Date(inicio).getFullYear()}-${String(i + 1).padStart(3, '0')}`,
    fornecedor: escolher(FORNECEDORES),
    objeto: escolher(OBJETOS[tipo]),
    tipo,
    situacao,
    custoMensal: tipo === 'fornecimento' ? 0 : entre(28_000, 1_800_000) / 100,
    inicio,
    fim,
    renovacaoAutomatica: tipo === 'assinatura' ? rnd() > 0.15 : rnd() > 0.55,
    avisoPrevioDias: escolher([30, 30, 60, 90] as const),
    indice: escolher(INDICES),
    ultimoReajusteEm: rnd() > 0.5 ? somarDias(-entre(30, 400)) : null,
    gestor: escolher(['Paulo Roberto', 'Camila Bonfim', 'Rafael Quintana'] as const),
    slaEntregaDias: entre(2, 20),
    itens: itensDoContrato(tipo),
    certidoes: certidoes(),
    criticidade: escolher(['baixa', 'media', 'alta', 'media'] as const),
    observacao: '',
  }
})

// ── Derivados: os três vazamentos ────────────────────────────────────────────

export const diasParaVencer = (c: ContratoFornecedor) =>
  Math.ceil((+new Date(c.fim) - Date.now()) / 86400000)

export const naJanelaDeAviso = (c: ContratoFornecedor) => {
  const dias = diasParaVencer(c)
  return c.situacao === 'vigente' && dias >= 0 && dias <= c.avisoPrevioDias
}

/**
 * O vazamento nº 1: renovação automática cujo prazo de aviso passou. A partir
 * daqui, não renovar deixou de ser opção — e o custo do próximo ciclo já está
 * contratado.
 */
export const renovouSemDecisao = (c: ContratoFornecedor) =>
  c.situacao === 'vigente' && c.renovacaoAutomatica && diasParaVencer(c) >= 0 && diasParaVencer(c) < c.avisoPrevioDias

export const custoAnual = (c: ContratoFornecedor) => c.custoMensal * 12

export const certidoesVencidas = (c: ContratoFornecedor) =>
  c.certidoes.filter((cert) => new Date(cert.validade) < new Date())

/** Vazamento nº 3: pagar fornecedor irregular é assumir a dívida dele. */
export const temCertidaoVencida = (c: ContratoFornecedor) =>
  c.situacao === 'vigente' && certidoesVencidas(c).length > 0

export const reajusteDevido = (c: ContratoFornecedor) => {
  if (c.indice === 'sem_reajuste' || c.situacao !== 'vigente') return false
  const base = new Date(c.ultimoReajusteEm ?? c.inicio)
  const aniversario = new Date(base)
  aniversario.setFullYear(aniversario.getFullYear() + 1)
  return aniversario <= new Date()
}

/**
 * Vazamento nº 2: preço da compra acima do contratado. Sem esse confronto, o
 * contrato vira um PDF na gaveta — o preço acordado só vale se alguém compara.
 */
export function desviosDePreco(contratoId: number): DesvioPreco[] {
  const contrato = contratosFornecedor.find((c) => c.id === contratoId)
  if (!contrato || contrato.itens.length === 0) return []

  const desvios: DesvioPreco[] = []
  pedidos
    .filter((p) => p.fornecedor === contrato.fornecedor && !['rascunho', 'cancelado'].includes(p.situacao))
    .forEach((pedido) => {
      pedido.itens.forEach((item) => {
        const contratado = contrato.itens.find((ic) => ic.sku === item.sku)
        if (!contratado) return
        if (item.precoUnitario > contratado.precoContratado + 0.009) {
          desvios.push({
            pedido: pedido.numero,
            data: pedido.criadoEm,
            sku: item.sku,
            descricao: item.nome,
            precoContratado: contratado.precoContratado,
            precoPraticado: item.precoUnitario,
            quantidade: item.quantidade,
          })
        }
      })
    })
  return desvios.sort((a, b) => (b.precoPraticado - b.precoContratado) * b.quantidade - (a.precoPraticado - a.precoContratado) * a.quantidade)
}

export const perdaPorDesvio = (d: DesvioPreco) => (d.precoPraticado - d.precoContratado) * d.quantidade

/** Desempenho real do fornecedor: prazo prometido × pedidos atrasados. */
export function desempenhoFornecedor(fornecedor: string) {
  const doFornecedor = pedidos.filter((p) => p.fornecedor === fornecedor && !['rascunho', 'cancelado'].includes(p.situacao))
  const atrasados = doFornecedor.filter((p) => ['aprovado', 'enviado', 'recebido_parcial'].includes(p.situacao) && new Date(p.previsaoEntrega) < new Date())
  return {
    pedidos: doFornecedor.length,
    atrasados: atrasados.length,
    pontualidade: doFornecedor.length ? 1 - atrasados.length / doFornecedor.length : 1,
  }
}

export async function listarContratosFornecedor(params: ListParams): Promise<ListResponse<ContratoFornecedor>> {
  await latencia()
  const { page, perPage, sortBy, sortDir, search, filters } = params
  let linhas = [...contratosFornecedor]

  if (search?.trim()) {
    const q = search.trim().toLowerCase()
    linhas = linhas.filter((c) => c.numero.toLowerCase().includes(q) || c.fornecedor.toLowerCase().includes(q) || c.objeto.toLowerCase().includes(q))
  }
  if (filters?.situacao === 'renova_sozinho') linhas = linhas.filter((c) => c.situacao === 'vigente' && c.renovacaoAutomatica)
  else if (filters?.situacao === 'aviso') linhas = linhas.filter(naJanelaDeAviso)
  else if (filters?.situacao === 'certidao') linhas = linhas.filter(temCertidaoVencida)
  else if (filters?.situacao === 'reajuste') linhas = linhas.filter(reajusteDevido)
  else if (filters?.situacao) linhas = linhas.filter((c) => c.situacao === filters.situacao)
  if (filters?.tipo) linhas = linhas.filter((c) => c.tipo === filters.tipo)
  if (filters?.fornecedor) linhas = linhas.filter((c) => c.fornecedor === filters.fornecedor)

  const dir = sortDir === 'asc' ? 1 : -1
  linhas.sort((a, b) => {
    if (sortBy === 'custoMensal') return (a.custoMensal - b.custoMensal) * dir
    const va = a[sortBy as keyof ContratoFornecedor]
    const vb = b[sortBy as keyof ContratoFornecedor]
    if (va === vb) return a.id - b.id
    return String(va).localeCompare(String(vb), 'pt-BR') * dir
  })

  const total = linhas.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const pagina = Math.min(page, totalPages)
  return { data: linhas.slice((pagina - 1) * perPage, pagina * perPage), meta: { total, totalPages, page: pagina, perPage } }
}

export async function totaisContratosFornecedor(): Promise<TotaisContratosFornecedor> {
  await latencia(280)
  const vigentes = contratosFornecedor.filter((c) => c.situacao === 'vigente')
  const automaticos = vigentes.filter((c) => c.renovacaoAutomatica)
  return {
    vigentes: vigentes.length,
    custoMensal: vigentes.reduce((s, c) => s + c.custoMensal, 0),
    renovamSozinhos: automaticos.length,
    custoRenovacaoAutomatica: automaticos.reduce((s, c) => s + custoAnual(c), 0),
    emJanelaDeAviso: contratosFornecedor.filter(naJanelaDeAviso).length,
    certidaoVencida: vigentes.filter(temCertidaoVencida).length,
    comDesvioDePreco: vigentes.filter((c) => desviosDePreco(c.id).length > 0).length,
  }
}

export async function obterContratoFornecedor(id: number): Promise<ContratoFornecedor> {
  await latencia(260)
  const c = contratosFornecedor.find((x) => x.id === id)
  if (!c) throw new Error('Contrato não encontrado.')
  return { ...c }
}

/** Marcar "não renovar" só vale ANTES do prazo de aviso — depois é constatação. */
export async function marcarNaoRenovar(id: number, motivo: string): Promise<void> {
  await latencia(520)
  const contrato = contratosFornecedor.find((c) => c.id === id)
  if (!contrato) throw new Error('Contrato não encontrado.')
  if (motivo.trim().length < 5) throw new Error('Informe o motivo da não renovação — é o que o fornecedor vai receber.')
  if (renovouSemDecisao(contrato)) {
    throw new Error(
      `O prazo de aviso (${contrato.avisoPrevioDias} dias) já passou: faltam ${diasParaVencer(contrato)} dias para o fim. O contrato renova por mais um ciclo — registre a decisão para o próximo vencimento.`,
    )
  }
  contrato.renovacaoAutomatica = false
  contrato.situacao = 'em_aviso'
}

export const fornecedoresContrato = [...FORNECEDORES]
