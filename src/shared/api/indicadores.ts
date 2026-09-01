import { totaisVendas, vendas, margemVenda, valorVenda } from './vendas'
import { totaisFinanceiro } from './financeiro'
import { chamados, emAberto as chamadoAberto, minutosParaPrimeiraResposta, slaResolucaoEstourado } from './chamados'
import { projetos, desvio } from './projetos'
import { itens as itensEstoque, precisaRepor } from './estoque'
import { clientes } from './mock-db'
import type { DirecaoMeta, Indicador, Perspectiva, RevisaoMeta } from './types'

/**
 * Metas e indicadores — TODOS derivados dos outros módulos.
 *
 * Indicador digitado à mão é indicador que ninguém confia e que ninguém
 * atualiza: ele fica verde por três meses porque o responsável esqueceu de
 * mexer. Cada indicador aqui declara a FONTE e leva à tela de origem.
 */
const latencia = (ms = 420) => new Promise((r) => setTimeout(r, ms + Math.random() * 220))

/** Quanto do período já passou — é contra isso que o ritmo é medido. */
function decorridoDoMes() {
  const hoje = new Date()
  const dias = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()
  return hoje.getDate() / dias
}

const serieFake = (base: number, variacao: number, n = 6) => {
  const meses = ['Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set']
  return Array.from({ length: n }, (_, i) => ({
    rotulo: meses[meses.length - n + i],
    valor: Math.max(base + (i - n / 2) * variacao * 0.4 + (Math.sin(i * 2.3) * variacao) / 2, 0),
  }))
}

