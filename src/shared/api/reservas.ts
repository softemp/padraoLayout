import type {
  CanalReserva, Comodidade, Diaria, LinhaMapa, Reserva, SituacaoReserva, TipoUnidade,
  TotaisReservas, UnidadeHospedagem,
} from './types'

/**
 * Reservas de hospedagem — o módulo inteiro depende de acertar UMA unidade:
 *
 *   o que se vende é a NOITE, não o dia.
 *
 * Reserva de 10 a 12 de março são DUAS diárias (as noites de 10 e de 11): o dia
 * 12 é só a data em que o hóspede vai embora. Contar por diferença de datas com
 * hora dá 2 ou 3 dependendo do horário digitado — e é assim que nasce a briga no
 * balcão. O intervalo é SEMI-ABERTO: [entrada, saída).
 *
 * Consequência direta: a saída de uma reserva e a entrada de outra podem cair no
 * MESMO dia sem conflito nenhum. É o normal de qualquer hotel — e é exatamente o
 * caso que a comparação ingênua de datas trata como overbooking.
 */
const latencia = (ms = 300) => new Promise((r) => setTimeout(r, ms + Math.random() * 200))

function prng(seed: number) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
}
const rnd = prng(20260902)
const entre = (min: number, max: number) => Math.round(min + rnd() * (max - min))
const escolher = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]

/** Horários da casa. Mudam por propriedade — não são constante de código escondida. */
export const HORARIOS = { entrada: '14:00', saida: '12:00', toleranciaSaidaMin: 30 }

/** Prazo de cancelamento sem cobrança, em dias antes da entrada. */
export const POLITICA = { cancelamentoDias: 3, multaPercentual: 0.5, noShowPercentual: 1 }

export const dia = (d: string | Date) => new Date(d).toISOString().slice(0, 10)
export const hoje = () => dia(new Date())
const maisDias = (base: string, n: number) => dia(new Date(+new Date(`${base}T12:00:00`) + n * 86400000))

/** Noites entre duas datas. É a unidade que se cobra, e a única que se conta. */
export const noites = (entrada: string, saida: string) =>
  Math.round((+new Date(`${dia(saida)}T12:00:00`) - +new Date(`${dia(entrada)}T12:00:00`)) / 86400000)

/**
 * Conflito em intervalo SEMI-ABERTO. Trocar `<` por `<=` aqui é o bug clássico
 * da hotelaria: bloqueia a diária de quem entra no mesmo dia em que o anterior
 * sai, e o quarto fica vazio uma noite por engano.
 */
export const conflita = (aEntrada: string, aSaida: string, bEntrada: string, bSaida: string) =>
  dia(aEntrada) < dia(bSaida) && dia(aSaida) > dia(bEntrada)

const COMODIDADES_POR_TIPO: Record<TipoUnidade, Comodidade[]> = {
  quarto: ['ar_condicionado', 'wifi', 'tv', 'frigobar'],
  suite: ['ar_condicionado', 'wifi', 'tv', 'frigobar', 'hidro', 'varanda'],
  chale: ['wifi', 'tv', 'cozinha', 'lareira', 'varanda', 'churrasqueira'],
  cabana: ['wifi', 'cozinha', 'lareira', 'churrasqueira', 'aceita_pet', 'estacionamento'],
}

const inventarioPadrao = (base: number, tipo: TipoUnidade) => {
  const itens = [
    { nome: 'Jogo de toalhas', quantidade: 4, conferirNaSaida: true, valorReposicao: 45 },
    { nome: 'Jogo de cama', quantidade: 2, conferirNaSaida: true, valorReposicao: 180 },
    { nome: 'Controle remoto da TV', quantidade: 1, conferirNaSaida: true, valorReposicao: 60 },
    { nome: 'Secador de cabelo', quantidade: 1, conferirNaSaida: true, valorReposicao: 90 },
    { nome: 'Cabides', quantidade: 8, conferirNaSaida: false, valorReposicao: 6 },
    { nome: 'Taças', quantidade: 2, conferirNaSaida: true, valorReposicao: 28 },
  ]
  if (tipo === 'chale' || tipo === 'cabana') {
    itens.push(
      { nome: 'Jogo de panelas', quantidade: 1, conferirNaSaida: true, valorReposicao: 320 },
      { nome: 'Grelha da churrasqueira', quantidade: 1, conferirNaSaida: true, valorReposicao: 110 },
    )
  }
  return itens.map((it, i) => ({ id: base * 100 + i, ...it }))
}

