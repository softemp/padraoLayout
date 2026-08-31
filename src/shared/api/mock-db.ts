import type {
  Assinatura, AtividadeItem, CanalMensal, CategoriaValor, Cliente, ClienteStatus,
  EventoAuditoria, Kpi, MovimentoConta, Notificacao, SerieMensal, TipoMovimento,
  UsuarioDaConta,
} from './types'

/**
 * "Banco" em memória — dados MOCADOS, sem backend.
 * Gerado por PRNG com semente fixa: a mesma tela em duas máquinas mostra os
 * mesmos números (screenshot de layout não pode mudar a cada refresh).
 */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20260831)
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]
const between = (min: number, max: number) => Math.round(min + rnd() * (max - min))

const NOMES = [
  'Ana Beatriz Coutinho', 'Bruno Salgado Lima', 'Carla Menezes Rocha', 'Diego Ferrari Alves',
  'Eduarda Nunes Prado', 'Felipe Andrade Souza', 'Gabriela Tavares Pinto', 'Henrique Moraes Dias',
  'Isabela Farias Gomes', 'João Vitor Barreto', 'Karina Lopes Siqueira', 'Leandro Peixoto Neves',
  'Mariana Duarte Campos', 'Nicolas Reis Cardoso', 'Olívia Bastos Ramires', 'Paulo Sérgio Fontes',
  'Queila Martins Vieira', 'Rafael Quintana Braga', 'Sofia Vilela Camargo', 'Thiago Assunção Melo',
  'Ursula Bernardes Faro', 'Vinícius Palmeira Cruz', 'Wesley Fagundes Roldão', 'Yasmin Cordeiro Paz',
  'Zeca Antunes Portela', 'Amanda Rezende Vaz', 'Bernardo Coelho Ítalo', 'Camila Bonfim Teixeira',
  'Daniel Aragão Justo', 'Elisa Monteiro Krause',
] as const
const DOMINIOS = ['softemp.com.br', 'empresa.com', 'mail.com', 'grupoatlas.com.br', 'nortesul.co'] as const
const PLANOS = ['Starter', 'Pro', 'Enterprise'] as const
const STATUS: readonly ClienteStatus[] = ['ativo', 'ativo', 'ativo', 'pendente', 'inadimplente', 'inativo']

const slug = (nome: string) =>
  nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(' ').slice(0, 2).join('.')

const diasAtras = (d: number) => new Date(Date.now() - d * 86400000).toISOString()

export const clientes: Cliente[] = Array.from({ length: 247 }, (_, i) => {
  const nome = `${pick(NOMES)}`
  const plano = pick(PLANOS)
  const status = pick(STATUS)
  const base = plano === 'Enterprise' ? between(2400, 9800) : plano === 'Pro' ? between(690, 2300) : between(120, 640)
  return {
    id: i + 1,
    nome,
    email: `${slug(nome)}${i}@${pick(DOMINIOS)}`,
    documento: String(between(10_000_000_000, 99_999_999_999)),
    plano,
    status,
    mrr: status === 'inativo' ? 0 : base,
    criadoEm: diasAtras(between(1, 900)),
    ultimoAcesso: diasAtras(between(0, 60)),
    // Alguns já nascem na lixeira para a aba ter o que mostrar.
    excluidoEm: i % 37 === 5 ? diasAtras(between(1, 45)) : null,
  }
})

export const notificacoes: Notificacao[] = [
  { id: 1, titulo: 'Pagamento confirmado', descricao: 'Enterprise — Grupo Atlas · R$ 8.400,00', criadoEm: diasAtras(0.002), lida: false, tipo: 'sucesso' },
  { id: 2, titulo: 'Fatura vencida', descricao: '3 clientes entraram em inadimplência hoje', criadoEm: diasAtras(0.03), lida: false, tipo: 'alerta' },
  { id: 3, titulo: 'Novo cadastro', descricao: 'Mariana Duarte Campos assinou o plano Pro', criadoEm: diasAtras(0.2), lida: false, tipo: 'info' },
  { id: 4, titulo: 'Integração instável', descricao: 'Webhook do gateway respondeu 502 por 4 min', criadoEm: diasAtras(1), lida: true, tipo: 'critico' },
  { id: 5, titulo: 'Meta do mês atingida', descricao: 'Receita passou de R$ 420 mil (102% da meta)', criadoEm: diasAtras(2), lida: true, tipo: 'sucesso' },
]

const MESES = ['Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago']

