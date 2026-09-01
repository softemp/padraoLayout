import { vendas, valorVenda, custoVenda, margemVenda } from './vendas'
import { lancamentos } from './financeiro'
import type {
  ApuracaoVendedor, BaseCalculo, Comissao, PlanoComissao, SituacaoComissao, TotaisComissoes,
} from './types'

/**
 * Comissões — o módulo cuja regra central decide tudo:
 *
 *   a comissão NASCE na venda, mas só é DEVIDA quando o cliente PAGA.
 *
 * Pagar na venda parece generoso e é caro: venda cancelada, devolvida ou não
 * paga vira comissão a cobrar de volta do vendedor — e cobrar de volta estraga
 * a relação muito mais do que segurar teria estragado.
 */
const latencia = (ms = 360) => new Promise((r) => setTimeout(r, ms + Math.random() * 200))

/**
 * BASE DE CÁLCULO é a decisão que molda o comportamento do time.
 * Sobre FATURAMENTO, o vendedor ganha dando desconto (o desconto sai da margem
 * da empresa, não da comissão dele). Sobre MARGEM, os incentivos ficam
 * alinhados — e o vendedor passa a defender o preço.
 */
export const planoVigente: PlanoComissao = {
  id: 1,
  nome: 'Plano comercial 2026 · sobre margem',
  base: 'margem',
  faixas: [
    { ate: 50_000, percentual: 0.06 },
    { ate: 150_000, percentual: 0.08 },
    { ate: Infinity, percentual: 0.10 },
  ],
  carenciaDias: 30,
  vigenteDesde: '2026-01-01',
}

export const percentualPorFaixa = (plano: PlanoComissao, acumuladoNoPeriodo: number) =>
  plano.faixas.find((f) => acumuladoNoPeriodo <= f.ate)?.percentual ?? plano.faixas[plano.faixas.length - 1].percentual

const baseDaVenda = (vendaId: number, base: BaseCalculo) => {
  const venda = vendas.find((v) => v.id === vendaId)
  if (!venda) return 0
  return base === 'faturamento' ? valorVenda(venda) : valorVenda(venda) - custoVenda(venda)
}

/** A comissão é liberada quando o lançamento a receber da venda foi pago. */
function vendaFoiPaga(vendaId: number) {
  const venda = vendas.find((v) => v.id === vendaId)
  if (!venda?.lancamentoId) return false
  const lancamento = lancamentos.find((l) => l.id === venda.lancamentoId)
  return lancamento ? lancamento.status === 'pago' : false
}

const comissoes: Comissao[] = []
let seqComissao = 1

function garantirComissoes() {
  if (comissoes.length) return
  const acumuladoPorVendedor = new Map<string, number>()

  vendas
    .filter((v) => ['faturado', 'faturado_parcial', 'cancelado'].includes(v.situacao))
    .sort((a, b) => +new Date(a.criadoEm) - +new Date(b.criadoEm))
    .forEach((venda) => {
      const valorBase = baseDaVenda(venda.id, planoVigente.base)
      if (valorBase <= 0) return

      const acumulado = acumuladoPorVendedor.get(venda.vendedor) ?? 0
      // A faixa sai do acumulado do período — e o percentual fica COPIADO na
      // comissão: revisar o plano depois não pode reescrever o passado.
      const percentual = percentualPorFaixa(planoVigente, acumulado)
      acumuladoPorVendedor.set(venda.vendedor, acumulado + valorBase)

      const paga = vendaFoiPaga(venda.id)
      const situacao: SituacaoComissao =
        venda.situacao === 'cancelado' ? 'estornada' : paga ? (Math.random() > 0.5 ? 'paga' : 'liberada') : 'provisionada'

      comissoes.push({
        id: seqComissao++,
        vendaId: venda.id,
        numeroVenda: venda.numero,
        vendedor: venda.vendedor,
        cliente: venda.cliente,
        dataVenda: venda.criadoEm,
        baseCalculo: planoVigente.base,
        percentualAplicado: percentual,
        valorBase,
        valor: Number((valorBase * percentual).toFixed(2)),
        situacao,
        liberadaEm: situacao === 'liberada' || situacao === 'paga' ? venda.criadoEm : null,
        pagaEm: situacao === 'paga' ? venda.criadoEm : null,
        competencia: venda.criadoEm.slice(0, 7),
      })
    })
}

export async function listarComissoes(filtros?: { vendedor?: string; situacao?: SituacaoComissao }): Promise<Comissao[]> {
  await latencia()
  garantirComissoes()
  return comissoes
    .filter((c) => (!filtros?.vendedor || c.vendedor === filtros.vendedor))
    .filter((c) => (!filtros?.situacao || c.situacao === filtros.situacao))
    .sort((a, b) => +new Date(b.dataVenda) - +new Date(a.dataVenda))
}

