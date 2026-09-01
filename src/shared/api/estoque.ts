import type {
  Deposito, ItemEstoque, ListParams, ListResponse, MovimentoEstoque, SaldoPorDeposito,
  TipoMovimentoEstoque, TotaisEstoque,
} from './types'

/**
 * Estoque — dados fictícios com as duas regras que quase todo sistema erra:
 * custo médio ponderado e ponto de pedido calculado pelo prazo de reposição.
 */
const latencia = (ms = 360) => new Promise((r) => setTimeout(r, ms + Math.random() * 200))

function prng(seed: number) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
}
const rnd = prng(20260906)
const entre = (min: number, max: number) => Math.round(min + rnd() * (max - min))
const escolher = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]
const somarDias = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString() }

export const depositos: Deposito[] = [
  { id: 1, nome: 'Depósito central', sigla: 'CD', principal: true },
  { id: 2, nome: 'Loja Florianópolis', sigla: 'FLN', principal: false },
  { id: 3, nome: 'Loja São José', sigla: 'SJO', principal: false },
]

const CATEGORIAS = ['Equipamentos', 'Periféricos', 'Consumíveis', 'Cabos e conectores', 'Licenças', 'Embalagem'] as const
const FORNECEDORES = ['Nortesul Distribuidora', 'Atlas Suprimentos', 'TecnoParts', 'Import Ltda'] as const
const PRODUTOS = [
  'Notebook 14" i5', 'Monitor 24" IPS', 'Teclado mecânico', 'Mouse sem fio', 'Headset USB',
  'Cabo HDMI 2m', 'Cabo de rede Cat6', 'Adaptador USB-C', 'Nobreak 1200VA', 'Impressora térmica',
  'Toner preto', 'Papel A4 (resma)', 'Caixa de papelão P', 'Etiqueta térmica', 'Licença anual',
  'Suporte de monitor', 'Hub USB 4 portas', 'SSD 480GB', 'Memória 8GB', 'Webcam Full HD',
] as const

let proximoId = 1
export const itens: ItemEstoque[] = PRODUTOS.flatMap((produto, i) =>
  Array.from({ length: entre(1, 3) }, (_, v) => {
    const custoMedio = entre(1800, 480000) / 100
    const consumo = Number((entre(2, 60) / 10).toFixed(1))
    const saldo = entre(0, 320)
    return {
      id: proximoId++,
      sku: `SKU-${String(1000 + i * 3 + v)}`,
      nome: v === 0 ? produto : `${produto} · variação ${v + 1}`,
      categoria: escolher(CATEGORIAS),
      unidade: escolher(['un', 'un', 'un', 'cx', 'kg', 'm'] as const),
      custoMedio,
      precoVenda: Number((custoMedio * (1 + entre(25, 90) / 100)).toFixed(2)),
      saldo,
      reservado: Math.min(saldo, entre(0, 40)),
      estoqueSeguranca: entre(5, 40),
      prazoReposicaoDias: escolher([3, 5, 7, 10, 15, 30] as const),
      consumoMedioDiario: consumo,
      fornecedor: escolher(FORNECEDORES),
      localizacao: `${escolher(['A', 'B', 'C'] as const)}-${entre(1, 20)}-${entre(1, 6)}`,
      ativo: rnd() > 0.06,
      ultimaMovimentacao: rnd() > 0.12 ? somarDias(-entre(0, 180)) : null,
    }
  }),
)

// ── Derivados ────────────────────────────────────────────────────────────────

/** Disponível é o que dá para prometer: o físico menos o já prometido. */
export const disponivel = (i: ItemEstoque) => i.saldo - i.reservado

/**
 * Ponto de pedido = consumo médio × prazo de reposição + estoque de segurança.
 *
 * É a diferença entre avisar a tempo e avisar tarde: um item que consome 5/dia
 * e demora 15 dias para chegar precisa de aviso com 75 unidades em casa, não
 * quando bate no mínimo. Alerta calibrado pelo mínimo avisa quando já falta.
 */
export const pontoDePedido = (i: ItemEstoque) =>
  Math.ceil(i.consumoMedioDiario * i.prazoReposicaoDias + i.estoqueSeguranca)

export const precisaRepor = (i: ItemEstoque) => i.ativo && disponivel(i) <= pontoDePedido(i)
export const abaixoDaSeguranca = (i: ItemEstoque) => i.ativo && disponivel(i) < i.estoqueSeguranca
export const semEstoque = (i: ItemEstoque) => i.ativo && disponivel(i) <= 0

