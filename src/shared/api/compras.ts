import { criarLancamento } from './financeiro'
import {
  disponivel, itens as itensEstoque, pontoDePedido, precisaRepor, registrarMovimento,
} from './estoque'
import type {
  EventoPedido, ItemPedido, ListParams, ListResponse, PedidoCompra, SituacaoPedido,
  SugestaoCompra, TotaisCompras,
} from './types'

/**
 * Compras — o módulo que AMARRA estoque e financeiro: receber gera entrada no
 * kardex (com o custo da nota) e a conta a pagar. Fazer as três coisas em
 * telas separadas é como o estoque e o contas a pagar param de bater.
 */
const latencia = (ms = 380) => new Promise((r) => setTimeout(r, ms + Math.random() * 200))

function prng(seed: number) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
}
const rnd = prng(20260907)
const entre = (min: number, max: number) => Math.round(min + rnd() * (max - min))
const escolher = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]
const somarDias = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString() }

export const USUARIO_ATUAL = 'Paulo Roberto'
const COMPRADORES = ['Camila Bonfim', 'Rafael Quintana', 'Paulo Roberto'] as const

/**
 * Alçada por valor. Aprovar acima do teto é decisão de outra pessoa — e quem
 * CRIA o pedido nunca aprova o próprio: é a segregação de funções que impede o
 * caminho mais simples de fraude interna.
 */
export const ALCADAS: { papel: string; ate: number }[] = [
  { papel: 'Comprador', ate: 5_000 },
  { papel: 'Coordenação', ate: 25_000 },
  { papel: 'Diretoria', ate: Infinity },
]

export const alcadaNecessaria = (valor: number) => ALCADAS.find((a) => valor <= a.ate)!.papel

let proximoPedidoId = 1
let proximoItemId = 1

function itensAleatorios(): ItemPedido[] {
  return Array.from({ length: entre(1, 5) }, () => {
    const item = itensEstoque[Math.floor(rnd() * itensEstoque.length)]
    const quantidade = entre(5, 120)
    return {
      id: proximoItemId++,
      itemEstoqueId: item.id,
      sku: item.sku,
      nome: item.nome,
      unidade: item.unidade,
      quantidade,
      quantidadeRecebida: 0,
      precoUnitario: Number((item.custoMedio * (0.9 + rnd() * 0.25)).toFixed(2)),
    }
  })
}

export const pedidos: PedidoCompra[] = Array.from({ length: 38 }, (_, i) => {
  const itens = itensAleatorios()
  const sorteio = rnd()
  const situacao: SituacaoPedido =
    sorteio > 0.86 ? 'aguardando_aprovacao'
      : sorteio > 0.74 ? 'aprovado'
      : sorteio > 0.56 ? 'enviado'
      : sorteio > 0.44 ? 'recebido_parcial'
      : sorteio > 0.14 ? 'recebido'
      : sorteio > 0.08 ? 'rascunho'
      : 'cancelado'

  if (situacao === 'recebido') itens.forEach((it) => (it.quantidadeRecebida = it.quantidade))
  if (situacao === 'recebido_parcial') itens.forEach((it) => (it.quantidadeRecebida = Math.floor(it.quantidade * (0.3 + rnd() * 0.5))))

  const criadoPor = escolher(COMPRADORES)
  const aprovado = !['rascunho', 'aguardando_aprovacao'].includes(situacao)

  return {
    id: proximoPedidoId++,
    numero: `PC-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`,
    fornecedor: escolher(['Nortesul Distribuidora', 'Atlas Suprimentos', 'TecnoParts', 'Import Ltda'] as const),
    situacao,
    criadoPor,
    criadoEm: somarDias(-entre(2, 90)),
    // Quem aprova é SEMPRE outra pessoa que não criou.
    aprovadoPor: aprovado ? escolher(COMPRADORES.filter((c) => c !== criadoPor)) : null,
    aprovadoEm: aprovado ? somarDias(-entre(1, 60)) : null,
    previsaoEntrega: somarDias(entre(-25, 40)),
    condicaoPagamento: escolher(['28 dias', '30/60', 'à vista', '15 dias'] as const),
    observacao: '',
    itens,
    lancamentoId: null,
  }
})

