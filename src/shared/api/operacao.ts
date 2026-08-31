import { clientes } from './mock-db'
import type {
  EventoSistema, Fatura, Integracao, LancamentoBanco, LancamentoSistema, ListParams, ListResponse,
  ParConciliacao, Recebimento, StatusFatura, TotaisFaturas,
} from './types'

/** Dados fictícios da operação — mesmo PRNG com semente, mesma latência falsa. */
const latencia = (ms = 380) => new Promise((r) => setTimeout(r, ms + Math.random() * 220))

function prng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}
const rnd = prng(20260901)
const entre = (min: number, max: number) => Math.round(min + rnd() * (max - min))
const escolher = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]
const diasAtras = (d: number) => new Date(Date.now() - d * 86400000).toISOString()
const diasAFrente = (d: number) => new Date(Date.now() + d * 86400000).toISOString()

const MEIOS = ['Boleto', 'PIX', 'Cartão', 'Transferência'] as const
const ativos = clientes.filter((c) => c.excluidoEm === null)

export const faturas: Fatura[] = Array.from({ length: 186 }, (_, i) => {
  const cliente = ativos[i % ativos.length]
  const emissaoDias = entre(1, 180)
  const vencimentoDias = emissaoDias - 30
  const sorteio = rnd()
  const status: StatusFatura =
    sorteio > 0.78 ? 'aberta' : sorteio > 0.66 ? 'vencida' : sorteio > 0.63 ? 'cancelada' : 'paga'

  return {
    id: i + 1,
    numero: `FAT-${String(10_000 + i)}`,
    clienteId: cliente.id,
    cliente: cliente.nome,
    emissao: diasAtras(emissaoDias),
    vencimento: vencimentoDias > 0 ? diasAtras(vencimentoDias) : diasAFrente(-vencimentoDias),
    pagamentoEm: status === 'paga' ? diasAtras(Math.max(vencimentoDias - entre(0, 8), 0)) : null,
    valor: cliente.mrr || entre(180, 3200),
    status,
    formaPagamento: escolher(MEIOS),
  }
})

export async function listarFaturas(params: ListParams): Promise<ListResponse<Fatura>> {
  await latencia()
  const { page, perPage, sortBy, sortDir, search, filters } = params
  let linhas = [...faturas]

  if (search?.trim()) {
    const q = search.trim().toLowerCase()
    linhas = linhas.filter((f) => f.numero.toLowerCase().includes(q) || f.cliente.toLowerCase().includes(q))
  }
  if (filters?.status) linhas = linhas.filter((f) => f.status === filters.status)
  if (filters?.meio) linhas = linhas.filter((f) => f.formaPagamento === filters.meio)

  const dir = sortDir === 'asc' ? 1 : -1
  linhas.sort((a, b) => {
    const va = a[sortBy as keyof Fatura]
    const vb = b[sortBy as keyof Fatura]
    if (va === vb) return a.id - b.id
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va).localeCompare(String(vb), 'pt-BR') * dir
  })

  const total = linhas.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const pagina = Math.min(page, totalPages)
  return {
    data: linhas.slice((pagina - 1) * perPage, pagina * perPage),
    meta: { total, totalPages, page: pagina, perPage },
  }
}

/** Totais do RECORTE inteiro, não da página: totalizador de página engana. */
export async function totaisFaturas(filtros?: Record<string, string | undefined>): Promise<TotaisFaturas> {
  await latencia(240)
  let linhas = faturas
  if (filtros?.status) linhas = linhas.filter((f) => f.status === filtros.status)
  if (filtros?.meio) linhas = linhas.filter((f) => f.formaPagamento === filtros.meio)

  const inicioMes = new Date()
  inicioMes.setDate(1)
  return {
    aberto: linhas.filter((f) => f.status === 'aberta').reduce((s, f) => s + f.valor, 0),
    vencido: linhas.filter((f) => f.status === 'vencida').reduce((s, f) => s + f.valor, 0),
    recebidoMes: linhas
      .filter((f) => f.pagamentoEm && new Date(f.pagamentoEm) >= inicioMes)
      .reduce((s, f) => s + f.valor, 0),
    quantidade: linhas.length,
  }
}

export async function marcarFaturaPaga(id: number): Promise<void> {
  await latencia(420)
  const fatura = faturas.find((f) => f.id === id)
  if (!fatura) throw new Error('Fatura não encontrada.')
  if (fatura.status === 'cancelada') throw new Error('Fatura cancelada não recebe baixa.')
  fatura.status = 'paga'
  fatura.pagamentoEm = new Date().toISOString()
}

// ── Recebimentos ─────────────────────────────────────────────────────────────

export const recebimentos: Recebimento[] = faturas
  .filter((f) => f.pagamentoEm)
  .slice(0, 60)
  .map((f, i) => ({
    id: i + 1,
    data: f.pagamentoEm!,
    cliente: f.cliente,
    faturaNumero: f.numero,
    valor: f.valor,
    meio: f.formaPagamento,
    conta: escolher(['Itaú · 1234-5', 'Bradesco · 8890-1', 'Conta PIX SoftEmp'] as const),
  }))
  .sort((a, b) => +new Date(b.data) - +new Date(a.data))

/** Série diária dos últimos 30 dias, para o gráfico da tela. */
export const serieRecebimentos = Array.from({ length: 30 }, (_, i) => {
  const dia = new Date(Date.now() - (29 - i) * 86400000)
  const doDia = recebimentos.filter((r) => new Date(r.data).toDateString() === dia.toDateString())
  return {
    dia: dia.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    valor: doDia.reduce((s, r) => s + r.valor, 0) || entre(2_000, 26_000),
  }
})

export async function listarRecebimentos(): Promise<Recebimento[]> {
  await latencia(320)
  return recebimentos
}

