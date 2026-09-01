import type {
  Ausencia, Colaborador, ItemDesligamento, ListParams, ListResponse, PeriodoFerias,
  SituacaoColaborador, TipoContrato, TotaisRh,
} from './types'

/**
 * RH — dados fictícios, com dois temas que o resto do modelo não tinha:
 * dado pessoal restrito na tela e o relógio das férias (que custa dinheiro).
 */
const latencia = (ms = 360) => new Promise((r) => setTimeout(r, ms + Math.random() * 200))

function prng(seed: number) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
}
const rnd = prng(20260909)
const entre = (min: number, max: number) => Math.round(min + rnd() * (max - min))
const escolher = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]
const somarDias = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString() }
const somarAnos = (base: string, anos: number) => { const x = new Date(base); x.setFullYear(x.getFullYear() + anos); return x.toISOString() }

/**
 * PERMISSÃO DE REMUNERAÇÃO. No projeto real vem do RBAC; aqui é um estado da
 * sessão para a tela poder demonstrar os dois lados. O ponto que importa: o
 * salário NÃO viaja para o cliente de quem não pode ver — mascarar no
 * componente deixa o número no HTML de qualquer sessão aberta.
 */
let podeVerRemuneracao = false
export const getPodeVerRemuneracao = () => podeVerRemuneracao
export async function alternarAcessoRemuneracao(valor: boolean) {
  await latencia(220)
  podeVerRemuneracao = valor
}

/** Todo acesso a dado sensível fica registrado — inclusive só olhar. */
export type AcessoSensivel = { id: number; criadoEm: string; autor: string; alvo: string; campo: string }
const acessos: AcessoSensivel[] = []
let proximoAcesso = 1
export async function registrarAcessoSensivel(alvo: string, campo: string) {
  acessos.unshift({ id: proximoAcesso++, criadoEm: new Date().toISOString(), autor: 'Paulo Roberto', alvo, campo })
}
export async function listarAcessosSensiveis(): Promise<AcessoSensivel[]> {
  await latencia(240)
  return acessos.slice(0, 20)
}

const NOMES = [
  'Camila Bonfim Teixeira', 'Rafael Quintana Braga', 'Ana Beatriz Coutinho', 'Diego Ferrari Alves',
  'Mariana Duarte Campos', 'Bruno Salgado Lima', 'Isabela Farias Gomes', 'Henrique Moraes Dias',
  'Sofia Vilela Camargo', 'Thiago Assunção Melo', 'Karina Lopes Siqueira', 'Leandro Peixoto Neves',
  'Gabriela Tavares Pinto', 'Nicolas Reis Cardoso', 'Olívia Bastos Ramires', 'Vinícius Palmeira Cruz',
  'Amanda Rezende Vaz', 'Bernardo Coelho Ítalo', 'Elisa Monteiro Krause', 'Felipe Andrade Souza',
] as const
const CARGOS = ['Desenvolvedor(a)', 'Analista de suporte', 'Analista financeiro', 'Comercial', 'Designer', 'Gerente de projetos', 'Assistente administrativo'] as const
const DEPARTAMENTOS = ['Tecnologia', 'Comercial', 'Financeiro', 'Operações', 'Administrativo'] as const
const CONTRATOS: TipoContrato[] = ['CLT', 'CLT', 'CLT', 'PJ', 'Estágio']

let proximoId = 1
export const colaboradores: Colaborador[] = NOMES.map((nome, i) => {
  const admissao = somarDias(-entre(90, 2600))
  const sorteio = rnd()
  const situacao: SituacaoColaborador =
    sorteio > 0.94 ? 'desligado' : sorteio > 0.88 ? 'aviso_previo' : sorteio > 0.8 ? 'afastado' : sorteio > 0.7 ? 'ferias' : 'ativo'

  return {
    id: proximoId++,
    nome,
    email: `${nome.toLowerCase().split(' ')[0]}@softemp.com.br`,
    cpf: String(entre(10_000_000_000, 99_999_999_999)),
    cargo: escolher(CARGOS),
    departamento: escolher(DEPARTAMENTOS),
    gestor: i < 3 ? 'Paulo Roberto' : escolher(['Paulo Roberto', 'Camila Bonfim Teixeira', 'Rafael Quintana Braga'] as const),
    contrato: escolher(CONTRATOS),
    admissao,
    desligamento: situacao === 'desligado' ? somarDias(-entre(1, 120)) : null,
    situacao,
    salario: entre(220_000, 1_450_000) / 100,
    telefone: `4899${entre(1000000, 9999999)}`,
    localizacao: escolher(['Florianópolis, SC', 'São José, SC', 'Remoto'] as const),
    fotoUrl: null,
  }
})

// ── Férias: o relógio que custa dinheiro ─────────────────────────────────────

const periodos = new Map<number, PeriodoFerias[]>()
let proximoPeriodo = 1