export async function apuracaoPorVendedor(): Promise<ApuracaoVendedor[]> {
  await latencia(320)
  garantirComissoes()
  const mapa = new Map<string, ApuracaoVendedor>()

  comissoes.forEach((c) => {
    const atual = mapa.get(c.vendedor) ?? {
      vendedor: c.vendedor, provisionado: 0, liberado: 0, pago: 0, estornado: 0,
      vendas: 0, ticketMedio: 0, margemMedia: 0,
    }
    if (c.situacao === 'provisionada') atual.provisionado += c.valor
    if (c.situacao === 'liberada') atual.liberado += c.valor
    if (c.situacao === 'paga') atual.pago += c.valor
    if (c.situacao === 'estornada') atual.estornado += c.valor
    atual.vendas += 1
    mapa.set(c.vendedor, atual)
  })

  // Ticket e margem vêm das vendas, não da comissão: dois números que
  // explicam o terceiro.
  mapa.forEach((ap, vendedor) => {
    const doVendedor = vendas.filter((v) => v.vendedor === vendedor && ['faturado', 'faturado_parcial'].includes(v.situacao))
    ap.ticketMedio = doVendedor.length ? doVendedor.reduce((s, v) => s + valorVenda(v), 0) / doVendedor.length : 0
    ap.margemMedia = doVendedor.length ? doVendedor.reduce((s, v) => s + margemVenda(v), 0) / doVendedor.length : 0
  })

  return [...mapa.values()].sort((a, b) => b.liberado + b.pago - (a.liberado + a.pago))
}

export async function totaisComissoes(): Promise<TotaisComissoes> {
  await latencia(260)
  garantirComissoes()
  const soma = (s: SituacaoComissao) => comissoes.filter((c) => c.situacao === s).reduce((t, c) => t + c.valor, 0)
  return {
    provisionado: soma('provisionada'),
    liberado: soma('liberada'),
    pago: soma('paga'),
    estornado: soma('estornada'),
    aguardandoRecebimento: comissoes.filter((c) => c.situacao === 'provisionada').length,
  }
}

/**
 * Liberar exige que o cliente tenha pago. A tela nunca deveria oferecer o
 * botão sem isso — e o serviço recusa mesmo assim, porque a regra que só vive
 * na tela é a regra que a próxima integração ignora.
 */
export async function liberarComissao(id: number): Promise<void> {
  await latencia(480)
  garantirComissoes()
  const comissao = comissoes.find((c) => c.id === id)
  if (!comissao) throw new Error('Comissão não encontrada.')
  if (comissao.situacao !== 'provisionada') throw new Error('Só comissão provisionada é liberada.')
  if (!vendaFoiPaga(comissao.vendaId)) {
    throw new Error(
      `O cliente ainda não pagou a venda ${comissao.numeroVenda}. Comissão liberada antes do recebimento vira cobrança ao vendedor se a venda não entrar.`,
    )
  }
  comissao.situacao = 'liberada'
  comissao.liberadaEm = new Date().toISOString()
}

/** Pagar em lote é o gesto real do fechamento — uma a uma ninguém faz. */
export async function pagarComissoes(vendedor: string): Promise<number> {
  await latencia(720)
  garantirComissoes()
  const liberadas = comissoes.filter((c) => c.vendedor === vendedor && c.situacao === 'liberada')
  if (!liberadas.length) throw new Error('Nada liberado para pagar deste vendedor.')
  liberadas.forEach((c) => {
    c.situacao = 'paga'
    c.pagaEm = new Date().toISOString()
  })
  return liberadas.reduce((s, c) => s + c.valor, 0)
}

export async function estornarComissao(id: number, motivo: string): Promise<void> {
  await latencia(520)
  garantirComissoes()
  const comissao = comissoes.find((c) => c.id === id)
  if (!comissao) throw new Error('Comissão não encontrada.')
  if (motivo.trim().length < 5) throw new Error('Informe o motivo do estorno.')
  if (comissao.situacao === 'paga') {
    throw new Error('Comissão já paga não se estorna aqui: gera um débito a acertar no próximo fechamento.')
  }
  comissao.situacao = 'estornada'
}

/** Simulador: o mesmo pedido, comissionado sobre faturamento × sobre margem. */
export function simularBase(vendaId: number) {
  const venda = vendas.find((v) => v.id === vendaId)
  if (!venda) return null
  const faturamento = valorVenda(venda)
  const margem = faturamento - custoVenda(venda)
  return {
    numero: venda.numero,
    faturamento,
    margem,
    sobreFaturamento: faturamento * 0.06,
    sobreMargem: margem * 0.06,
  }
}

export const vendedoresComissao = () => {
  garantirComissoes()
  return [...new Set(comissoes.map((c) => c.vendedor))]
}