export async function listarIndicadores(): Promise<Indicador[]> {
  await latencia()
  const decorrido = decorridoDoMes()

  const [tv, tf] = await Promise.all([totaisVendas(), totaisFinanceiro({ page: 1, perPage: 1, sortBy: 'vencimento', sortDir: 'asc', base: 'caixa' })])

  const ativos = clientes.filter((c) => c.excluidoEm === null)
  const inadimplentes = ativos.filter((c) => c.status === 'inadimplente').length
  const chamadosAbertos = chamados.filter(chamadoAberto)
  const respondidos = chamados.filter((c) => c.primeiraRespostaEm)
  const primeiraResposta = respondidos.length
    ? Math.round(respondidos.reduce((s, c) => s + minutosParaPrimeiraResposta(c), 0) / respondidos.length)
    : 0
  const projetosVivos = projetos.filter((p) => ['em_andamento', 'em_risco'].includes(p.situacao))
  const derrapando = projetosVivos.filter((p) => desvio(p) > 0.2).length
  const faturadas = vendas.filter((v) => ['faturado', 'faturado_parcial'].includes(v.situacao))
  const receitaMes = faturadas.reduce((s, v) => s + valorVenda(v), 0)
  const margem = faturadas.length ? faturadas.reduce((s, v) => s + margemVenda(v), 0) / faturadas.length : 0

  return [
    {
      id: 'receita',
      nome: 'Receita faturada',
      perspectiva: 'financeiro',
      descricao: 'Soma dos pedidos de venda faturados no período.',
      fonte: 'Vendas · pedidos faturados',
      rotaFonte: '/vendas',
      formato: 'moeda',
      direcao: 'maior_melhor',
      meta: 900_000,
      contrapesoId: 'margem',
      responsavel: 'Camila Bonfim',
      periodo: 'Mês corrente',
      decorrido,
      atual: receitaMes,
      serie: serieFake(760_000, 120_000),
    },
    {
      id: 'margem',
      nome: 'Margem média',
      perspectiva: 'financeiro',
      descricao: 'Margem dos pedidos faturados — o contrapeso da receita.',
      fonte: 'Vendas · margem por pedido',
      rotaFonte: '/vendas',
      formato: 'percentual',
      direcao: 'maior_melhor',
      meta: 0.28,
      contrapesoId: 'receita',
      responsavel: 'Camila Bonfim',
      periodo: 'Mês corrente',
      decorrido,
      atual: margem,
      serie: serieFake(0.3, 0.06),
    },
    {
      id: 'inadimplencia',
      nome: 'Clientes inadimplentes',
      perspectiva: 'financeiro',
      descricao: 'Clientes ativos com pagamento em atraso.',
      fonte: 'Clientes · status inadimplente',
      rotaFonte: '/clientes?status=inadimplente',
      formato: 'numero',
      direcao: 'menor_melhor',
      meta: 20,
      contrapesoId: null,
      responsavel: 'Rafael Quintana',
      periodo: 'Mês corrente',
      decorrido,
      atual: inadimplentes,
      serie: serieFake(28, 8),
    },
    {
      id: 'caixa',
      nome: 'Resultado de caixa',
      perspectiva: 'financeiro',
      descricao: 'Recebido menos pago no período, pela data do pagamento.',
      fonte: 'Contas a pagar e receber · ótica caixa',
      rotaFonte: '/financeiro/contas',
      formato: 'moeda',
      direcao: 'maior_melhor',
      meta: 120_000,
      contrapesoId: null,
      responsavel: 'Rafael Quintana',
      periodo: 'Mês corrente',
      decorrido,
      atual: tf.saldoRealizado,
      serie: serieFake(140_000, 60_000),
    },
    {
      id: 'primeira_resposta',
      nome: 'Tempo de 1ª resposta',
      perspectiva: 'cliente',
      descricao: 'Média de minutos até a primeira resposta humana.',
      fonte: 'Chamados · relógio de resposta',
      rotaFonte: '/chamados',
      formato: 'minutos',
      direcao: 'menor_melhor',
      meta: 45,
      contrapesoId: 'reabertura',
      responsavel: 'Ana Beatriz',
      periodo: 'Mês corrente',
      decorrido,
      atual: primeiraResposta,
      serie: serieFake(60, 25),
    },
    {
      id: 'reabertura',
      nome: 'Taxa de reabertura',
      perspectiva: 'cliente',
      descricao: 'Chamados resolvidos que voltaram — o contrapeso da pressa.',
      fonte: 'Chamados · reaberturas',
      rotaFonte: '/chamados',
      formato: 'percentual',
      direcao: 'menor_melhor',
      meta: 0.08,
      contrapesoId: 'primeira_resposta',
      responsavel: 'Ana Beatriz',
      periodo: 'Mês corrente',
      decorrido,
      atual: chamados.filter((c) => c.reaberturas > 0).length / Math.max(chamados.length, 1),
      serie: serieFake(0.1, 0.04),
    },
    {
      id: 'sla',
      nome: 'Chamados fora do SLA',
      perspectiva: 'cliente',
      descricao: 'Chamados abertos com o prazo de resolução estourado.',
      fonte: 'Chamados · SLA de resolução',
      rotaFonte: '/chamados',
      formato: 'numero',
      direcao: 'menor_melhor',
      meta: 3,
      contrapesoId: null,
      responsavel: 'Ana Beatriz',
      periodo: 'Hoje',
      decorrido: 1,
      atual: chamadosAbertos.filter(slaResolucaoEstourado).length,
      serie: serieFake(6, 4),
    },
    {
      id: 'projetos_derrapando',
      nome: 'Projetos derrapando',
      perspectiva: 'operacao',
      descricao: 'Projetos com consumo de horas 20 pontos acima do escopo entregue.',
      fonte: 'Projetos · desvio consumo × entrega',
      rotaFonte: '/projetos',
      formato: 'numero',
      direcao: 'menor_melhor',
      meta: 2,
      contrapesoId: null,
      responsavel: 'Paulo Roberto',
      periodo: 'Mês corrente',
      decorrido,
      atual: derrapando,
      serie: serieFake(3, 2),
    },
    {
      id: 'ruptura',
      nome: 'Itens no ponto de pedido',
      perspectiva: 'operacao',
      descricao: 'Itens de estoque que já deveriam ter sido repostos.',
      fonte: 'Estoque · ponto de pedido',
      rotaFonte: '/estoque',
      formato: 'numero',
      direcao: 'menor_melhor',
      meta: 5,
      contrapesoId: null,
      responsavel: 'Diego Ferrari',
      periodo: 'Hoje',
      decorrido: 1,
      atual: itensEstoque.filter(precisaRepor).length,
      serie: serieFake(9, 5),
    },
    {
      id: 'a_faturar',
      nome: 'Pedidos a faturar',
      perspectiva: 'operacao',
      descricao: 'Pedidos confirmados aguardando faturamento — dinheiro parado na porta.',
      fonte: 'Vendas · confirmados',
      rotaFonte: '/vendas',
      formato: 'numero',
      direcao: 'menor_melhor',
      meta: 6,
      contrapesoId: null,
      responsavel: 'Camila Bonfim',
      periodo: 'Hoje',
      decorrido: 1,
      atual: tv.aFaturar,
      serie: serieFake(10, 5),
    },
  ]
}

