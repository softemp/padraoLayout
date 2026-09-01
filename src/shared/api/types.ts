/** Contrato canônico de listagem — o MESMO em toda tela e todo projeto. */
export type ListParams = {
  page: number
  perPage: number
  sortBy: string
  sortDir: 'asc' | 'desc'
  search?: string
  filters?: Record<string, string | undefined>
  /** Exclusão é LÓGICA: a lixeira é um escopo da mesma listagem. */
  escopo?: EscopoRegistro
}

export type EscopoRegistro = 'ativos' | 'lixeira'

export type ListResponse<T> = {
  data: T[]
  meta: { total: number; totalPages: number; page: number; perPage: number }
}

export type ClienteStatus = 'ativo' | 'pendente' | 'inadimplente' | 'inativo'

export type Cliente = {
  id: number
  nome: string
  email: string
  documento: string        // só dígitos no "banco"; máscara é apresentação
  plano: 'Starter' | 'Pro' | 'Enterprise'
  status: ClienteStatus
  mrr: number
  criadoEm: string
  ultimoAcesso: string
  /** null = ativo. Preenchido = está na lixeira (soft delete). */
  excluidoEm: string | null
}

export type Notificacao = {
  id: number
  titulo: string
  descricao: string
  criadoEm: string
  lida: boolean
  tipo: 'info' | 'sucesso' | 'alerta' | 'critico'
}

export type Kpi = {
  id: string
  label: string
  valor: number
  formato: 'moeda' | 'numero' | 'percentual'
  delta: number            // variação vs. período anterior (fração)
  deltaBom: 'subir' | 'descer'
  serie: number[]          // sparkline (12 pontos)
}

export type SerieMensal = { mes: string; receita: number; meta: number }
export type CanalMensal = { mes: string; organico: number; indicacao: number; midiaPaga: number }
export type CategoriaValor = { categoria: string; valor: number }
export type AtividadeItem = {
  id: number
  autor: string
  acao: string
  alvo: string
  criadoEm: string
  tipo: 'info' | 'sucesso' | 'alerta' | 'critico'
}

// ── Conta do cliente ─────────────────────────────────────────────────────────

export type TipoMovimento = 'credito' | 'debito' | 'cobranca' | 'estorno'

export type MovimentoConta = {
  id: number
  criadoEm: string
  tipo: TipoMovimento
  categoria: string
  descricao: string
  /** Assinado: entra positivo, sai negativo. */
  valor: number
  /** Saldo DEPOIS deste movimento — gravado junto, nunca recalculado depois. */
  saldoApos: number
  autor: string
}

export type ExtratoConta = {
  saldo: number
  movimentos: MovimentoConta[]
}

export type UsuarioDaConta = {
  id: number
  nome: string
  email: string
  papel: 'Titular' | 'Financeiro' | 'Operador' | 'Somente leitura'
  ativo: boolean
  ultimoAcesso: string
}

export type EventoAuditoria = {
  id: number
  criadoEm: string
  autor: string
  acao: string
  detalhe: string
}

export type Assinatura = {
  plano: Cliente['plano']
  ciclo: 'Mensal' | 'Anual'
  valor: number
  proximaCobranca: string
  formaPagamento: string
  desde: string
  renovacaoAutomatica: boolean
}

export type AjusteConta = {
  tipo: 'credito' | 'debito'
  valor: number
  categoria: string
  descricao: string
}

// ── Controle de acesso (RBAC) ────────────────────────────────────────────────

export type Painel = 'admin' | 'gerencia' | 'cliente'

/** Ações do catálogo — conjunto FECHADO, igual para todo módulo. */
export type AcaoPermissao = 'read' | 'create' | 'update' | 'delete' | 'print' | 'export'

export type Modulo = {
  id: number
  nome: string        // slug técnico: user, finance, audit…
  label: string
  descricao: string
  painel: Painel
}

export type Permissao = {
  id: number
  moduloId: number
  acao: AcaoPermissao
  /** `painel.modulo.acao` — o painel VIAJA no slug (ver Base_RBAC_Painel_No_Papel). */
  slug: string
  label: string
}

export type Papel = {
  id: number
  nome: string        // slug: root, admin, gerente…
  label: string
  descricao: string
  /** O papel DECLARA seu painel — não é uma lista de slugs no código. */
  painel: Painel | null
  /** root: ausência de verificação, não um papel com todas as permissões. */
  irrestrito: boolean
  usuarios: number
  sistema: boolean    // papel de sistema não pode ser excluído
}

export type UsuarioSistema = {
  id: number
  nome: string
  email: string
  /** Um papel POR PAINEL: a mesma pessoa é admin aqui e cliente ali. */
  papeis: Partial<Record<Painel, string>>
  ativo: boolean
  ultimoAcesso: string
}

// ── Operação (faturas, recebimentos, conciliação, auditoria, integrações) ────

export type StatusFatura = 'paga' | 'aberta' | 'vencida' | 'cancelada'

export type Fatura = {
  id: number
  numero: string
  clienteId: number
  cliente: string
  emissao: string
  vencimento: string
  pagamentoEm: string | null
  valor: number
  status: StatusFatura
  formaPagamento: 'Boleto' | 'PIX' | 'Cartão' | 'Transferência'
}

