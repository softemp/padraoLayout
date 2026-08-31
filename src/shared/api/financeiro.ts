import type {
  BaixaLancamento, BaseData, CategoriaFinanceira, ContaBancaria, Lancamento, ListParams,
  ListResponse, MovimentoBancario, NovoLancamento, StatusLancamento, TotaisFinanceiro,
} from './types'

/**
 * Contas a pagar e a receber — dados fictícios com as REGRAS ligadas.
 *
 * As quatro invariantes que este módulo existe para demonstrar:
 *  1. "vencido" é DERIVADO (pendente + vencimento passado), nunca gravado;
 *  2. o período tem duas bases: competência (vencimento) e caixa (pagamento,
 *     caindo no vencimento quando ainda não houve pagamento);
 *  3. recorrência é MATERIALIZADA na criação — N parcelas de verdade, não uma
 *     regra que alguém precisa expandir depois;
 *  4. registro PAGO é imutável: não se edita nem se cancela — estorna-se.
 */

const latencia = (ms = 380) => new Promise((r) => setTimeout(r, ms + Math.random() * 200))

function prng(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
}
const rnd = prng(20260902)
const entre = (min: number, max: number) => Math.round(min + rnd() * (max - min))
const escolher = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]

const hoje = () => new Date()
const iso = (d: Date) => d.toISOString()
const somarDias = (dias: number) => { const d = hoje(); d.setDate(d.getDate() + dias); return d }
const competenciaDe = (data: Date) => `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`

/** setMonth com dia 31 transborda de mês: fixar no dia 1 antes de somar. */
function somarMeses(base: Date, meses: number) {
  const d = new Date(base)
  const dia = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + meses)
  const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(dia, ultimoDia))
  return d
}

export const categorias: CategoriaFinanceira[] = [
  { id: 1, nome: 'Mensalidades', tipo: 'receber', slug: 'mensalidades', sistema: true },
  { id: 2, nome: 'Serviços avulsos', tipo: 'receber', slug: 'servicos-avulsos', sistema: true },
  { id: 3, nome: 'Implantação', tipo: 'receber', slug: null, sistema: false },
  { id: 4, nome: 'Outras receitas', tipo: 'receber', slug: 'outras-receitas', sistema: true },
  { id: 5, nome: 'Folha de pagamento', tipo: 'pagar', slug: 'folha', sistema: true },
  { id: 6, nome: 'Impostos e taxas', tipo: 'pagar', slug: 'impostos', sistema: true },
  { id: 7, nome: 'Infraestrutura e nuvem', tipo: 'pagar', slug: 'infraestrutura', sistema: true },
  { id: 8, nome: 'Aluguel e condomínio', tipo: 'pagar', slug: null, sistema: false },
  { id: 9, nome: 'Marketing', tipo: 'pagar', slug: null, sistema: false },
  { id: 10, nome: 'Fornecedores', tipo: 'pagar', slug: 'fornecedores', sistema: true },
]

export const contas: ContaBancaria[] = [
  { id: 1, nome: 'Conta movimento', banco: 'Itaú', agencia: '0912', numero: '12345-6', saldo: 184_320.55, principal: true },
  { id: 2, nome: 'Conta recebimento PIX', banco: 'Bradesco', agencia: '3374', numero: '88901-2', saldo: 62_140.9, principal: false },
  { id: 3, nome: 'Reserva', banco: 'BTG', agencia: '0001', numero: '55210-3', saldo: 240_000, principal: false },
]

const CLIENTES_PAGADORES = ['Grupo Atlas', 'Nortesul Ltda', 'Vilela Camargo ME', 'Duarte & Campos', 'Bastos Participações', 'Prado Tecnologia']
const FORNECEDORES = ['AWS Brasil', 'Prefeitura Municipal', 'Imobiliária Centro', 'Contabilidade Nunes', 'Agência Traço', 'Telecom Sul', 'Equipe CLT']

let proximoId = 1
let proximaSerie = 1