// ── Ritmo e farol ────────────────────────────────────────────────────────────

/**
 * Atingimento simples engana: 50% da meta no dia 5 é ótimo, no dia 28 é
 * desastre. O que importa é o RITMO — atingido contra o esperado até hoje.
 */
export const atingimento = (i: Indicador) => {
  if (i.direcao === 'maior_melhor') return i.meta > 0 ? i.atual / i.meta : 0
  // Menor é melhor: 100% quando está no alvo ou abaixo.
  return i.atual > 0 ? Math.min(i.meta / i.atual, 2) : 2
}

/** O que já deveria ter sido atingido a esta altura do período. */
export const esperadoAteAgora = (i: Indicador) =>
  i.direcao === 'maior_melhor' ? i.meta * i.decorrido : i.meta

export const ritmo = (i: Indicador) => {
  if (i.direcao === 'maior_melhor') {
    const esperado = esperadoAteAgora(i)
    return esperado > 0 ? i.atual / esperado : 0
  }
  return atingimento(i)
}

export type Farol = 'verde' | 'amarelo' | 'vermelho'

/** O farol olha o RITMO, não o valor absoluto — e respeita a direção da meta. */
export const farol = (i: Indicador): Farol => {
  const r = ritmo(i)
  return r >= 0.95 ? 'verde' : r >= 0.8 ? 'amarelo' : 'vermelho'
}

export const projecaoFimDoPeriodo = (i: Indicador) =>
  i.direcao === 'maior_melhor' && i.decorrido > 0 ? i.atual / i.decorrido : i.atual

// ── Revisões de meta ─────────────────────────────────────────────────────────

const revisoes = new Map<string, RevisaoMeta[]>()
let seqRevisao = 1

export async function listarRevisoes(indicadorId: string): Promise<RevisaoMeta[]> {
  await latencia(240)
  return revisoes.get(indicadorId) ?? []
}

/**
 * Mudar a meta no meio do período é legítimo — e precisa ficar registrado com
 * motivo. Meta que se ajusta ao realizado sem deixar rastro é meta que sempre
 * foi batida, e um painel que só confirma o que já aconteceu.
 */
export async function revisarMeta(indicadorId: string, para: number, motivo: string, de: number): Promise<void> {
  await latencia(560)
  if (motivo.trim().length < 10) throw new Error('Descreva por que a meta está mudando.')
  const lista = revisoes.get(indicadorId) ?? []
  lista.unshift({
    id: seqRevisao++, indicadorId, criadoEm: new Date().toISOString(),
    autor: 'Paulo Roberto', de, para, motivo,
  })
  revisoes.set(indicadorId, lista)
}

export const PERSPECTIVAS: { id: Perspectiva; rotulo: string; icone: string }[] = [
  { id: 'financeiro', rotulo: 'Financeiro', icone: '💰' },
  { id: 'cliente', rotulo: 'Cliente', icone: '🤝' },
  { id: 'operacao', rotulo: 'Operação', icone: '⚙️' },
  { id: 'pessoas', rotulo: 'Pessoas', icone: '🧑‍💼' },
]

export const rotuloDirecao = (d: DirecaoMeta) => (d === 'maior_melhor' ? 'quanto maior, melhor' : 'quanto menor, melhor')