export type TotaisFaturas = { aberto: number; vencido: number; recebidoMes: number; quantidade: number }

export type Recebimento = {
  id: number
  data: string
  cliente: string
  faturaNumero: string
  valor: number
  meio: Fatura['formaPagamento']
  conta: string
}

export type LancamentoBanco = {
  id: number
  data: string
  descricao: string
  valor: number
  documento: string
}

export type LancamentoSistema = {
  id: number
  data: string
  descricao: string
  valor: number
  origem: string
}

export type ParConciliacao = {
  banco: LancamentoBanco
  sistema: LancamentoSistema | null
  /** 0–1: o quanto data e valor batem. Sugestão, não decisão. */
  confianca: number
  situacao: 'conciliado' | 'sugerido' | 'sem_par'
}

export type EventoSistema = {
  id: number
  criadoEm: string
  autor: string
  modulo: string
  acao: 'criou' | 'editou' | 'excluiu' | 'exportou' | 'acessou' | 'falhou'
  alvo: string
  ip: string
  antes?: string
  depois?: string
}

export type Integracao = {
  id: string
  nome: string
  categoria: string
  icone: string
  descricao: string
  situacao: 'conectada' | 'nao_configurada' | 'falha'
  ultimaVerificacao: string | null
}

// ── Contas a pagar e a receber ───────────────────────────────────────────────

export type TipoLancamento = 'receber' | 'pagar'

/**
 * VENCIDO NÃO ESTÁ AQUI, de propósito: é derivado (pendente + vencimento no
 * passado). Gravar OVERDUE quebra tudo que exige PENDENTE — baixa, cobrança
 * automática, cancelamento de série — e cria um estado que envelhece sozinho.
 */
export type StatusLancamento = 'pendente' | 'parcial' | 'pago' | 'cancelado'

export type OrigemLancamento = 'manual' | 'recorrencia' | 'automatico'

export type CategoriaFinanceira = {
  id: number
  nome: string
  tipo: TipoLancamento
  /** Chave de negócio estável: renomear a categoria não quebra relatório. */
  slug: string | null
  sistema: boolean
}

export type ContaBancaria = {
  id: number
  nome: string
  banco: string
  agencia: string
  numero: string
  saldo: number
  principal: boolean
}

export type MovimentoBancario = {
  id: number
  contaId: number
  data: string
  descricao: string
  valor: number
  /** Gravado junto com o movimento — o saldo nunca é recalculado por soma. */
  saldoApos: number
  lancamentoId: number | null
}

export type Lancamento = {
  id: number
  tipo: TipoLancamento
  descricao: string
  contraparte: string
  categoriaId: number
  /** Mês de competência (AAAA-MM): o regime que o contador enxerga. */
  competencia: string
  vencimento: string
  pagamentoEm: string | null
  valor: number
  valorPago: number
  juros: number
  desconto: number
  status: StatusLancamento
  contaId: number | null
  origem: OrigemLancamento
  /** Parcela de uma série recorrente. */
  serieId: number | null
  parcela: { numero: number; de: number } | null
  observacao?: string
}

/** Base do período: competência (vencimento) × caixa (pagamento ou vencimento). */
export type BaseData = 'competencia' | 'caixa'

export type TotaisFinanceiro = {
  aReceber: number
  aPagar: number
  recebido: number
  pago: number
  vencidoReceber: number
  vencidoPagar: number
  saldoPrevisto: number
  saldoRealizado: number
}

export type NovoLancamento = {
  tipo: TipoLancamento
  descricao: string
  contraparte: string
  categoriaId: number
  competencia: string
  vencimento: string
  valor: number
  contaId: number | null
  observacao?: string
  recorrencia: { ativa: boolean; periodicidade: 'mensal' | 'semanal' | 'anual'; parcelas: number }
  /** Override consciente da trava de duplicidade. */
  confirmarDuplicidade?: boolean
}

export type BaixaLancamento = {
  pagamentoEm: string
  contaId: number | null
  valorPago: number
  juros: number
  desconto: number
}

// ── Configurações da empresa ─────────────────────────────────────────────────

export type RegimeTributario = 'simples' | 'presumido' | 'real' | 'mei'

export type Empresa = {
  razaoSocial: string
  nomeFantasia: string
  /** Só dígitos: a máscara é apresentação. */
  cnpj: string
  inscricaoEstadual: string
  inscricaoMunicipal: string
  abertura: string
  telefone: string
  email: string
  site: string
  // Endereço
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  // Identidade
  corPrimaria: string
  logoUrl: string | null
  // Fiscal
  regime: RegimeTributario
  cnae: string
  serieNota: string
  proximaNota: number
  /** Só metadados do certificado — o arquivo e a senha nunca voltam. */
  certificado: { nome: string; validade: string; instaladoEm: string } | null
}

export type Unidade = {
  id: number
  nome: string
  tipo: 'matriz' | 'filial'
  cnpj: string
  cidade: string
  uf: string
  ativa: boolean
}

export type EnderecoCep = {
  logradouro: string
  bairro: string
  cidade: string
  uf: string
}