function criarLinha(parcial: Partial<Lancamento> & Pick<Lancamento, 'tipo' | 'vencimento' | 'valor' | 'categoriaId'>): Lancamento {
  const vencimento = new Date(parcial.vencimento)
  return {
    id: proximoId++,
    tipo: parcial.tipo,
    descricao: parcial.descricao ?? '',
    contraparte: parcial.contraparte ?? '',
    categoriaId: parcial.categoriaId,
    competencia: parcial.competencia ?? competenciaDe(vencimento),
    vencimento: parcial.vencimento,
    pagamentoEm: parcial.pagamentoEm ?? null,
    valor: parcial.valor,
    valorPago: parcial.valorPago ?? 0,
    juros: parcial.juros ?? 0,
    desconto: parcial.desconto ?? 0,
    status: parcial.status ?? 'pendente',
    contaId: parcial.contaId ?? null,
    origem: parcial.origem ?? 'manual',
    serieId: parcial.serieId ?? null,
    parcela: parcial.parcela ?? null,
    observacao: parcial.observacao,
  }
}

export const lancamentos: Lancamento[] = []

// Seed: 6 meses de histórico + 3 meses à frente, pagos, pendentes e vencidos.
;(() => {
  const recorrentes: { descricao: string; contraparte: string; categoriaId: number; tipo: 'pagar' | 'receber'; valor: number; dia: number }[] = [
    { descricao: 'Folha de pagamento', contraparte: 'Equipe CLT', categoriaId: 5, tipo: 'pagar', valor: 128_400, dia: 5 },
    { descricao: 'Infraestrutura em nuvem', contraparte: 'AWS Brasil', categoriaId: 7, tipo: 'pagar', valor: 18_760, dia: 12 },
    { descricao: 'Aluguel da sede', contraparte: 'Imobiliária Centro', categoriaId: 8, tipo: 'pagar', valor: 14_200, dia: 10 },
    { descricao: 'Simples Nacional', contraparte: 'Prefeitura Municipal', categoriaId: 6, tipo: 'pagar', valor: 32_500, dia: 20 },
    { descricao: 'Honorários contábeis', contraparte: 'Contabilidade Nunes', categoriaId: 10, tipo: 'pagar', valor: 4_900, dia: 15 },
  ]

  recorrentes.forEach((base) => {
    const serieId = proximaSerie++
    for (let i = -6; i <= 3; i++) {
      const vencimento = somarMeses(new Date(hoje().getFullYear(), hoje().getMonth(), base.dia), i)
      const passou = vencimento < hoje()
      const pago = passou && rnd() > 0.18
      lancamentos.push(
        criarLinha({
          ...base,
          vencimento: iso(vencimento),
          valor: base.valor + entre(-800, 800),
          status: pago ? 'pago' : 'pendente',
          pagamentoEm: pago ? iso(somarDias(-entre(1, 40))) : null,
          valorPago: pago ? base.valor : 0,
          contaId: 1,
          origem: 'recorrencia',
          serieId,
          parcela: { numero: i + 7, de: 10 },
        }),
      )
    }
  })

  // Receitas e despesas avulsas
  for (let i = 0; i < 90; i++) {
    const receber = rnd() > 0.42
    const dias = entre(-120, 60)
    const vencimento = somarDias(dias)
    const passou = vencimento < hoje()
    const sorteio = rnd()
    const status: StatusLancamento = !passou
      ? 'pendente'
      : sorteio > 0.34 ? 'pago' : sorteio > 0.26 ? 'parcial' : sorteio > 0.2 ? 'cancelado' : 'pendente'
    const valor = receber ? entre(1_800, 42_000) : entre(600, 24_000)

    lancamentos.push(
      criarLinha({
        tipo: receber ? 'receber' : 'pagar',
        descricao: receber
          ? escolher(['Mensalidade do plano', 'Implantação contratada', 'Serviço avulso', 'Consultoria'] as const)
          : escolher(['Campanha de mídia', 'Licenças de software', 'Link dedicado', 'Materiais de escritório', 'Manutenção'] as const),
        contraparte: receber ? escolher(CLIENTES_PAGADORES) : escolher(FORNECEDORES),
        categoriaId: receber ? escolher([1, 2, 3, 4]) : escolher([6, 7, 9, 10]),
        vencimento: iso(vencimento),
        valor,
        status,
        pagamentoEm: status === 'pago' || status === 'parcial' ? iso(somarDias(dias + entre(0, 6))) : null,
        valorPago: status === 'pago' ? valor : status === 'parcial' ? Math.round(valor * 0.45) : 0,
        contaId: rnd() > 0.2 ? escolher([1, 2]) : null,
        origem: rnd() > 0.75 ? 'automatico' : 'manual',
      }),
    )
  }
})()