// ── Derivados ────────────────────────────────────────────────────────────────

export const valorPedido = (p: PedidoCompra) =>
  p.itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0)

export const valorRecebido = (p: PedidoCompra) =>
  p.itens.reduce((s, i) => s + i.quantidadeRecebida * i.precoUnitario, 0)

export const emAberto = (p: PedidoCompra) =>
  ['aprovado', 'enviado', 'recebido_parcial'].includes(p.situacao)

/** Atrasado = ainda não recebido e a previsão já passou. */
export const estaAtrasado = (p: PedidoCompra) =>
  emAberto(p) && new Date(p.previsaoEntrega) < new Date()

export const percentualRecebido = (p: PedidoCompra) => {
  const total = p.itens.reduce((s, i) => s + i.quantidade, 0)
  const recebido = p.itens.reduce((s, i) => s + i.quantidadeRecebida, 0)
  return total > 0 ? recebido / total : 0
}

export async function listarPedidos(params: ListParams): Promise<ListResponse<PedidoCompra>> {
  await latencia()
  const { page, perPage, sortBy, sortDir, search, filters } = params
  let linhas = [...pedidos]

  if (search?.trim()) {
    const q = search.trim().toLowerCase()
    linhas = linhas.filter((p) => p.numero.toLowerCase().includes(q) || p.fornecedor.toLowerCase().includes(q))
  }
  if (filters?.situacao === 'atrasado') linhas = linhas.filter(estaAtrasado)
  else if (filters?.situacao) linhas = linhas.filter((p) => p.situacao === filters.situacao)
  if (filters?.fornecedor) linhas = linhas.filter((p) => p.fornecedor === filters.fornecedor)

  const dir = sortDir === 'asc' ? 1 : -1
  linhas.sort((a, b) => {
    if (sortBy === 'valor') return (valorPedido(a) - valorPedido(b)) * dir
    const va = a[sortBy as keyof PedidoCompra]
    const vb = b[sortBy as keyof PedidoCompra]
    if (va === vb) return a.id - b.id
    return String(va).localeCompare(String(vb), 'pt-BR') * dir
  })

  const total = linhas.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const pagina = Math.min(page, totalPages)
  return { data: linhas.slice((pagina - 1) * perPage, pagina * perPage), meta: { total, totalPages, page: pagina, perPage } }
}

export async function totaisCompras(): Promise<TotaisCompras> {
  await latencia(240)
  return {
    aguardandoAprovacao: pedidos.filter((p) => p.situacao === 'aguardando_aprovacao').length,
    aReceber: pedidos.filter(emAberto).length,
    atrasados: pedidos.filter(estaAtrasado).length,
    valorEmAberto: pedidos.filter(emAberto).reduce((s, p) => s + (valorPedido(p) - valorRecebido(p)), 0),
    sugestoes: itensEstoque.filter(precisaRepor).length,
  }
}

export async function obterPedido(id: number): Promise<PedidoCompra> {
  await latencia(260)
  const pedido = pedidos.find((p) => p.id === id)
  if (!pedido) throw new Error('Pedido não encontrado.')
  return { ...pedido, itens: pedido.itens.map((i) => ({ ...i })) }
}

// ── Aprovação ────────────────────────────────────────────────────────────────

/**
 * Quem cria NÃO aprova. É a regra que mais incomoda no dia a dia e a que
 * fecha o caminho mais simples de fraude interna — pedido para fornecedor
 * próprio, aprovado por quem pediu, recebido no papel.
 */
