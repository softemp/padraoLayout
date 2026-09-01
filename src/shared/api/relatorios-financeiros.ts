import { categorias, estaVencido, lancamentos, saldoAberto, contas } from './financeiro'
import type { Lancamento, TipoLancamento } from './types'

/**
 * Relatórios financeiros — TUDO derivado dos mesmos lançamentos de
 * `financeiro.ts`. Nenhum número novo é inventado aqui: relatório que tem base
 * própria é relatório que discorda da tela de onde os dados vieram, e aí
 * ninguém sabe qual está certo.
 */
const latencia = (ms = 420) => new Promise((r) => setTimeout(r, ms + Math.random() * 200))

export type Periodo = { de: Date; ate: Date; rotulo: string }

const fimDoDia = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }

export function periodoDeMes(ano: number, mes: number): Periodo {
  const de = new Date(ano, mes, 1)
  const ate = fimDoDia(new Date(ano, mes + 1, 0))
  return { de, ate, rotulo: de.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) }
}

export function periodoAnterior(p: Periodo): Periodo {
  const de = new Date(p.de.getFullYear(), p.de.getMonth() - 1, 1)
  return periodoDeMes(de.getFullYear(), de.getMonth())
}

const dentro = (data: string | null, p: Periodo) => {
  if (!data) return false
  const d = new Date(data)
  return d >= p.de && d <= p.ate
}

const naCompetencia = (l: Lancamento, p: Periodo) => dentro(l.vencimento, p) && l.status !== 'cancelado'
const noCaixa = (l: Lancamento, p: Periodo) => dentro(l.pagamentoEm, p) && l.valorPago > 0

/**
 * A matemática do resultado mora AQUI, uma vez só. A tela renderiza o que esta
 * função devolve — evoluir a fórmula é editar esta função, nunca o componente.
 *
 * Três óticas porque um único "lucro" engana: elas respondem perguntas
 * diferentes e podem discordar sem nenhuma estar errada.
 */
export type Resultado = {
  competencia: { receita: number; despesa: number; resultado: number }
  caixa: { recebido: number; pago: number; resultado: number }
  aberto: { aReceber: number; aPagar: number; resultado: number }
}

export function deriveResultado(p: Periodo): Resultado {
  const soma = (fn: (l: Lancamento) => boolean, valor: (l: Lancamento) => number) =>
    lancamentos.filter(fn).reduce((s, l) => s + valor(l), 0)

  const receita = soma((l) => l.tipo === 'receber' && naCompetencia(l, p), (l) => l.valor)
  const despesa = soma((l) => l.tipo === 'pagar' && naCompetencia(l, p), (l) => l.valor)
  const recebido = soma((l) => l.tipo === 'receber' && noCaixa(l, p), (l) => l.valorPago)
  const pago = soma((l) => l.tipo === 'pagar' && noCaixa(l, p), (l) => l.valorPago)
  const aReceber = soma((l) => l.tipo === 'receber' && naCompetencia(l, p), saldoAberto)
  const aPagar = soma((l) => l.tipo === 'pagar' && naCompetencia(l, p), saldoAberto)

  return {
    competencia: { receita, despesa, resultado: receita - despesa },
    caixa: { recebido, pago, resultado: recebido - pago },
    aberto: { aReceber, aPagar, resultado: aReceber - aPagar },
  }
}

export async function obterResultado(p: Periodo) {
  await latencia(320)
  return { atual: deriveResultado(p), anterior: deriveResultado(periodoAnterior(p)) }
}

// ── DRE por grupo de categoria ───────────────────────────────────────────────

export type LinhaDre = {
  categoria: string
  tipo: TipoLancamento
  atual: number
  anterior: number
  variacao: number | null   // null = não havia base para comparar
}

export async function obterDre(p: Periodo): Promise<LinhaDre[]> {
  await latencia(380)
  const ant = periodoAnterior(p)

  const somaPor = (periodo: Periodo) => {
    const mapa = new Map<number, number>()
    lancamentos.filter((l) => naCompetencia(l, periodo)).forEach((l) => mapa.set(l.categoriaId, (mapa.get(l.categoriaId) ?? 0) + l.valor))
    return mapa
  }
  const atual = somaPor(p)
  const anterior = somaPor(ant)

  return categorias
    .map((c) => {
      const va = atual.get(c.id) ?? 0
      const vb = anterior.get(c.id) ?? 0
      return {
        categoria: c.nome,
        tipo: c.tipo,
        atual: va,
        anterior: vb,
        // Variação contra zero é infinita, não 100%: melhor não mostrar número
        // do que mostrar um que engana.
        variacao: vb === 0 ? null : (va - vb) / vb,
      }
    })
    .filter((l) => l.atual !== 0 || l.anterior !== 0)
    .sort((a, b) => b.atual - a.atual)
}

// ── Fluxo de caixa mensal ────────────────────────────────────────────────────