function garantirPeriodos(colaboradorId: number): PeriodoFerias[] {
  const existente = periodos.get(colaboradorId)
  if (existente) return existente
  const colaborador = colaboradores.find((c) => c.id === colaboradorId)
  const lista: PeriodoFerias[] = []

  if (colaborador) {
    const anos = Math.floor((Date.now() - +new Date(colaborador.admissao)) / (365 * 86400000))
    for (let n = 0; n < Math.max(anos, 1); n++) {
      const inicio = somarAnos(colaborador.admissao, n)
      const fim = somarAnos(colaborador.admissao, n + 1)
      const gozados = n < anos - 1 ? 30 : rnd() > 0.5 ? entre(0, 20) : 0
      lista.push({
        id: proximoPeriodo++,
        colaboradorId,
        aquisitivoInicio: inicio,
        aquisitivoFim: fim,
        // Concessivo: 12 meses DEPOIS do fim do aquisitivo.
        concessivoFim: somarAnos(fim, 1),
        diasDireito: 30,
        diasGozados: gozados,
        diasVendidos: 0,
        agendadoPara: null,
      })
    }
  }
  periodos.set(colaboradorId, lista.reverse())
  return periodos.get(colaboradorId)!
}

export const diasEmAberto = (p: PeriodoFerias) => p.diasDireito - p.diasGozados - p.diasVendidos

export const diasParaDobra = (p: PeriodoFerias) =>
  Math.ceil((+new Date(p.concessivoFim) - Date.now()) / 86400000)

/**
 * Em dobra: passou o período concessivo com dias em aberto. A partir daí a
 * empresa paga em dobro — e o número só cresce.
 */
export const emDobra = (p: PeriodoFerias) => diasEmAberto(p) > 0 && diasParaDobra(p) < 0

/**
 * A janela de aviso não é o vencimento: férias precisam ser programadas,
 * comunicadas com 30 dias e caber na escala do time. Avisar no mês da dobra é
 * avisar quando já não dá para conceder.
 */
export const JANELA_AVISO_FERIAS = 120
export const feriasVencendo = (p: PeriodoFerias) =>
  diasEmAberto(p) > 0 && diasParaDobra(p) >= 0 && diasParaDobra(p) <= JANELA_AVISO_FERIAS

export async function obterPeriodosFerias(colaboradorId: number): Promise<PeriodoFerias[]> {
  await latencia(300)
  return garantirPeriodos(colaboradorId)
}

export async function agendarFerias(periodoId: number, inicio: string, dias: number): Promise<void> {
  await latencia(560)
  for (const lista of periodos.values()) {
    const periodo = lista.find((p) => p.id === periodoId)
    if (!periodo) continue
    if (dias > diasEmAberto(periodo)) throw new Error(`Só restam ${diasEmAberto(periodo)} dias neste período aquisitivo.`)
    const daqui = Math.ceil((+new Date(inicio) - Date.now()) / 86400000)
    // Aviso de 30 dias é obrigação legal, não preferência do gestor.
    if (daqui < 30) throw new Error('As férias precisam ser comunicadas com pelo menos 30 dias de antecedência.')
    periodo.agendadoPara = inicio
    return
  }
  throw new Error('Período não encontrado.')
}

// ── Listagem ─────────────────────────────────────────────────────────────────

export async function listarColaboradores(params: ListParams): Promise<ListResponse<Colaborador>> {
  await latencia()
  const { page, perPage, sortBy, sortDir, search, filters } = params
  let linhas = [...colaboradores]

  if (search?.trim()) {
    const q = search.trim().toLowerCase()
    linhas = linhas.filter((c) => c.nome.toLowerCase().includes(q) || c.cargo.toLowerCase().includes(q) || c.email.includes(q))
  }
  if (filters?.situacao) linhas = linhas.filter((c) => c.situacao === filters.situacao)
  if (filters?.departamento) linhas = linhas.filter((c) => c.departamento === filters.departamento)
  if (filters?.contrato) linhas = linhas.filter((c) => c.contrato === filters.contrato)

  const dir = sortDir === 'asc' ? 1 : -1
  linhas.sort((a, b) => {
    const va = a[sortBy as keyof Colaborador]
    const vb = b[sortBy as keyof Colaborador]
    if (va === vb) return a.id - b.id
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va).localeCompare(String(vb), 'pt-BR') * dir
  })

  const total = linhas.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const pagina = Math.min(page, totalPages)

  // MINIMIZAÇÃO: o salário não sai do servidor para quem não pode ver.
  const data = linhas.slice((pagina - 1) * perPage, pagina * perPage).map((c) => ({
    ...c,
    salario: podeVerRemuneracao ? c.salario : null,
  }))

  return { data, meta: { total, totalPages, page: pagina, perPage } }
}

export async function obterColaborador(id: number): Promise<Colaborador> {
  await latencia(260)
  const c = colaboradores.find((x) => x.id === id)
  if (!c) throw new Error('Colaborador não encontrado.')
  if (podeVerRemuneracao) await registrarAcessoSensivel(c.nome, 'remuneração')
  return { ...c, salario: podeVerRemuneracao ? c.salario : null }
}

