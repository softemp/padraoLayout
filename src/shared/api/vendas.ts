import { clientes } from './mock-db'
import { criarLancamento } from './financeiro'
import { itens as itensEstoque, liberarReserva, registrarMovimento, reservarEstoque } from './estoque'
import type {
  ItemVenda, ListParams, ListResponse, PedidoVenda, SituacaoVenda, TotaisVendas,
} from './types'

/**
 * Vendas — o outro lado de compras. Confirmar RESERVA o estoque; faturar dá
 * baixa e cria a conta a receber. As duas coisas são operações distintas de
 * propósito ([[Base_Saldo_Disponivel_Vs_Fisico]]).
 */
const latencia = (ms = 380) => new Promise((r) => setTimeout(r, ms + Math.random() * 200))

function prng(seed: number) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
}
const rnd = prng(20260908)
const entre = (min: number, max: number) => Math.round(min + rnd() * (max - min))
const escolher = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]
const somarDias = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString() }

export const USUARIO_ATUAL = 'Paulo Roberto'
export const VENDEDORES = ['Camila Bonfim', 'Rafael Quintana', 'Diego Ferrari', 'Paulo Roberto'] as const

/**
 * Desconto é dinheiro saindo, então tem alçada como compra tem — e o gatilho
 * é a MARGEM, não o percentual de desconto: 10% num item de margem gorda é
 * indolor; 10% num item de margem fina vende no prejuízo.
 */
export const MARGEM_PISO = 0.15          // abaixo disto, precisa de aprovação
export const MARGEM_PROIBIDA = 0.0       // abaixo disto, nem com aprovação

export const margemItem = (i: ItemVenda) =>
  i.precoPraticado > 0 ? (i.precoPraticado - i.custoNaVenda) / i.precoPraticado : 0

export const descontoItem = (i: ItemVenda) =>
  i.precoTabela > 0 ? (i.precoTabela - i.precoPraticado) / i.precoTabela : 0

const ativos = clientes.filter((c) => c.excluidoEm === null)

let proximoId = 1
let proximoItemId = 1

function itensAleatorios(): ItemVenda[] {
  return Array.from({ length: entre(1, 4) }, () => {
    const item = itensEstoque[Math.floor(rnd() * itensEstoque.length)]
    const desconto = rnd() > 0.7 ? entre(5, 28) / 100 : 0
    return {
      id: proximoItemId++,
      itemEstoqueId: item.id,
      sku: item.sku,
      nome: item.nome,
      unidade: item.unidade,
      quantidade: entre(1, 25),
      quantidadeFaturada: 0,
      precoTabela: item.precoVenda,
      precoPraticado: Number((item.precoVenda * (1 - desconto)).toFixed(2)),
      custoNaVenda: item.custoMedio,
    }
  })
}

export const vendas: PedidoVenda[] = Array.from({ length: 42 }, (_, i) => {
  const itens = itensAleatorios()
  const precisaAprovacao = itens.some((it) => margemItem(it) < MARGEM_PISO)
  const sorteio = rnd()
  const situacao: SituacaoVenda =
    precisaAprovacao && sorteio > 0.6 ? 'aguardando_desconto'
      : sorteio > 0.82 ? 'orcamento'
      : sorteio > 0.6 ? 'confirmado'
      : sorteio > 0.46 ? 'faturado_parcial'
      : sorteio > 0.12 ? 'faturado'
      : 'cancelado'

  if (situacao === 'faturado') itens.forEach((it) => (it.quantidadeFaturada = it.quantidade))
  if (situacao === 'faturado_parcial') itens.forEach((it) => (it.quantidadeFaturada = Math.floor(it.quantidade * (0.3 + rnd() * 0.5))))

  const vendedor = escolher(VENDEDORES)
  const cliente = ativos[i % ativos.length]
  const aprovado = ['confirmado', 'faturado', 'faturado_parcial'].includes(situacao) && precisaAprovacao

  return {
    id: proximoId++,
    numero: `PV-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`,
    clienteId: cliente.id,
    cliente: cliente.nome,
    situacao,
    vendedor,
    criadoEm: somarDias(-entre(1, 70)),
    validadeOrcamento: somarDias(entre(-15, 20)),
    condicaoPagamento: escolher(['à vista', '28 dias', '30/60', '3x sem juros'] as const),
    aprovadoPor: aprovado ? escolher(VENDEDORES.filter((v) => v !== vendedor)) : null,
    aprovadoEm: aprovado ? somarDias(-entre(1, 40)) : null,
    itens,
    lancamentoId: null,
    observacao: '',
  }
})