export const serieReceita: SerieMensal[] = MESES.map((mes, i) => {
  const tendencia = 262_000 + i * 14_600
  return {
    mes,
    receita: Math.round(tendencia + (rnd() - 0.45) * 26_000),
    meta: Math.round(270_000 + i * 13_000),
  }
})

export const serieCanais: CanalMensal[] = MESES.slice(6).map((mes) => ({
  mes,
  organico: between(38, 62),
  indicacao: between(18, 34),
  midiaPaga: between(22, 46),
}))

export const categorias: CategoriaValor[] = [
  { categoria: 'Assinaturas', valor: 186_400 },
  { categoria: 'Serviços', valor: 121_900 },
  { categoria: 'Implantação', valor: 74_300 },
  { categoria: 'Treinamento', valor: 41_200 },
  { categoria: 'Suporte extra', valor: 28_700 },
  { categoria: 'Outros', valor: 12_400 },
]

const sparkline = (base: number, amp: number) =>
  Array.from({ length: 12 }, (_, i) => Math.round(base + i * amp * 0.35 + (rnd() - 0.5) * amp))

export const kpis: Kpi[] = [
  { id: 'receita', label: 'Receita recorrente', valor: 464_812, formato: 'moeda', delta: 0.126, deltaBom: 'subir', serie: sparkline(340, 40) },
  { id: 'clientes', label: 'Clientes ativos', valor: 1_284, formato: 'numero', delta: 0.048, deltaBom: 'subir', serie: sparkline(980, 90) },
  { id: 'churn', label: 'Churn mensal', valor: 0.019, formato: 'percentual', delta: -0.004, deltaBom: 'descer', serie: sparkline(26, 5) },
  { id: 'ticket', label: 'Ticket médio', valor: 1_642, formato: 'moeda', delta: -0.021, deltaBom: 'subir', serie: sparkline(1700, 120) },
]

export const atividades: AtividadeItem[] = [
  { id: 1, autor: 'Paulo Roberto', acao: 'aprovou o reembolso de', alvo: 'Fatura #10.712', criadoEm: diasAtras(0.01), tipo: 'sucesso' },
  { id: 2, autor: 'Sistema', acao: 'suspendeu o acesso de', alvo: 'Nortesul Ltda (inadimplência)', criadoEm: diasAtras(0.07), tipo: 'alerta' },
  { id: 3, autor: 'Camila Bonfim', acao: 'alterou o plano de', alvo: 'Grupo Atlas → Enterprise', criadoEm: diasAtras(0.3), tipo: 'info' },
  { id: 4, autor: 'Gateway', acao: 'reportou falha em', alvo: '2 cobranças recorrentes', criadoEm: diasAtras(0.9), tipo: 'critico' },
  { id: 5, autor: 'Rafael Quintana', acao: 'criou o cupom', alvo: 'BLACKFRIDAY-30', criadoEm: diasAtras(1.4), tipo: 'info' },
  { id: 6, autor: 'Ana Beatriz', acao: 'concluiu a implantação de', alvo: 'Vilela Camargo ME', criadoEm: diasAtras(2.1), tipo: 'sucesso' },
]

export const metaMes = { atingido: 464_812, meta: 455_000 }

// ── Conta do cliente: livro-razão em memória ─────────────────────────────────

const ledger = new Map<number, MovimentoConta[]>()
let proximoMovimentoId = 1

const CATEGORIAS_CREDITO = ['Pagamento de fatura', 'Estorno de cobrança', 'Bônus comercial', 'Crédito manual'] as const
const CATEGORIAS_DEBITO = ['Mensalidade', 'Serviço avulso', 'Multa por atraso', 'Débito manual'] as const
const AUTORES = ['Paulo Roberto', 'Camila Bonfim', 'Sistema', 'Rafael Quintana'] as const

/**
 * Gera o extrato uma vez por cliente e guarda. O saldo NUNCA é recalculado a
 * partir da soma: cada movimento nasce com o `saldoApos` e é ele que manda —
 * é o que permite auditar "de onde veio esse saldo" linha a linha.
 */