export type MesFluxo = {
  mes: string
  saldoInicial: number
  entradas: number
  saidas: number
  saldoFinal: number
  projetado: boolean
}

export async function obterFluxoMensal(meses = 8): Promise<MesFluxo[]> {
  await latencia(420)
  const hoje = new Date()
  // Parte do saldo atual das contas e caminha para trás e para frente.
  let saldo = contas.reduce((s, c) => s + c.saldo, 0)
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - Math.floor(meses / 2), 1)

  const linhas: MesFluxo[] = []
  for (let i = 0; i < meses; i++) {
    const p = periodoDeMes(inicio.getFullYear(), inicio.getMonth() + i)
    const passado = p.ate < hoje

    // Passado: o que de fato entrou e saiu. Futuro: o que está previsto.
    const entradas = lancamentos
      .filter((l) => l.tipo === 'receber' && (passado ? noCaixa(l, p) : naCompetencia(l, p)))
      .reduce((s, l) => s + (passado ? l.valorPago : saldoAberto(l)), 0)
    const saidas = lancamentos
      .filter((l) => l.tipo === 'pagar' && (passado ? noCaixa(l, p) : naCompetencia(l, p)))
      .reduce((s, l) => s + (passado ? l.valorPago : saldoAberto(l)), 0)

    const saldoInicial = saldo
    saldo = saldoInicial + entradas - saidas
    linhas.push({
      mes: p.de.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      saldoInicial,
      entradas,
      saidas,
      saldoFinal: saldo,
      projetado: !passado,
    })
  }
  return linhas
}

// ── Idade dos saldos (aging) ─────────────────────────────────────────────────

export type FaixaAging = { faixa: string; valor: number; quantidade: number; vencida: boolean }

export async function obterAging(tipo: TipoLancamento): Promise<FaixaAging[]> {
  await latencia(340)
  const hoje = Date.now()
  const faixas: FaixaAging[] = [
    { faixa: 'A vencer', valor: 0, quantidade: 0, vencida: false },
    { faixa: 'Vencido 1–30 dias', valor: 0, quantidade: 0, vencida: true },
    { faixa: 'Vencido 31–60 dias', valor: 0, quantidade: 0, vencida: true },
    { faixa: 'Vencido 61–90 dias', valor: 0, quantidade: 0, vencida: true },
    { faixa: 'Vencido há mais de 90 dias', valor: 0, quantidade: 0, vencida: true },
  ]

  lancamentos
    .filter((l) => l.tipo === tipo && l.status !== 'cancelado' && saldoAberto(l) > 0)
    .forEach((l) => {
      const dias = Math.floor((hoje - +new Date(l.vencimento)) / 86400000)
      const i = !estaVencido(l) ? 0 : dias <= 30 ? 1 : dias <= 60 ? 2 : dias <= 90 ? 3 : 4
      faixas[i].valor += saldoAberto(l)
      faixas[i].quantidade += 1
    })

  return faixas
}

// ── Curva ABC (concentração) ─────────────────────────────────────────────────

export type LinhaAbc = {
  contraparte: string
  valor: number
  participacao: number
  acumulado: number
  classe: 'A' | 'B' | 'C'
}

export async function obterCurvaAbc(tipo: TipoLancamento, p: Periodo): Promise<LinhaAbc[]> {
  await latencia(380)
  const mapa = new Map<string, number>()
  lancamentos
    .filter((l) => l.tipo === tipo && naCompetencia(l, p))
    .forEach((l) => mapa.set(l.contraparte, (mapa.get(l.contraparte) ?? 0) + l.valor))

  const total = [...mapa.values()].reduce((s, v) => s + v, 0) || 1
  let acumulado = 0

  return [...mapa.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([contraparte, valor]) => {
      const participacao = valor / total
      acumulado += participacao
      // A/B/C pelo acumulado (80/95): é concentração, não ranking bruto.
      const classe: 'A' | 'B' | 'C' = acumulado <= 0.8 ? 'A' : acumulado <= 0.95 ? 'B' : 'C'
      return { contraparte, valor, participacao, acumulado, classe }
    })
}

// ── Evolução da inadimplência ────────────────────────────────────────────────

export async function obterInadimplencia(meses = 6) {
  await latencia(320)
  const hoje = new Date()
  return Array.from({ length: meses }, (_, i) => {
    const p = periodoDeMes(hoje.getFullYear(), hoje.getMonth() - (meses - 1 - i))
    const doMes = lancamentos.filter((l) => l.tipo === 'receber' && naCompetencia(l, p))
    const faturado = doMes.reduce((s, l) => s + l.valor, 0)
    const emAberto = doMes.filter((l) => saldoAberto(l) > 0 && estaVencido(l)).reduce((s, l) => s + saldoAberto(l), 0)
    return {
      mes: p.de.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      faturado,
      inadimplente: emAberto,
      taxa: faturado > 0 ? emAberto / faturado : 0,
    }
  })
}