// ── Derivados ────────────────────────────────────────────────────────────────

export const valorVenda = (p: PedidoVenda) =>
  p.itens.reduce((s, i) => s + i.quantidade * i.precoPraticado, 0)

export const custoVenda = (p: PedidoVenda) =>
  p.itens.reduce((s, i) => s + i.quantidade * i.custoNaVenda, 0)

export const margemVenda = (p: PedidoVenda) => {
  const receita = valorVenda(p)
  return receita > 0 ? (receita - custoVenda(p)) / receita : 0
}

export const precisaAprovarDesconto = (p: PedidoVenda) => margemVenda(p) < MARGEM_PISO

export const orcamentoVencido = (p: PedidoVenda) =>
  p.situacao === 'orcamento' && new Date(p.validadeOrcamento) < new Date()

export const aFaturar = (p: PedidoVenda) => ['confirmado', 'faturado_parcial'].includes(p.situacao)

export const percentualFaturado = (p: PedidoVenda) => {
  const total = p.itens.reduce((s, i) => s + i.quantidade, 0)
  const feito = p.itens.reduce((s, i) => s + i.quantidadeFaturada, 0)
  return total > 0 ? feito / total : 0
}

export async function listarVendas(params: ListParams): Promise<ListResponse<PedidoVenda>> {
  await latencia()
  const { page, perPage, sortBy, sortDir, search, filters } = params
  let linhas = [...vendas]

  if (search?.trim()) {
    const q = search.trim().toLowerCase()
    linhas = linhas.filter((p) => p.numero.toLowerCase().includes(q) || p.cliente.toLowerCase().includes(q))
  }
  if (filters?.situacao === 'vencido') linhas = linhas.filter(orcamentoVencido)
  else if (filters?.situacao === 'margem_baixa') linhas = linhas.filter(precisaAprovarDesconto)
  else if (filters?.situacao) linhas = linhas.filter((p) => p.situacao === filters.situacao)
  if (filters?.vendedor) linhas = linhas.filter((p) => p.vendedor === filters.vendedor)

  const dir = sortDir === 'asc' ? 1 : -1
  linhas.sort((a, b) => {
    if (sortBy === 'valor') return (valorVenda(a) - valorVenda(b)) * dir
    if (sortBy === 'margem') return (margemVenda(a) - margemVenda(b)) * dir
    const va = a[sortBy as keyof PedidoVenda]
    const vb = b[sortBy as keyof PedidoVenda]
    if (va === vb) return a.id - b.id
    return String(va).localeCompare(String(vb), 'pt-BR') * dir
  })

  const total = linhas.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const pagina = Math.min(page, totalPages)
  return { data: linhas.slice((pagina - 1) * perPage, pagina * perPage), meta: { total, totalPages, page: pagina, perPage } }
}