export async function aprovarPedido(id: number): Promise<void> {
  await latencia(520)
  const pedido = pedidos.find((p) => p.id === id)
  if (!pedido) throw new Error('Pedido não encontrado.')
  if (pedido.situacao !== 'aguardando_aprovacao') throw new Error('Só pedido aguardando aprovação pode ser aprovado.')
  if (pedido.criadoPor === USUARIO_ATUAL) {
    throw new Error('Quem cria o pedido não aprova o próprio pedido. Peça a aprovação a outra pessoa com alçada.')
  }
  pedido.situacao = 'aprovado'
  pedido.aprovadoPor = USUARIO_ATUAL
  pedido.aprovadoEm = new Date().toISOString()
  registrarEvento(id, 'aprovou o pedido', `Alçada exigida: ${alcadaNecessaria(valorPedido(pedido))}`)
}

export async function enviarAoFornecedor(id: number): Promise<void> {
  await latencia(420)
  const pedido = pedidos.find((p) => p.id === id)
  if (!pedido) throw new Error('Pedido não encontrado.')
  if (pedido.situacao !== 'aprovado') throw new Error('Envie ao fornecedor só depois de aprovado.')
  pedido.situacao = 'enviado'
  registrarEvento(id, 'enviou ao fornecedor', pedido.fornecedor)
}

export async function cancelarPedido(id: number, motivo: string): Promise<void> {
  await latencia(420)
  const pedido = pedidos.find((p) => p.id === id)
  if (!pedido) throw new Error('Pedido não encontrado.')
  if (pedido.situacao === 'recebido' || pedido.situacao === 'recebido_parcial') {
    throw new Error('Pedido com mercadoria recebida não é cancelado — trate a devolução.')
  }
  pedido.situacao = 'cancelado'
  registrarEvento(id, 'cancelou o pedido', motivo)
}

// ── Recebimento: onde compras, estoque e financeiro se encontram ─────────────

export type LinhaRecebimento = { itemPedidoId: number; quantidade: number; precoNota: number }

export type ResultadoRecebimento = {
  divergencias: string[]
  entradasEstoque: number
  lancamentoCriado: boolean
}

/**
 * Conferência a três pontas: PEDIDO × RECEBIMENTO × NOTA.
 *
 * Divergência NÃO bloqueia o recebimento — a mercadoria está na doca e o
 * caminhão vai embora. Ela bloqueia o PAGAMENTO: receber errado se resolve
 * depois; pagar errado é dinheiro que já saiu.
 */
export async function receberPedido(
  id: number,
  linhas: LinhaRecebimento[],
  documento: string,
): Promise<ResultadoRecebimento> {
  await latencia(880)
  const pedido = pedidos.find((p) => p.id === id)
  if (!pedido) throw new Error('Pedido não encontrado.')
  if (!['aprovado', 'enviado', 'recebido_parcial'].includes(pedido.situacao)) {
    throw new Error('Só pedido aprovado e enviado recebe mercadoria.')
  }
  if (!documento.trim()) throw new Error('Informe a nota fiscal do recebimento.')

  const divergencias: string[] = []
  let entradas = 0

  for (const linha of linhas) {
    if (linha.quantidade <= 0) continue
    const item = pedido.itens.find((i) => i.id === linha.itemPedidoId)
    if (!item) continue

    const faltavam = item.quantidade - item.quantidadeRecebida
    if (linha.quantidade > faltavam) {
      divergencias.push(`${item.sku}: recebido ${linha.quantidade}, faltavam ${faltavam} (a mais que o pedido)`)
    }
    if (Math.abs(linha.precoNota - item.precoUnitario) > 0.009) {
      const sinal = linha.precoNota > item.precoUnitario ? 'acima' : 'abaixo'
      divergencias.push(`${item.sku}: nota a ${linha.precoNota.toFixed(2)}, pedido a ${item.precoUnitario.toFixed(2)} (${sinal})`)
    }

    item.quantidadeRecebida += linha.quantidade

    // Entrada no estoque com o custo da NOTA — é ele que forma o custo médio,
    // não o preço combinado no pedido.
    await registrarMovimento(item.itemEstoqueId, {
      tipo: 'entrada',
      quantidade: linha.quantidade,
      custoUnitario: linha.precoNota,
      documento,
      motivo: `Recebimento do pedido ${pedido.numero}`,
      depositoId: 1,
    })
    entradas++
  }

  const completo = pedido.itens.every((i) => i.quantidadeRecebida >= i.quantidade)
  pedido.situacao = completo ? 'recebido' : 'recebido_parcial'

  // A conta a pagar nasce do recebimento, no valor do que ENTROU.
  const valorNota = linhas.reduce((s, l) => s + l.quantidade * l.precoNota, 0)
  let lancamentoCriado = false
  if (valorNota > 0) {
    const criados = await criarLancamento({
      tipo: 'pagar',
      descricao: `${pedido.numero} · ${documento}`,
      contraparte: pedido.fornecedor,
      categoriaId: 10, // Fornecedores
      competencia: new Date().toISOString().slice(0, 7),
      vencimento: somarDias(28),
      valor: Number(valorNota.toFixed(2)),
      contaId: 1,
      observacao: divergencias.length ? 'Retido: divergência na conferência a três pontas' : undefined,
      recorrencia: { ativa: false, periodicidade: 'mensal', parcelas: 1 },
      confirmarDuplicidade: true,
    })
    pedido.lancamentoId = criados[0]?.id ?? null
    lancamentoCriado = true
  }

  registrarEvento(
    id,
    completo ? 'recebeu o pedido por completo' : 'recebeu o pedido parcialmente',
    divergencias.length ? `${documento} · ${divergencias.length} divergência(s)` : documento,
  )

  return { divergencias, entradasEstoque: entradas, lancamentoCriado }
}