// ── Conciliação ──────────────────────────────────────────────────────────────

const banco: LancamentoBanco[] = Array.from({ length: 14 }, (_, i) => ({
  id: i + 1,
  data: diasAtras(entre(0, 12)),
  descricao: escolher([
    'TED RECEBIDA', 'PIX RECEBIDO', 'LIQUIDACAO BOLETO', 'CREDITO CARTAO',
    'TARIFA MENSAL', 'DEB AUTOMATICO ENERGIA',
  ] as const),
  valor: rnd() > 0.2 ? entre(400, 9800) : -entre(80, 1400),
  documento: `DOC${entre(100000, 999999)}`,
}))

const sistema: LancamentoSistema[] = banco.slice(0, 10).map((b, i) => ({
  id: i + 1,
  data: b.data,
  descricao: b.valor > 0 ? `Recebimento fatura FAT-${10_000 + i}` : `Despesa operacional ${i + 1}`,
  // Alguns saem com centavos diferentes de propósito: é o caso que a tela precisa mostrar.
  valor: i % 5 === 3 ? b.valor + entre(1, 40) : b.valor,
  origem: b.valor > 0 ? 'Faturamento' : 'Contas a pagar',
}))

export async function listarConciliacao(): Promise<ParConciliacao[]> {
  await latencia(420)
  return banco.map((b, i) => {
    const par = sistema.find((s) => s.data === b.data && Math.abs(s.valor - b.valor) < 60) ?? null
    const exato = par ? par.valor === b.valor : false
    return {
      banco: b,
      sistema: par,
      confianca: par ? (exato ? 1 : 0.72) : 0,
      situacao: !par ? 'sem_par' : i % 4 === 0 ? 'conciliado' : 'sugerido',
    }
  })
}

export async function conciliarPar(bancoId: number): Promise<void> {
  await latencia(360)
  if (!banco.find((b) => b.id === bancoId)) throw new Error('Lançamento não encontrado.')
}

// ── Auditoria ────────────────────────────────────────────────────────────────

const MODULOS_AUDIT = ['Clientes', 'Financeiro', 'Acessos', 'Configurações', 'Relatórios'] as const
const AUTORES = ['Paulo Roberto', 'Camila Bonfim', 'Rafael Quintana', 'Ana Beatriz', 'Sistema'] as const
const ACOES_AUDIT = ['criou', 'editou', 'excluiu', 'exportou', 'acessou', 'falhou'] as const

export const eventos: EventoSistema[] = Array.from({ length: 84 }, (_, i) => {
  const acao = escolher(ACOES_AUDIT)
  const modulo = escolher(MODULOS_AUDIT)
  return {
    id: i + 1,
    criadoEm: diasAtras(i * 0.3 + rnd()),
    autor: escolher(AUTORES),
    modulo,
    acao,
    alvo:
      modulo === 'Clientes' ? escolher(ativos).nome
        : modulo === 'Financeiro' ? `FAT-${entre(10000, 10186)}`
        : modulo === 'Acessos' ? escolher(['papel financeiro', 'papel suporte', 'usuário camila@softemp.com.br'] as const)
        : escolher(['SMTP', 'API de WhatsApp', 'Gateway SMS'] as const),
    ip: `189.${entre(1, 254)}.${entre(1, 254)}.${entre(1, 254)}`,
    antes: acao === 'editou' ? escolher(['plano: Pro', 'status: pendente', 'limite: R$ 5.000,00'] as const) : undefined,
    depois: acao === 'editou' ? escolher(['plano: Enterprise', 'status: ativo', 'limite: R$ 12.000,00'] as const) : undefined,
  }
})

export async function listarEventos(filtros: { autor?: string; modulo?: string; acao?: string }): Promise<EventoSistema[]> {
  await latencia(360)
  return eventos.filter(
    (e) =>
      (!filtros.autor || e.autor === filtros.autor) &&
      (!filtros.modulo || e.modulo === filtros.modulo) &&
      (!filtros.acao || e.acao === filtros.acao),
  )
}

export const autoresAuditoria = [...AUTORES]
export const modulosAuditoria = [...MODULOS_AUDIT]
export const acoesAuditoria = [...ACOES_AUDIT]

// ── Integrações ──────────────────────────────────────────────────────────────

export async function listarIntegracoes(): Promise<Integracao[]> {
  await latencia(300)
  return [
    { id: 'gateway', nome: 'Gateway de pagamento', categoria: 'Financeiro', icone: '💳', descricao: 'Cobrança por PIX, boleto e cartão', situacao: 'conectada', ultimaVerificacao: diasAtras(0.02) },
    { id: 'whatsapp', nome: 'API de WhatsApp', categoria: 'Comunicação', icone: '💬', descricao: 'Envio de mensagens e link de recuperação', situacao: 'conectada', ultimaVerificacao: diasAtras(0.1) },
    { id: 'sms', nome: 'Gateway de SMS', categoria: 'Comunicação', icone: '📱', descricao: 'Mensagem de texto e segundo fator', situacao: 'falha', ultimaVerificacao: diasAtras(1.2) },
    { id: 'smtp', nome: 'Servidor de e-mail', categoria: 'Comunicação', icone: '✉️', descricao: 'Avisos transacionais e recuperação de senha', situacao: 'conectada', ultimaVerificacao: diasAtras(0.4) },
    { id: 'erp', nome: 'ERP contábil', categoria: 'Retaguarda', icone: '📚', descricao: 'Exportação de lançamentos para a contabilidade', situacao: 'nao_configurada', ultimaVerificacao: null },
    { id: 'bi', nome: 'Data warehouse', categoria: 'Dados', icone: '📈', descricao: 'Carga diária para o BI', situacao: 'nao_configurada', ultimaVerificacao: null },
  ]
}