export async function totaisVendas(): Promise<TotaisVendas> {
  await latencia(240)
  const inicioMes = new Date(); inicioMes.setDate(1)
  const faturadas = vendas.filter((p) => p.situacao === 'faturado' || p.situacao === 'faturado_parcial')
  const receita = faturadas.reduce((s, p) => s + valorVenda(p), 0)
  const custo = faturadas.reduce((s, p) => s + custoVenda(p), 0)

  return {
    emOrcamento: vendas.filter((p) => p.situacao === 'orcamento').length,
    aguardandoDesconto: vendas.filter((p) => p.situacao === 'aguardando_desconto').length,
    aFaturar: vendas.filter(aFaturar).length,
    faturadoMes: faturadas.filter((p) => new Date(p.criadoEm) >= inicioMes).reduce((s, p) => s + valorVenda(p), 0),
    margemMedia: receita > 0 ? (receita - custo) / receita : 0,
  }
}

export async function obterVenda(id: number): Promise<PedidoVenda> {
  await latencia(260)
  const venda = vendas.find((v) => v.id === id)
  if (!venda) throw new Error('Pedido de venda não encontrado.')
  return { ...venda, itens: venda.itens.map((i) => ({ ...i })) }
}

/**
 * Confirmar RESERVA o estoque — não move o físico. Recusa se algum item não
 * tiver disponível: vender o que já está prometido é a venda duplicada, e ela
 * só aparece na hora de separar a mercadoria.
 */
export async function confirmarVenda(id: number): Promise<void> {
  await latencia(680)
  const venda = vendas.find((v) => v.id === id)
  if (!venda) throw new Error('Pedido não encontrado.')
  if (venda.situacao === 'aguardando_desconto') throw new Error('O desconto ainda precisa de aprovação.')
  if (venda.situacao !== 'orcamento') throw new Error('Só orçamento vira pedido confirmado.')
  if (precisaAprovarDesconto(venda)) {
    venda.situacao = 'aguardando_desconto'
    throw new Error(
      `Margem de ${(margemVenda(venda) * 100).toFixed(1)}% está abaixo do piso de ${MARGEM_PISO * 100}%. Enviado para aprovação.`,
    )
  }

  for (const item of venda.itens) {
    await reservarEstoque(item.itemEstoqueId, item.quantidade - item.quantidadeFaturada)
  }
  venda.situacao = 'confirmado'
  registrarEvento(id, 'confirmou o pedido', `${venda.itens.length} itens reservados no estoque`)
}

/** Quem vendeu não aprova o próprio desconto. */
export async function aprovarDesconto(id: number): Promise<void> {
  await latencia(560)
  const venda = vendas.find((v) => v.id === id)
  if (!venda) throw new Error('Pedido não encontrado.')
  if (venda.situacao !== 'aguardando_desconto') throw new Error('Este pedido não está aguardando aprovação de desconto.')
  if (venda.vendedor === USUARIO_ATUAL) {
    throw new Error('Quem vendeu não aprova o próprio desconto — peça a quem tem alçada comercial.')
  }
  if (margemVenda(venda) <= MARGEM_PROIBIDA) {
    throw new Error('Margem negativa não é aprovável: o pedido vende abaixo do custo. Renegocie o preço.')
  }
  venda.aprovadoPor = USUARIO_ATUAL
  venda.aprovadoEm = new Date().toISOString()
  venda.situacao = 'orcamento'
  registrarEvento(id, 'aprovou o desconto', `Margem final ${(margemVenda(venda) * 100).toFixed(1)}%`)
}

export type LinhaFaturamento = { itemVendaId: number; quantidade: number }

export type ResultadoFaturamento = { saidas: number; lancamentoCriado: boolean; valor: number }

/**
 * Faturar é o gesto que move o físico e cria o direito de receber: baixa no
 * estoque (consumindo a reserva) + conta a receber, na mesma operação.
 */