// ── Regras derivadas ─────────────────────────────────────────────────────────

/** Vencido é CALCULADO na leitura — nunca um status gravado. */
export const estaVencido = (l: Lancamento) =>
  (l.status === 'pendente' || l.status === 'parcial') && new Date(l.vencimento) < hoje()

export const saldoAberto = (l: Lancamento) =>
  l.status === 'cancelado' ? 0 : Math.max(l.valor + l.juros - l.desconto - l.valorPago, 0)

/** Eixo do período: competência = vencimento; caixa = pagamento ?? vencimento. */
const dataDaBase = (l: Lancamento, base: BaseData) =>
  new Date(base === 'caixa' ? l.pagamentoEm ?? l.vencimento : l.vencimento)

export type FiltroFinanceiro = ListParams & {
  tipo?: 'receber' | 'pagar' | 'todos'
  base?: BaseData
  de?: string
  ate?: string
}

function aplicarFiltros(params: FiltroFinanceiro) {
  const { tipo = 'todos', base = 'competencia', de, ate, search, filters } = params
  let linhas = lancamentos.filter((l) => (tipo === 'todos' ? true : l.tipo === tipo))

  if (de) linhas = linhas.filter((l) => dataDaBase(l, base) >= new Date(de))
  if (ate) {
    // Fim do período é o dia INTEIRO: comparar com 00:00 corta o último dia.
    const limite = new Date(ate)
    limite.setHours(23, 59, 59, 999)
    linhas = linhas.filter((l) => dataDaBase(l, base) <= limite)
  }

  if (search?.trim()) {
    const q = search.trim().toLowerCase()
    linhas = linhas.filter(
      (l) => l.descricao.toLowerCase().includes(q) || l.contraparte.toLowerCase().includes(q),
    )
  }

  if (filters?.status) {
    // "vencido" é uma opção de FILTRO, não um estado do registro.
    linhas =
      filters.status === 'vencido'
        ? linhas.filter(estaVencido)
        : linhas.filter((l) => l.status === filters.status && !(filters.status === 'pendente' && estaVencido(l)))
  }
  if (filters?.categoria) linhas = linhas.filter((l) => String(l.categoriaId) === filters.categoria)
  if (filters?.conta) linhas = linhas.filter((l) => String(l.contaId ?? '') === filters.conta)

  return linhas
}

export async function listarLancamentos(params: FiltroFinanceiro): Promise<ListResponse<Lancamento>> {
  await latencia()
  const { page, perPage, sortBy, sortDir } = params
  const linhas = aplicarFiltros(params)

  const dir = sortDir === 'asc' ? 1 : -1
  linhas.sort((a, b) => {
    const va = a[sortBy as keyof Lancamento]
    const vb = b[sortBy as keyof Lancamento]
    if (va === vb) return a.id - b.id
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va).localeCompare(String(vb), 'pt-BR') * dir
  })

  const total = linhas.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const pagina = Math.min(page, totalPages)
  return { data: linhas.slice((pagina - 1) * perPage, pagina * perPage), meta: { total, totalPages, page: pagina, perPage } }
}

export async function totaisFinanceiro(params: FiltroFinanceiro): Promise<TotaisFinanceiro> {
  await latencia(260)
  const linhas = aplicarFiltros({ ...params, page: 1, perPage: 1, filters: undefined })

  const soma = (fn: (l: Lancamento) => boolean, valor: (l: Lancamento) => number) =>
    linhas.filter(fn).reduce((s, l) => s + valor(l), 0)

  const aReceber = soma((l) => l.tipo === 'receber' && l.status !== 'cancelado', saldoAberto)
  const aPagar = soma((l) => l.tipo === 'pagar' && l.status !== 'cancelado', saldoAberto)
  const recebido = soma((l) => l.tipo === 'receber', (l) => l.valorPago)
  const pago = soma((l) => l.tipo === 'pagar', (l) => l.valorPago)

  return {
    aReceber,
    aPagar,
    recebido,
    pago,
    vencidoReceber: soma((l) => l.tipo === 'receber' && estaVencido(l), saldoAberto),
    vencidoPagar: soma((l) => l.tipo === 'pagar' && estaVencido(l), saldoAberto),
    saldoPrevisto: aReceber - aPagar,
    saldoRealizado: recebido - pago,
  }
}