/** Dias que o saldo atual ainda cobre, no consumo médio. */
export const diasDeCobertura = (i: ItemEstoque) =>
  i.consumoMedioDiario > 0 ? Math.floor(disponivel(i) / i.consumoMedioDiario) : null

export const semGiro = (i: ItemEstoque) =>
  !i.ultimaMovimentacao || +new Date(i.ultimaMovimentacao) < Date.now() - 120 * 86400000

export async function listarItens(params: ListParams): Promise<ListResponse<ItemEstoque>> {
  await latencia()
  const { page, perPage, sortBy, sortDir, search, filters } = params
  let linhas = [...itens]

  if (search?.trim()) {
    const q = search.trim().toLowerCase()
    linhas = linhas.filter((i) => i.nome.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q))
  }
  if (filters?.categoria) linhas = linhas.filter((i) => i.categoria === filters.categoria)
  if (filters?.fornecedor) linhas = linhas.filter((i) => i.fornecedor === filters.fornecedor)
  if (filters?.situacao === 'repor') linhas = linhas.filter(precisaRepor)
  if (filters?.situacao === 'sem_estoque') linhas = linhas.filter(semEstoque)
  if (filters?.situacao === 'sem_giro') linhas = linhas.filter(semGiro)
  if (filters?.situacao === 'inativo') linhas = linhas.filter((i) => !i.ativo)

  const dir = sortDir === 'asc' ? 1 : -1
  linhas.sort((a, b) => {
    const va = a[sortBy as keyof ItemEstoque]
    const vb = b[sortBy as keyof ItemEstoque]
    if (va === vb) return a.id - b.id
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va).localeCompare(String(vb), 'pt-BR') * dir
  })

  const total = linhas.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const pagina = Math.min(page, totalPages)
  return { data: linhas.slice((pagina - 1) * perPage, pagina * perPage), meta: { total, totalPages, page: pagina, perPage } }
}

export async function totaisEstoque(): Promise<TotaisEstoque> {
  await latencia(240)
  const ativos = itens.filter((i) => i.ativo)
  return {
    itens: ativos.length,
    // Estoque vale o CUSTO, nunca o preço de venda: avaliar pelo preço é
    // contabilizar lucro que ainda não aconteceu.
    valorTotal: ativos.reduce((s, i) => s + i.saldo * i.custoMedio, 0),
    abaixoMinimo: ativos.filter(abaixoDaSeguranca).length,
    precisamRepor: ativos.filter(precisaRepor).length,
    semGiro: ativos.filter(semGiro).length,
  }
}

export async function obterItem(id: number): Promise<ItemEstoque> {
  await latencia(240)
  const item = itens.find((i) => i.id === id)
  if (!item) throw new Error('Item não encontrado.')
  return { ...item }
}

// ── Kardex: o saldo só muda por movimento ────────────────────────────────────

const kardex = new Map<number, MovimentoEstoque[]>()
let proximoMovimento = 1

function garantirKardex(itemId: number): MovimentoEstoque[] {
  const existente = kardex.get(itemId)
  if (existente) return existente
  const item = itens.find((i) => i.id === itemId)
  const lista: MovimentoEstoque[] = []

  if (item) {
    let saldo = 0
    let custo = 0
    const quantos = entre(4, 12)
    for (let n = quantos; n >= 1; n--) {
      const entrada = rnd() > 0.45 || saldo <= 0
      const qtd = entre(1, 60)
      if (entrada) {
        const custoEntrada = Number((item.custoMedio * (0.85 + rnd() * 0.3)).toFixed(2))
        // Custo médio ponderado: só a ENTRADA mexe nele.
        custo = saldo + qtd > 0 ? (saldo * custo + qtd * custoEntrada) / (saldo + qtd) : custoEntrada
        saldo += qtd
        lista.push({
          id: proximoMovimento++, itemId, criadoEm: somarDias(-n * entre(3, 12)), tipo: 'entrada',
          quantidade: qtd, custoUnitario: custoEntrada, saldoApos: saldo, custoMedioApos: Number(custo.toFixed(2)),
          documento: `NF ${entre(10000, 99999)}`, motivo: 'Compra de fornecedor',
          depositoId: 1, autor: 'Camila Bonfim',
        })
      } else {
        const saida = Math.min(qtd, saldo)
        saldo -= saida
        lista.push({
          id: proximoMovimento++, itemId, criadoEm: somarDias(-n * entre(3, 12)), tipo: 'saida',
          quantidade: -saida, custoUnitario: Number(custo.toFixed(2)), saldoApos: saldo, custoMedioApos: Number(custo.toFixed(2)),
          documento: `PED ${entre(1000, 9999)}`, motivo: 'Venda',
          depositoId: escolher([1, 2, 3]), autor: 'Rafael Quintana',
        })
      }
    }
    item.saldo = saldo
    item.custoMedio = Number(custo.toFixed(2))
    item.reservado = Math.min(item.reservado, saldo)
  }

  const ordenado = lista.reverse()
  kardex.set(itemId, ordenado)
  return ordenado
}