export async function faturarVenda(id: number, linhas: LinhaFaturamento[], documento: string): Promise<ResultadoFaturamento> {
  await latencia(880)
  const venda = vendas.find((v) => v.id === id)
  if (!venda) throw new Error('Pedido não encontrado.')
  if (!aFaturar(venda)) throw new Error('Só pedido confirmado é faturado.')
  if (!documento.trim()) throw new Error('Informe a nota fiscal.')

  let saidas = 0
  let valor = 0

  for (const linha of linhas) {
    if (linha.quantidade <= 0) continue
    const item = venda.itens.find((i) => i.id === linha.itemVendaId)
    if (!item) continue
    const faltavam = item.quantidade - item.quantidadeFaturada
    if (linha.quantidade > faltavam) throw new Error(`${item.sku}: faturando ${linha.quantidade} com apenas ${faltavam} em aberto.`)

    // A reserva vira saída: libera e baixa, nessa ordem.
    await liberarReserva(item.itemEstoqueId, linha.quantidade)
    await registrarMovimento(item.itemEstoqueId, {
      tipo: 'saida',
      quantidade: linha.quantidade,
      documento,
      motivo: `Faturamento do pedido ${venda.numero}`,
      depositoId: 1,
    })
    item.quantidadeFaturada += linha.quantidade
    valor += linha.quantidade * item.precoPraticado
    saidas++
  }

  const completo = venda.itens.every((i) => i.quantidadeFaturada >= i.quantidade)
  venda.situacao = completo ? 'faturado' : 'faturado_parcial'

  let lancamentoCriado = false
  if (valor > 0) {
    const criados = await criarLancamento({
      tipo: 'receber',
      descricao: `${venda.numero} · ${documento}`,
      contraparte: venda.cliente,
      categoriaId: 2, // Serviços avulsos
      competencia: new Date().toISOString().slice(0, 7),
      vencimento: somarDias(venda.condicaoPagamento === 'à vista' ? 0 : 28),
      valor: Number(valor.toFixed(2)),
      contaId: 1,
      recorrencia: { ativa: false, periodicidade: 'mensal', parcelas: 1 },
      confirmarDuplicidade: true,
    })
    venda.lancamentoId = criados[0]?.id ?? null
    lancamentoCriado = true
  }

  registrarEvento(id, completo ? 'faturou o pedido' : 'faturou parcialmente', `${documento} · ${saidas} itens`)
  return { saidas, lancamentoCriado, valor }
}

/** Cancelar libera a reserva na hora — reserva presa é estoque morto. */
export async function cancelarVenda(id: number, motivo: string): Promise<void> {
  await latencia(520)
  const venda = vendas.find((v) => v.id === id)
  if (!venda) throw new Error('Pedido não encontrado.')
  if (venda.situacao === 'faturado') throw new Error('Pedido faturado não é cancelado — trate a devolução.')

  if (venda.situacao === 'confirmado' || venda.situacao === 'faturado_parcial') {
    for (const item of venda.itens) {
      await liberarReserva(item.itemEstoqueId, item.quantidade - item.quantidadeFaturada)
    }
  }
  venda.situacao = 'cancelado'
  registrarEvento(id, 'cancelou o pedido', motivo)
}

// ── Histórico ────────────────────────────────────────────────────────────────

const historico = new Map<number, { id: number; criadoEm: string; autor: string; acao: string; detalhe: string }[]>()
let proximoEvento = 1

function registrarEvento(vendaId: number, acao: string, detalhe: string) {
  const lista = historico.get(vendaId) ?? []
  lista.unshift({ id: proximoEvento++, criadoEm: new Date().toISOString(), autor: USUARIO_ATUAL, acao, detalhe })
  historico.set(vendaId, lista)
}

export async function listarHistoricoVenda(vendaId: number) {
  await latencia(240)
  const existente = historico.get(vendaId)
  if (existente) return existente
  const venda = vendas.find((v) => v.id === vendaId)
  const lista = venda
    ? [{ id: proximoEvento++, criadoEm: venda.criadoEm, autor: venda.vendedor, acao: 'criou o orçamento', detalhe: `${venda.itens.length} itens · ${venda.cliente}` }]
    : []
  historico.set(vendaId, lista)
  return lista
}