const NOMES: { nome: string; tipo: TipoUnidade; cap: number; camas: string; tarifa: number }[] = [
  { nome: 'Quarto 101', tipo: 'quarto', cap: 2, camas: '1 casal', tarifa: 320 },
  { nome: 'Quarto 102', tipo: 'quarto', cap: 3, camas: '1 casal + 1 solteiro', tarifa: 380 },
  { nome: 'Quarto 103', tipo: 'quarto', cap: 2, camas: '2 solteiros', tarifa: 320 },
  { nome: 'Quarto 104', tipo: 'quarto', cap: 4, camas: '2 casais', tarifa: 460 },
  { nome: 'Suíte Master', tipo: 'suite', cap: 2, camas: '1 king', tarifa: 690 },
  { nome: 'Suíte Vista', tipo: 'suite', cap: 3, camas: '1 king + 1 solteiro', tarifa: 780 },
  { nome: 'Chalé Araucária', tipo: 'chale', cap: 4, camas: '1 casal + 2 solteiros', tarifa: 620 },
  { nome: 'Chalé Ipê', tipo: 'chale', cap: 4, camas: '1 casal + 2 solteiros', tarifa: 620 },
  { nome: 'Chalé Cedro', tipo: 'chale', cap: 6, camas: '2 casais + 2 solteiros', tarifa: 890 },
  { nome: 'Cabana do Lago', tipo: 'cabana', cap: 2, camas: '1 casal', tarifa: 540 },
  { nome: 'Cabana da Trilha', tipo: 'cabana', cap: 4, camas: '1 casal + beliche', tarifa: 700 },
  { nome: 'Cabana do Bosque', tipo: 'cabana', cap: 2, camas: '1 queen', tarifa: 580 },
]

export const unidades: UnidadeHospedagem[] = NOMES.map((u, i) => ({
  id: i + 1,
  nome: u.nome,
  tipo: u.tipo,
  capacidade: u.cap,
  camas: u.camas,
  tarifaBase: u.tarifa,
  comodidades: COMODIDADES_POR_TIPO[u.tipo],
  inventario: inventarioPadrao(i + 1, u.tipo),
  ativa: true,
  observacao: i === 3 ? 'Chuveiro trocado em julho' : null,
}))

const HOSPEDES = [
  'Marcos Vinícius Prado', 'Letícia Andrade', 'Família Doriano', 'Rogério Sampaio',
  'Bianca Toledo', 'Eduardo Nakamura', 'Cláudia Ferreira', 'Túlio Mendes',
  'Renata Vasconcelos', 'Grupo Trilha Sul', 'Paulo e Adriana', 'Ivo Barreto',
]
const CANAIS: CanalReserva[] = ['direto', 'telefone', 'site', 'ota', 'balcao']

/**
 * A tarifa da noite varia (fim de semana, temporada) e é COPIADA em cada diária.
 * Corrigir a tabela amanhã não pode reescrever a conta de quem já reservou.
 */
export function tarifaDaNoite(unidade: UnidadeHospedagem, data: string) {
  const d = new Date(`${data}T12:00:00`).getDay()
  const fimDeSemana = d === 5 || d === 6
  const alta = ['12', '01', '02', '07'].includes(data.slice(5, 7))
  return Math.round(unidade.tarifaBase * (fimDeSemana ? 1.25 : 1) * (alta ? 1.35 : 1))
}

const montarDiarias = (unidade: UnidadeHospedagem, entrada: string, saida: string): Diaria[] =>
  Array.from({ length: Math.max(0, noites(entrada, saida)) }, (_, i) => {
    const data = maisDias(entrada, i)
    return { data, valor: tarifaDaNoite(unidade, data) }
  })

let seq = 1
export const reservas: Reserva[] = []