/** Fluxo semanal projetado: entradas, saídas e o saldo acumulado. */
export async function fluxoProjetado(semanas = 12) {
  await latencia(280)
  const inicio = somarDias(-7 * 4)
  let acumulado = contas.reduce((s, c) => s + c.saldo, 0)

  return Array.from({ length: semanas }, (_, i) => {
    const de = new Date(inicio)
    de.setDate(de.getDate() + i * 7)
    const ate = new Date(de)
    ate.setDate(ate.getDate() + 6)
    ate.setHours(23, 59, 59, 999)

    const naSemana = lancamentos.filter((l) => {
      const d = new Date(l.pagamentoEm ?? l.vencimento)
      return d >= de && d <= ate && l.status !== 'cancelado'
    })
    const entradas = naSemana.filter((l) => l.tipo === 'receber').reduce((s, l) => s + (l.valorPago || l.valor), 0)
    const saidas = naSemana.filter((l) => l.tipo === 'pagar').reduce((s, l) => s + (l.valorPago || l.valor), 0)
    acumulado += entradas - saidas

    return {
      semana: de.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      entradas,
      saidas: -saidas,
      saldo: acumulado,
      passado: ate < hoje(),
    }
  })
}

export class DuplicidadeError extends Error {
  constructor(public existente: Lancamento) {
    super('POSSIVEL_DUPLICIDADE')
  }
}

/**
 * Criação com recorrência MATERIALIZADA: as N parcelas nascem agora, cada uma
 * com o valor integral da parcela. Guardar só a regra empurra para o futuro a
 * pergunta "quanto tenho a pagar em março?" — que é justamente a pergunta.
 */
export async function criarLancamento(dados: NovoLancamento): Promise<Lancamento[]> {
  await latencia(560)

  if (!dados.confirmarDuplicidade) {
    // Trava anti-duplicidade: mesma contraparte, mesmo valor, vencimento em
    // até 3 dias, ainda em aberto. Lançar a mesma conta duas vezes é o erro
    // mais comum, e o mais caro de achar depois.
    const alvo = new Date(dados.vencimento)
    const existente = lancamentos.find(
      (l) =>
        l.contraparte.toLowerCase() === dados.contraparte.toLowerCase() &&
        Math.abs(l.valor - dados.valor) < 0.01 &&
        l.status !== 'cancelado' &&
        Math.abs(+new Date(l.vencimento) - +alvo) <= 3 * 86400000,
    )
    if (existente) throw new DuplicidadeError(existente)
  }

  const total = dados.recorrencia.ativa ? Math.max(dados.recorrencia.parcelas, 1) : 1
  const serieId = total > 1 ? proximaSerie++ : null
  const base = new Date(dados.vencimento)
  const criados: Lancamento[] = []

  for (let i = 0; i < total; i++) {
    const vencimento =
      dados.recorrencia.periodicidade === 'mensal' ? somarMeses(base, i)
        : dados.recorrencia.periodicidade === 'anual' ? somarMeses(base, i * 12)
        : new Date(base.getTime() + i * 7 * 86400000)

    criados.push(
      criarLinha({
        tipo: dados.tipo,
        descricao: dados.descricao,
        contraparte: dados.contraparte,
        categoriaId: dados.categoriaId,
        competencia: competenciaDe(vencimento),
        vencimento: iso(vencimento),
        valor: dados.valor,
        contaId: dados.contaId,
        observacao: dados.observacao,
        origem: total > 1 ? 'recorrencia' : 'manual',
        serieId,
        parcela: total > 1 ? { numero: i + 1, de: total } : null,
      }),
    )
  }

  lancamentos.push(...criados)
  return criados
}

export const movimentos: MovimentoBancario[] = []
let proximoMovimento = 1

/**
 * Baixa. Move o saldo da conta pelo MESMO caminho do livro-razão (movimento
 * com saldo_após), e lançamento sem conta não move saldo nenhum.
 * Pagamento parcial deixa o registro em 'parcial' com o saldo em aberto.
 */