export async function totaisRh(): Promise<TotaisRh> {
  await latencia(280)
  const ativos = colaboradores.filter((c) => c.situacao !== 'desligado')
  let vencendo = 0
  let dobra = 0
  ativos.forEach((c) => {
    garantirPeriodos(c.id).forEach((p) => {
      if (emDobra(p)) dobra++
      else if (feriasVencendo(p)) vencendo++
    })
  })

  const hoje = new Date()
  return {
    ativos: ativos.length,
    emFerias: colaboradores.filter((c) => c.situacao === 'ferias').length,
    feriasVencendo: vencendo,
    feriasEmDobra: dobra,
    aniversariantes: ativos.filter((c) => new Date(c.admissao).getMonth() === hoje.getMonth()).length,
    custoFolha: podeVerRemuneracao ? ativos.reduce((s, c) => s + (c.salario ?? 0), 0) : null,
  }
}

/** Painel de férias: todo mundo com dias em aberto, do mais urgente ao menos. */
export async function painelFerias() {
  await latencia(420)
  const linhas: { colaborador: Colaborador; periodo: PeriodoFerias }[] = []
  colaboradores
    .filter((c) => c.situacao !== 'desligado')
    .forEach((c) => garantirPeriodos(c.id).filter((p) => diasEmAberto(p) > 0).forEach((p) => linhas.push({ colaborador: c, periodo: p })))
  return linhas.sort((a, b) => diasParaDobra(a.periodo) - diasParaDobra(b.periodo))
}

// ── Ausências ────────────────────────────────────────────────────────────────

const ausencias = new Map<number, Ausencia[]>()
let proximaAusencia = 1

export async function listarAusencias(colaboradorId: number): Promise<Ausencia[]> {
  await latencia(280)
  const existente = ausencias.get(colaboradorId)
  if (existente) return existente
  const lista: Ausencia[] = Array.from({ length: entre(0, 6) }, () => {
    const dias = entre(1, 4)
    const inicio = somarDias(-entre(5, 300))
    return {
      id: proximaAusencia++,
      colaboradorId,
      tipo: escolher(['falta', 'atestado', 'atestado', 'licenca', 'home_office', 'folga'] as const),
      inicio,
      fim: somarDias(-entre(1, 4)),
      dias,
      justificada: rnd() > 0.25,
      observacao: escolher(['Consulta médica', 'Atestado de 2 dias', 'Licença paternidade', 'Trabalho remoto acordado', 'Compensação de banco de horas'] as const),
    }
  })
  ausencias.set(colaboradorId, lista)
  return lista
}

// ── Desligamento: o checklist que atravessa módulos ──────────────────────────

const desligamentos = new Map<number, ItemDesligamento[]>()
let proximoItemDeslig = 1

/**
 * O checklist existe porque desligamento é um evento que espalha efeitos:
 * acesso ao sistema, equipamento no estoque, documentos, financeiro. O item
 * CRÍTICO é o de acesso — conta ativa de quem saiu é a porta que ninguém
 * lembra de fechar.
 */
export async function checklistDesligamento(colaboradorId: number): Promise<ItemDesligamento[]> {
  await latencia(280)
  const existente = desligamentos.get(colaboradorId)
  if (existente) return existente
  const lista: ItemDesligamento[] = [
    { id: proximoItemDeslig++, rotulo: 'Revogar acessos do sistema e encerrar sessões', responsavel: 'TI', feito: false, critico: true },
    { id: proximoItemDeslig++, rotulo: 'Desativar e-mail e redirecionar mensagens', responsavel: 'TI', feito: false, critico: true },
    { id: proximoItemDeslig++, rotulo: 'Recolher equipamentos (notebook, crachá, chip)', responsavel: 'Administrativo', feito: false, critico: false },
    { id: proximoItemDeslig++, rotulo: 'Transferir tarefas e contas sob responsabilidade', responsavel: 'Gestor direto', feito: false, critico: true },
    { id: proximoItemDeslig++, rotulo: 'Entrevista de desligamento', responsavel: 'RH', feito: false, critico: false },
    { id: proximoItemDeslig++, rotulo: 'Rescisão e homologação', responsavel: 'RH', feito: false, critico: true },
    { id: proximoItemDeslig++, rotulo: 'Arquivar documentos do colaborador', responsavel: 'RH', feito: false, critico: false },
  ]
  desligamentos.set(colaboradorId, lista)
  return lista
}

export async function alternarItemDesligamento(colaboradorId: number, itemId: number): Promise<void> {
  await latencia(240)
  const item = desligamentos.get(colaboradorId)?.find((i) => i.id === itemId)
  if (item) item.feito = !item.feito
}

export const departamentos = [...DEPARTAMENTOS]
export const cargos = [...CARGOS]