function semear() {
  const base = maisDias(hoje(), -6)
  unidades.forEach((u) => {
    let cursor = entre(0, 3)
    while (cursor < 26) {
      const entrada = maisDias(base, cursor)
      const n = entre(1, 4)
      const saida = maisDias(entrada, n)
      const passado = new Date(`${saida}T12:00:00`) < new Date(`${hoje()}T12:00:00`)
      const chegando = new Date(`${entrada}T12:00:00`) > new Date(`${hoje()}T12:00:00`)
      const bloqueio = rnd() > 0.93
      const diarias = montarDiarias(u, entrada, saida)

      reservas.push({
        id: seq,
        codigo: `RS-${String(1400 + seq).padStart(4, '0')}`,
        unidadeId: u.id,
        origem: bloqueio ? 'bloqueio' : 'hospede',
        hospede: bloqueio ? null : escolher(HOSPEDES),
        documento: bloqueio ? null : `${entre(100, 999)}.${entre(100, 999)}.${entre(100, 999)}-${entre(10, 99)}`,
        telefone: bloqueio ? null : `(48) 9${entre(1000, 9999)}-${entre(1000, 9999)}`,
        adultos: bloqueio ? 0 : Math.min(u.capacidade, entre(1, 3)),
        criancas: bloqueio ? 0 : (rnd() > 0.7 ? entre(1, 2) : 0),
        entrada, saida,
        situacao: bloqueio ? 'confirmada' : passado ? 'finalizada' : chegando ? (rnd() > 0.25 ? 'confirmada' : 'pre_reserva') : 'hospedado',
        canal: escolher(CANAIS),
        diarias,
        valorDiarias: bloqueio ? 0 : diarias.reduce((s, d) => s + d.valor, 0),
        valorExtras: bloqueio ? 0 : (rnd() > 0.6 ? entre(40, 260) : 0),
        checkinReal: passado || !chegando ? `${entrada}T${HORARIOS.entrada}:00` : null,
        checkoutReal: passado ? `${saida}T${HORARIOS.saida}:00` : null,
        motivo: bloqueio ? escolher(['Manutenção do ar-condicionado', 'Pintura', 'Uso da equipe']) : null,
        observacao: null,
        criadaEm: maisDias(entrada, -entre(2, 40)),
      })
      seq += 1
      cursor += n + entre(1, 3)
    }
  })
}
semear()

const ocupa = (r: Reserva) => r.situacao !== 'cancelada' && r.situacao !== 'no_show'

/**
 * Disponibilidade é DERIVADA das reservas, nunca um campo `ocupado` na unidade.
 * Campo dessincroniza no primeiro cancelamento que ninguém propagou — e aí o
 * quarto vazio some do mapa.
 */
export function unidadeLivre(unidadeId: number, entrada: string, saida: string, ignorarId?: number) {
  return !reservas.some(
    (r) => r.unidadeId === unidadeId && r.id !== ignorarId && ocupa(r) && conflita(entrada, saida, r.entrada, r.saida),
  )
}

export async function unidadesDisponiveis(entrada: string, saida: string, hospedes = 1): Promise<UnidadeHospedagem[]> {
  await latencia()
  return unidades.filter((u) => u.ativa && u.capacidade >= hospedes && unidadeLivre(u.id, entrada, saida))
}

export async function listarUnidades(): Promise<UnidadeHospedagem[]> {
  await latencia(240)
  return [...unidades]
}

export async function listarReservas(filtro?: { situacao?: SituacaoReserva; busca?: string }): Promise<Reserva[]> {
  await latencia(280)
  const termo = filtro?.busca?.trim().toLowerCase() ?? ''
  return reservas
    .filter((r) => !filtro?.situacao || r.situacao === filtro.situacao)
    .filter((r) => !termo || `${r.codigo} ${r.hospede ?? ''} ${r.motivo ?? ''}`.toLowerCase().includes(termo))
    .sort((a, b) => a.entrada.localeCompare(b.entrada))
}

export async function obterReserva(id: number): Promise<Reserva> {
  await latencia(200)
  const r = reservas.find((x) => x.id === id)
  if (!r) throw new Error('Reserva não encontrada.')
  return r
}

/** O mapa de ocupação: unidades × noites. É a tela que a recepção olha o dia todo. */
export async function mapaOcupacao(inicio: string, dias: number): Promise<LinhaMapa[]> {
  await latencia(320)
  const datas = Array.from({ length: dias }, (_, i) => maisDias(inicio, i))
  return unidades.map((unidade) => ({
    unidade,
    celulas: datas.map((data) => {
      const r = reservas.find(
        (x) => x.unidadeId === unidade.id && ocupa(x) && data >= dia(x.entrada) && data < dia(x.saida),
      )
      return { data, reserva: r ?? null, inicio: !!r && dia(r.entrada) === data }
    }),
  }))
}

export type NovaReserva = {
  unidadeId: number
  hospede: string
  documento?: string
  telefone?: string
  adultos: number
  criancas: number
  entrada: string
  saida: string
  canal: CanalReserva
  observacao?: string
}