// ── Sugestões de compra (vindas do estoque) ──────────────────────────────────

/** O que o estoque já sabe: item no ponto de pedido vira sugestão de compra. */
export async function sugestoesCompra(): Promise<SugestaoCompra[]> {
  await latencia(340)
  return itensEstoque
    .filter(precisaRepor)
    .map((i) => ({
      itemEstoqueId: i.id,
      sku: i.sku,
      nome: i.nome,
      unidade: i.unidade,
      disponivel: disponivel(i),
      pontoDePedido: pontoDePedido(i),
      // Repor até cobrir o dobro do ponto de pedido: comprar só o que falta
      // deixa o item de volta no gatilho no dia seguinte.
      sugerido: Math.max(pontoDePedido(i) * 2 - disponivel(i), 1),
      custoMedio: i.custoMedio,
      fornecedor: i.fornecedor,
      prazoReposicaoDias: i.prazoReposicaoDias,
    }))
    .sort((a, b) => a.disponivel - b.disponivel)
}

// ── Histórico ────────────────────────────────────────────────────────────────

const historico = new Map<number, EventoPedido[]>()
let proximoEvento = 1

function registrarEvento(pedidoId: number, acao: string, detalhe: string) {
  const lista = historico.get(pedidoId) ?? []
  lista.unshift({ id: proximoEvento++, pedidoId, criadoEm: new Date().toISOString(), autor: USUARIO_ATUAL, acao, detalhe })
  historico.set(pedidoId, lista)
}

export async function listarHistoricoPedido(pedidoId: number): Promise<EventoPedido[]> {
  await latencia(240)
  const existente = historico.get(pedidoId)
  if (existente) return existente
  const pedido = pedidos.find((p) => p.id === pedidoId)
  const lista: EventoPedido[] = pedido
    ? [{ id: proximoEvento++, pedidoId, criadoEm: pedido.criadoEm, autor: pedido.criadoPor, acao: 'criou o pedido', detalhe: `${pedido.itens.length} itens · ${pedido.fornecedor}` }]
    : []
  if (pedido?.aprovadoEm) {
    lista.unshift({ id: proximoEvento++, pedidoId, criadoEm: pedido.aprovadoEm, autor: pedido.aprovadoPor!, acao: 'aprovou o pedido', detalhe: `Alçada: ${alcadaNecessaria(valorPedido(pedido))}` })
  }
  historico.set(pedidoId, lista)
  return lista
}

export const fornecedoresCompras = ['Nortesul Distribuidora', 'Atlas Suprimentos', 'TecnoParts', 'Import Ltda']