export async function darBaixa(id: number, baixa: BaixaLancamento): Promise<Lancamento> {
  await latencia(560)
  const lancamento = lancamentos.find((l) => l.id === id)
  if (!lancamento) throw new Error('Lançamento não encontrado.')
  if (lancamento.status === 'pago') throw new Error('Este lançamento já está pago. Para desfazer, estorne.')
  if (lancamento.status === 'cancelado') throw new Error('Lançamento cancelado não recebe baixa.')
  if (!(baixa.valorPago > 0)) throw new Error('O valor pago precisa ser maior que zero.')

  lancamento.valorPago += baixa.valorPago
  lancamento.juros = baixa.juros
  lancamento.desconto = baixa.desconto
  lancamento.pagamentoEm = baixa.pagamentoEm
  lancamento.contaId = baixa.contaId ?? lancamento.contaId
  lancamento.status = saldoAberto(lancamento) <= 0.009 ? 'pago' : 'parcial'

  if (baixa.contaId) {
    const conta = contas.find((c) => c.id === baixa.contaId)
    if (conta) {
      const delta = lancamento.tipo === 'receber' ? baixa.valorPago : -baixa.valorPago
      conta.saldo += delta
      movimentos.unshift({
        id: proximoMovimento++,
        contaId: conta.id,
        data: baixa.pagamentoEm,
        descricao: `${lancamento.tipo === 'receber' ? 'Recebimento' : 'Pagamento'} · ${lancamento.descricao}`,
        valor: delta,
        saldoApos: conta.saldo,
        lancamentoId: lancamento.id,
      })
    }
  }

  return { ...lancamento }
}

/** Registro PAGO é imutável: cancelar exige estornar antes. */
export async function cancelarLancamento(id: number): Promise<void> {
  await latencia(420)
  const lancamento = lancamentos.find((l) => l.id === id)
  if (!lancamento) throw new Error('Lançamento não encontrado.')
  if (lancamento.status === 'pago') throw new Error('Lançamento pago não pode ser cancelado — estorne a baixa antes.')
  lancamento.status = 'cancelado'
}

export async function estornarBaixa(id: number): Promise<void> {
  await latencia(520)
  const lancamento = lancamentos.find((l) => l.id === id)
  if (!lancamento) throw new Error('Lançamento não encontrado.')
  if (lancamento.valorPago <= 0) throw new Error('Não há baixa para estornar.')

  // O estorno também passa pelo livro-razão: nunca se "desfaz" um saldo.
  if (lancamento.contaId) {
    const conta = contas.find((c) => c.id === lancamento.contaId)
    if (conta) {
      const delta = lancamento.tipo === 'receber' ? -lancamento.valorPago : lancamento.valorPago
      conta.saldo += delta
      movimentos.unshift({
        id: proximoMovimento++,
        contaId: conta.id,
        data: iso(hoje()),
        descricao: `Estorno · ${lancamento.descricao}`,
        valor: delta,
        saldoApos: conta.saldo,
        lancamentoId: lancamento.id,
      })
    }
  }

  lancamento.valorPago = 0
  lancamento.pagamentoEm = null
  lancamento.juros = 0
  lancamento.desconto = 0
  lancamento.status = 'pendente'
}

export async function listarCategorias(): Promise<CategoriaFinanceira[]> {
  await latencia(220)
  return categorias.map((c) => ({ ...c }))
}

export async function listarContas(): Promise<ContaBancaria[]> {
  await latencia(240)
  return contas.map((c) => ({ ...c }))
}

export async function extratoConta(contaId: number): Promise<MovimentoBancario[]> {
  await latencia(300)
  return movimentos.filter((m) => m.contaId === contaId)
}

/** Composição por categoria, para o gráfico da visão geral. */
export async function porCategoria(tipo: 'receber' | 'pagar', params: FiltroFinanceiro) {
  await latencia(260)
  const linhas = aplicarFiltros({ ...params, tipo, filters: undefined })
  const mapa = new Map<number, number>()
  linhas.filter((l) => l.status !== 'cancelado').forEach((l) => mapa.set(l.categoriaId, (mapa.get(l.categoriaId) ?? 0) + l.valor))
  return [...mapa.entries()]
    .map(([categoriaId, valor]) => ({ categoria: categorias.find((c) => c.id === categoriaId)?.nome ?? '—', valor }))
    .sort((a, b) => b.valor - a.valor)
}