export async function criarReserva(dados: NovaReserva): Promise<Reserva> {
  await latencia(520)
  const unidade = unidades.find((u) => u.id === dados.unidadeId)
  if (!unidade) throw new Error('Unidade não encontrada.')
  if (!unidade.ativa) throw new Error(`${unidade.nome} está fora de operação.`)
  if (!dados.hospede.trim()) throw new Error('Informe o nome do hóspede.')

  const n = noites(dados.entrada, dados.saida)
  if (n < 1) {
    throw new Error('A saída precisa ser pelo menos um dia depois da entrada: o que se vende é a noite, e uma reserva sem noite não existe.')
  }
  const pessoas = dados.adultos + dados.criancas
  if (pessoas > unidade.capacidade) {
    throw new Error(`${unidade.nome} acomoda ${unidade.capacidade} pessoas e a reserva tem ${pessoas}. Escolha outra unidade ou divida o grupo.`)
  }
  if (!unidadeLivre(unidade.id, dados.entrada, dados.saida)) {
    const conflito = reservas.find((r) => r.unidadeId === unidade.id && ocupa(r) && conflita(dados.entrada, dados.saida, r.entrada, r.saida))!
    throw new Error(`${unidade.nome} já tem ${conflito.codigo} de ${conflito.entrada} a ${conflito.saida}. Lembre: quem sai dia ${conflito.saida} libera a unidade nesse mesmo dia.`)
  }

  const diarias = montarDiarias(unidade, dados.entrada, dados.saida)
  const nova: Reserva = {
    id: ++seq,
    codigo: `RS-${String(1400 + seq).padStart(4, '0')}`,
    unidadeId: unidade.id,
    origem: 'hospede',
    hospede: dados.hospede.trim(),
    documento: dados.documento?.trim() || null,
    telefone: dados.telefone?.trim() || null,
    adultos: dados.adultos,
    criancas: dados.criancas,
    entrada: dia(dados.entrada),
    saida: dia(dados.saida),
    situacao: 'pre_reserva',
    canal: dados.canal,
    diarias,
    valorDiarias: diarias.reduce((s, d) => s + d.valor, 0),
    valorExtras: 0,
    checkinReal: null,
    checkoutReal: null,
    motivo: null,
    observacao: dados.observacao?.trim() || null,
    criadaEm: new Date().toISOString(),
  }
  reservas.push(nova)
  return nova
}

/**
 * Bloqueio (manutenção, uso da equipe, reforma) é uma OCUPAÇÃO como qualquer
 * outra — não um estado da unidade. Estado separado cria duas fontes de verdade
 * sobre disponibilidade, e uma delas sempre mente.
 */
export async function bloquearUnidade(unidadeId: number, entrada: string, saida: string, motivo: string): Promise<void> {
  await latencia(420)
  if (motivo.trim().length < 5) throw new Error('Diga o motivo do bloqueio — bloqueio sem motivo vira quarto perdido.')
  if (noites(entrada, saida) < 1) throw new Error('O bloqueio precisa cobrir pelo menos uma noite.')
  if (!unidadeLivre(unidadeId, entrada, saida)) throw new Error('Há reserva nesse período. Realoque o hóspede antes de bloquear.')
  const unidade = unidades.find((u) => u.id === unidadeId)!
  reservas.push({
    id: ++seq, codigo: `BL-${String(1400 + seq).padStart(4, '0')}`, unidadeId, origem: 'bloqueio',
    hospede: null, documento: null, telefone: null, adultos: 0, criancas: 0,
    entrada: dia(entrada), saida: dia(saida), situacao: 'confirmada', canal: 'direto',
    diarias: montarDiarias(unidade, entrada, saida).map((d) => ({ ...d, valor: 0 })),
    valorDiarias: 0, valorExtras: 0, checkinReal: null, checkoutReal: null,
    motivo: motivo.trim(), observacao: null, criadaEm: new Date().toISOString(),
  })
}

export async function confirmarReserva(id: number): Promise<void> {
  await latencia(360)
  const r = reservas.find((x) => x.id === id)
  if (!r) throw new Error('Reserva não encontrada.')
  if (r.situacao !== 'pre_reserva') throw new Error('Só pré-reserva se confirma.')
  if (!unidadeLivre(r.unidadeId, r.entrada, r.saida, r.id)) {
    throw new Error('Outra reserva ocupou o período enquanto esta esperava. Realoque antes de confirmar.')
  }
  r.situacao = 'confirmada'
}

/** Check-in é EVENTO, não a data prevista: guarda-se a hora real. */
export async function fazerCheckin(id: number): Promise<void> {
  await latencia(420)
  const r = reservas.find((x) => x.id === id)
  if (!r) throw new Error('Reserva não encontrada.')
  if (r.origem === 'bloqueio') throw new Error('Bloqueio não tem check-in.')
  if (r.situacao !== 'confirmada') throw new Error('Só reserva confirmada faz check-in — pré-reserva precisa ser confirmada antes.')
  if (dia(r.entrada) > hoje()) throw new Error(`A entrada é ${r.entrada}. Antecipar exige rever as diárias, não só abrir a porta.`)
  r.situacao = 'hospedado'
  r.checkinReal = new Date().toISOString()
}