export async function obterKardex(itemId: number): Promise<MovimentoEstoque[]> {
  await latencia(340)
  return garantirKardex(itemId)
}

export async function saldosPorDeposito(itemId: number): Promise<SaldoPorDeposito[]> {
  await latencia(260)
  const item = itens.find((i) => i.id === itemId)
  if (!item) return []
  // Distribuição fictícia, mas somando exatamente o saldo do item.
  const central = Math.round(item.saldo * 0.6)
  const fln = Math.round(item.saldo * 0.25)
  return [
    { depositoId: 1, deposito: 'Depósito central', saldo: central },
    { depositoId: 2, deposito: 'Loja Florianópolis', saldo: fln },
    { depositoId: 3, deposito: 'Loja São José', saldo: item.saldo - central - fln },
  ]
}

export type NovoMovimento = {
  tipo: TipoMovimentoEstoque
  quantidade: number
  custoUnitario?: number
  documento: string
  motivo: string
  depositoId: number
}

/**
 * ÚNICO caminho que mexe no saldo e no custo médio.
 *
 * Regras que fazem a diferença:
 *  · ENTRADA recalcula o custo médio ponderado; SAÍDA não mexe nele (ela
 *    consome ao custo vigente — mudar o médio na saída inventa lucro);
 *  · saída maior que o DISPONÍVEL é recusada: o reservado já foi prometido a
 *    alguém, e vender duas vezes a mesma peça é o defeito mais caro do módulo;
 *  · ajuste é movimento com MOTIVO, nunca "editar o saldo" — contagem que
 *    corrige o número sem dizer por quê some com a única pista do que houve.
 */
export async function registrarMovimento(itemId: number, dados: NovoMovimento): Promise<MovimentoEstoque> {
  await latencia(620)
  const item = itens.find((i) => i.id === itemId)
  if (!item) throw new Error('Item não encontrado.')
  if (!(dados.quantidade > 0)) throw new Error('A quantidade precisa ser maior que zero.')
  if (dados.motivo.trim().length < 3) throw new Error('Informe o motivo do movimento.')

  const lista = garantirKardex(itemId)
  const saldoAtual = lista[0]?.saldoApos ?? item.saldo
  let custo = item.custoMedio
  let delta = 0

  if (dados.tipo === 'entrada') {
    if (!dados.custoUnitario || dados.custoUnitario <= 0) throw new Error('Entrada exige o custo unitário da compra.')
    delta = dados.quantidade
    custo = (saldoAtual * item.custoMedio + dados.quantidade * dados.custoUnitario) / (saldoAtual + dados.quantidade)
  } else if (dados.tipo === 'saida') {
    const podeSair = saldoAtual - item.reservado
    if (dados.quantidade > podeSair) {
      throw new Error(
        `Disponível é ${podeSair} ${item.unidade} (saldo ${saldoAtual} menos ${item.reservado} reservado). Libere a reserva ou reduza a quantidade.`,
      )
    }
    delta = -dados.quantidade
  } else if (dados.tipo === 'ajuste') {
    // Ajuste leva a diferença para o saldo contado, para mais ou para menos.
    delta = dados.quantidade - saldoAtual
  } else {
    delta = 0 // transferência não muda o total, só o depósito
  }

  const movimento: MovimentoEstoque = {
    id: proximoMovimento++,
    itemId,
    criadoEm: new Date().toISOString(),
    tipo: dados.tipo,
    quantidade: delta,
    custoUnitario: dados.custoUnitario ?? item.custoMedio,
    saldoApos: saldoAtual + delta,
    custoMedioApos: Number(custo.toFixed(2)),
    documento: dados.documento,
    motivo: dados.motivo,
    depositoId: dados.depositoId,
    autor: 'Paulo Roberto',
  }

  lista.unshift(movimento)
  item.saldo = movimento.saldoApos
  item.custoMedio = movimento.custoMedioApos
  item.ultimaMovimentacao = movimento.criadoEm
  return movimento
}

export const categorias = [...CATEGORIAS]
export const fornecedores = [...FORNECEDORES]
