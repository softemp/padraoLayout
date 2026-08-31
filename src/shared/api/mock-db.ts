import type {
  AtividadeItem, CanalMensal, CategoriaValor, Cliente, ClienteStatus,
  Kpi, Notificacao, SerieMensal,
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