export async function fazerCheckout(id: number, extras = 0): Promise<{ lateCheckout: boolean }> {
  await latencia(460)
  const r = reservas.find((x) => x.id === id)
  if (!r) throw new Error('Reserva não encontrada.')
  if (r.situacao !== 'hospedado') throw new Error('Só quem está hospedado faz check-out.')
  const agora = new Date()
  const limite = new Date(`${hoje()}T${HORARIOS.saida}:00`)
  limite.setMinutes(limite.getMinutes() + HORARIOS.toleranciaSaidaMin)
  const lateCheckout = agora > limite && hoje() >= dia(r.saida)

  r.situacao = 'finalizada'
  r.checkoutReal = agora.toISOString()
  r.valorExtras += extras
  return { lateCheckout }
}

export async function cancelarReserva(id: number, motivo: string): Promise<{ multa: number }> {
  await latencia(420)
  const r = reservas.find((x) => x.id === id)
  if (!r) throw new Error('Reserva não encontrada.')
  if (r.situacao === 'hospedado') throw new Error('Hóspede em casa não se cancela: faça o check-out.')
  if (r.situacao === 'finalizada') throw new Error('Estadia finalizada não se cancela.')
  if (motivo.trim().length < 5) throw new Error('Informe o motivo do cancelamento.')

  const faltam = Math.round((+new Date(`${r.entrada}T12:00:00`) - +new Date(`${hoje()}T12:00:00`)) / 86400000)
  const multa = faltam < POLITICA.cancelamentoDias ? Math.round(r.valorDiarias * POLITICA.multaPercentual) : 0
  r.situacao = 'cancelada'
  r.motivo = motivo.trim()
  // A unidade volta ao mapa na hora: disponibilidade é derivada, não há flag a limpar.
  return { multa }
}

export async function marcarNoShow(id: number): Promise<void> {
  await latencia(340)
  const r = reservas.find((x) => x.id === id)
  if (!r) throw new Error('Reserva não encontrada.')
  if (r.situacao !== 'confirmada') throw new Error('Só reserva confirmada vira no-show.')
  if (dia(r.entrada) >= hoje()) throw new Error('No-show só depois de passada a data de entrada.')
  r.situacao = 'no_show'
  r.motivo = 'Não compareceu'
}

export async function salvarUnidade(id: number, dados: Partial<UnidadeHospedagem>): Promise<void> {
  await latencia(380)
  const u = unidades.find((x) => x.id === id)
  if (!u) throw new Error('Unidade não encontrada.')
  if (dados.capacidade !== undefined && dados.capacidade < 1) throw new Error('Capacidade mínima é 1.')
  if (dados.ativa === false) {
    const futura = reservas.find((r) => r.unidadeId === id && ocupa(r) && dia(r.saida) > hoje() && r.origem === 'hospede')
    if (futura) throw new Error(`${u.nome} tem a reserva ${futura.codigo} até ${futura.saida}. Realoque antes de desativar.`)
  }
  Object.assign(u, dados)
}

/**
 * Ocupação sozinha mente: enche-se um hotel dando desconto. O par é ocupação ×
 * diária média, e o número que junta os dois é a receita por unidade disponível.
 */
export async function totaisReservas(): Promise<TotaisReservas> {
  await latencia(300)
  const inicio = hoje()
  const janela = 30
  const ativas = unidades.filter((u) => u.ativa)
  const noitesDisponiveis = ativas.length * janela
  const vendidas = reservas
    .filter((r) => r.origem === 'hospede' && ocupa(r))
    .flatMap((r) => r.diarias)
    .filter((d) => d.data >= inicio && d.data < maisDias(inicio, janela))

  const receita = vendidas.reduce((s, d) => s + d.valor, 0)
  return {
    ocupacao: noitesDisponiveis ? vendidas.length / noitesDisponiveis : 0,
    diariaMedia: vendidas.length ? receita / vendidas.length : 0,
    receitaPorUnidade: noitesDisponiveis ? receita / noitesDisponiveis : 0,
    chegadasHoje: reservas.filter((r) => r.origem === 'hospede' && ocupa(r) && dia(r.entrada) === hoje()).length,
    saidasHoje: reservas.filter((r) => r.origem === 'hospede' && ocupa(r) && dia(r.saida) === hoje()).length,
    hospedados: reservas.filter((r) => r.situacao === 'hospedado').length,
    noitesVendidas: vendidas.length,
    unidadesAtivas: ativas.length,
  }
}