function garantirLedger(clienteId: number): MovimentoConta[] {
  const existente = ledger.get(clienteId)
  if (existente) return existente

  const cliente = clientes.find((c) => c.id === clienteId)
  const quantidade = between(7, 16)
  const movimentos: MovimentoConta[] = []
  let saldo = between(0, 4000)

  for (let i = quantidade; i > 0; i--) {
    const entrada = rnd() > 0.42
    const valorBruto = entrada ? between(200, 6500) : -between(150, (cliente?.mrr || 900) + 800)
    saldo += valorBruto
    movimentos.push({
      id: proximoMovimentoId++,
      criadoEm: diasAtras(i * between(2, 9)),
      tipo: entrada ? (rnd() > 0.75 ? 'estorno' : 'credito') : rnd() > 0.5 ? 'cobranca' : 'debito',
      categoria: entrada ? pick(CATEGORIAS_CREDITO) : pick(CATEGORIAS_DEBITO),
      descricao: entrada ? `Recebimento referente ao ciclo ${i}` : `Cobrança do ciclo ${i}`,
      valor: valorBruto,
      saldoApos: saldo,
      autor: pick(AUTORES),
    })
  }

  const ordenado = movimentos.reverse() // mais recente primeiro
  ledger.set(clienteId, ordenado)
  return ordenado
}

export const extratoDoCliente = (clienteId: number) => {
  const movimentos = garantirLedger(clienteId)
  return { saldo: movimentos[0]?.saldoApos ?? 0, movimentos }
}

/**
 * ÚNICO caminho que mexe no saldo. Grava o movimento com o saldo resultante na
 * mesma operação — quem escrever direto no saldo em outro lugar cria um número
 * que ninguém consegue explicar depois.
 */
export function registrarMovimento(
  clienteId: number,
  dados: { tipo: TipoMovimento; categoria: string; descricao: string; valor: number; autor: string },
): MovimentoConta {
  const movimentos = garantirLedger(clienteId)
  const saldoAtual = movimentos[0]?.saldoApos ?? 0
  const movimento: MovimentoConta = {
    id: proximoMovimentoId++,
    criadoEm: new Date().toISOString(),
    tipo: dados.tipo,
    categoria: dados.categoria,
    descricao: dados.descricao,
    valor: dados.valor,
    saldoApos: saldoAtual + dados.valor,
    autor: dados.autor,
  }
  movimentos.unshift(movimento)
  return movimento
}

export function usuariosDaConta(clienteId: number): UsuarioDaConta[] {
  const cliente = clientes.find((c) => c.id === clienteId)
  const base = cliente?.nome ?? 'Titular'
  const papeis: UsuarioDaConta['papel'][] = ['Titular', 'Financeiro', 'Operador', 'Somente leitura']
  return papeis.slice(0, between(2, 4)).map((papel, i) => ({
    id: clienteId * 10 + i,
    nome: i === 0 ? base : `${pick(NOMES)}`,
    email: i === 0 ? (cliente?.email ?? 'contato@empresa.com') : `usuario${i}.${clienteId}@empresa.com.br`,
    papel,
    ativo: i === 0 ? true : rnd() > 0.25,
    ultimoAcesso: diasAtras(between(0, 40)),
  }))
}

export function assinaturaDoCliente(clienteId: number): Assinatura {
  const cliente = clientes.find((c) => c.id === clienteId)
  const anual = rnd() > 0.7
  return {
    plano: cliente?.plano ?? 'Pro',
    ciclo: anual ? 'Anual' : 'Mensal',
    valor: anual ? (cliente?.mrr ?? 0) * 12 * 0.85 : (cliente?.mrr ?? 0),
    proximaCobranca: new Date(Date.now() + between(2, 28) * 86400000).toISOString(),
    formaPagamento: pick(['Cartão •••• 4417', 'Boleto bancário', 'PIX', 'Cartão •••• 9032'] as const),
    desde: cliente?.criadoEm ?? diasAtras(300),
    renovacaoAutomatica: rnd() > 0.2,
  }
}

export function auditoriaDoCliente(clienteId: number): EventoAuditoria[] {
  const acoes = [
    ['Alterou o plano', 'De Pro para Enterprise'],
    ['Lançou crédito manual', 'R$ 1.200,00 · Bônus comercial'],
    ['Atualizou dados cadastrais', 'E-mail de cobrança alterado'],
    ['Suspendeu o acesso', 'Inadimplência acima de 30 dias'],
    ['Reativou a conta', 'Pagamento confirmado'],
    ['Adicionou usuário', 'Papel: Financeiro'],
  ]
  return acoes.slice(0, between(4, 6)).map(([acao, detalhe], i) => ({
    id: clienteId * 100 + i,
    criadoEm: diasAtras(i * between(3, 12) + 1),
    autor: pick(AUTORES),
    acao,
    detalhe,
  }))
}
