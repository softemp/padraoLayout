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

// ── Perfil do usuário ────────────────────────────────────────────────────────

export type PerfilUsuario = {
  nome: string
  email: string
  emailVerificado: boolean
  telefone: string
  telefoneVerificado: boolean
  cargo: string
  bio: string
  fuso: string
  idioma: 'pt-BR' | 'en-US' | 'es-ES'
  formatoData: 'dd/MM/yyyy' | 'yyyy-MM-dd' | 'MM/dd/yyyy'
  paginaInicial: string
  avatarUrl: string | null
  segundoFatorAtivo: boolean
  codigosRecuperacaoRestantes: number
  senhaAlteradaEm: string
}

export type CanalNotificacao = 'email' | 'whatsapp' | 'push'

export type PreferenciaNotificacao = {
  evento: string
  rotulo: string
  descricao: string
  /** Canais ligados para este evento. */
  canais: Record<CanalNotificacao, boolean>
  /** Evento crítico não pode ser desligado por completo. */
  obrigatorio?: boolean
}

export type SessaoAtiva = {
  id: number
  dispositivo: string
  navegador: string
  sistema: string
  ip: string
  local: string
  ultimaAtividade: string
  atual: boolean
}

export type AcessoRegistrado = {
  id: number
  data: string
  ip: string
  local: string
  dispositivo: string
  resultado: 'sucesso' | 'senha_incorreta' | 'segundo_fator_falhou' | 'bloqueado'
}

// ── Contratos ────────────────────────────────────────────────────────────────

/**
 * "A vencer" NÃO é status: é derivado da vigência, como "vencido" no
 * financeiro. Gravar o estado cria um valor que envelhece sozinho.
 */
export type StatusContrato = 'rascunho' | 'em_assinatura' | 'vigente' | 'encerrado' | 'rescindido'

export type IndiceReajuste = 'IPCA' | 'IGP-M' | 'INPC' | 'sem_reajuste'

export type Contrato = {
  id: number
  numero: string
  clienteId: number
  cliente: string
  objeto: string
  valorMensal: number
  inicio: string
  fim: string
  status: StatusContrato
  renovacaoAutomatica: boolean
  /** Dias de aviso prévio para não renovar — é o que torna a renovação segura. */
  avisoPrevioDias: number
  indice: IndiceReajuste
  /** Mês/dia base do reajuste anual. */
  dataBaseReajuste: string
  ultimoReajusteEm: string | null
  gestor: string
  observacao?: string
}

export type Aditivo = {
  id: number
  contratoId: number
  numero: string
  tipo: 'reajuste' | 'prazo' | 'valor' | 'escopo' | 'rescisao'
  criadoEm: string
  vigenciaEm: string
  descricao: string
  valorAnterior: number | null
  valorNovo: number | null
  fimAnterior: string | null
  fimNovo: string | null
  autor: string
}

export type AssinaturaContrato = {
  id: number
  contratoId: number
  parte: string
  papel: 'contratante' | 'contratada' | 'testemunha'
  email: string
  assinadoEm: string | null
  meio: 'digital' | 'fisico' | null
}

export type EventoContrato = {
  id: number
  contratoId: number
  criadoEm: string
  autor: string
  acao: string
  detalhe: string
}

export type TotaisContratos = {
  vigentes: number
  receitaMensal: number
  vencendo: number
  semAssinatura: number
  reajustePendente: number
}

// ── Documentos ───────────────────────────────────────────────────────────────

export type TipoDocumento =
  | 'contrato' | 'aditivo' | 'nota_fiscal' | 'certidao' | 'procuracao'
  | 'identidade' | 'comprovante' | 'apolice' | 'outro'

export type Confidencialidade = 'interno' | 'restrito' | 'confidencial'

/** Vínculo: documento sem dono é documento que ninguém acha depois. */
export type VinculoDocumento = {
  tipo: 'cliente' | 'contrato' | 'fornecedor' | 'colaborador' | 'empresa'
  id: number | null
  rotulo: string
}

export type Documento = {
  id: number
  nome: string
  tipo: TipoDocumento
  vinculo: VinculoDocumento
  confidencialidade: Confidencialidade
  tags: string[]
  /** Metadados da versão VIGENTE. */
  versaoAtual: number
  extensao: string
  tamanhoBytes: number
  enviadoPor: string
  enviadoEm: string
  /** null = documento que não vence (contrato assinado, nota emitida). */
  validade: string | null
  arquivadoEm: string | null
}

export type VersaoDocumento = {
  id: number
  documentoId: number
  numero: number
  nome: string
  tamanhoBytes: number
  enviadoPor: string
  enviadoEm: string
  motivo: string
  /** Impressão do arquivo — muda a cada versão; é o que prova que é outro arquivo. */
  hash: string
  vigente: boolean
}

export type CompartilhamentoDocumento = {
  id: number
  documentoId: number
  destinatario: string
  criadoEm: string
  expiraEm: string
  revogadoEm: string | null
  acessos: number
  criadoPor: string
}

export type TotaisDocumentos = {
  total: number
  vencendo: number
  vencidos: number
  semVinculo: number
  espacoBytes: number
}

// ── Tarefas ──────────────────────────────────────────────────────────────────

/** "Atrasada" NÃO entra aqui: é derivada do prazo, como vencido e vencendo. */
export type SituacaoTarefa = 'a_fazer' | 'em_andamento' | 'em_revisao' | 'concluida' | 'cancelada'
export type PrioridadeTarefa = 'baixa' | 'media' | 'alta' | 'urgente'

export type VinculoTarefa = {
  tipo: 'cliente' | 'contrato' | 'documento' | 'lancamento' | 'nenhum'
  id: number | null
  rotulo: string
}

export type ItemChecklist = { id: number; texto: string; feito: boolean }

export type ComentarioTarefa = {
  id: number
  tarefaId: number
  autor: string
  texto: string
  criadoEm: string
}

export type Tarefa = {
  id: number
  titulo: string
  descricao: string
  situacao: SituacaoTarefa
  prioridade: PrioridadeTarefa
  responsavel: string | null
  criadoPor: string
  criadoEm: string
  prazo: string | null
  concluidaEm: string | null
  concluidaPor: string | null
  vinculo: VinculoTarefa
  etiquetas: string[]
  checklist: ItemChecklist[]
  comentarios: number
}

export type TotaisTarefas = {
  minhas: number
  atrasadas: number
  semResponsavel: number
  semPrazo: number
  concluidasSemana: number
}

// ── Estoque ──────────────────────────────────────────────────────────────────

export type TipoMovimentoEstoque = 'entrada' | 'saida' | 'ajuste' | 'transferencia'

export type Deposito = { id: number; nome: string; sigla: string; principal: boolean }

export type ItemEstoque = {
  id: number
  sku: string
  nome: string
  categoria: string
  unidade: 'un' | 'cx' | 'kg' | 'm' | 'l'
  /** Custo médio PONDERADO — recalculado só na entrada. */
  custoMedio: number
  precoVenda: number
  /** Físico, somando os depósitos. */
  saldo: number
  /** Prometido a pedidos: disponível = saldo − reservado. */
  reservado: number
  estoqueSeguranca: number
  /** Dias entre pedir ao fornecedor e a mercadoria chegar. */
  prazoReposicaoDias: number
  consumoMedioDiario: number
  fornecedor: string
  localizacao: string
  ativo: boolean
  ultimaMovimentacao: string | null
}

export type SaldoPorDeposito = { depositoId: number; deposito: string; saldo: number }

export type MovimentoEstoque = {
  id: number
  itemId: number
  criadoEm: string
  tipo: TipoMovimentoEstoque
  /** Assinada: entrada positiva, saída negativa. */
  quantidade: number
  /** Custo unitário do movimento (só entrada informa; saída usa o médio vigente). */
  custoUnitario: number
  /** Saldo DEPOIS deste movimento — gravado junto, nunca recalculado. */
  saldoApos: number
  /** Custo médio DEPOIS deste movimento. */
  custoMedioApos: number
  documento: string
  motivo: string
  depositoId: number
  autor: string
}

export type TotaisEstoque = {
  itens: number
  valorTotal: number
  abaixoMinimo: number
  precisamRepor: number
  semGiro: number
}

// ── Compras ──────────────────────────────────────────────────────────────────

/** "Atrasado" é derivado da previsão de entrega, não estado gravado. */
export type SituacaoPedido =
  | 'rascunho' | 'aguardando_aprovacao' | 'aprovado' | 'enviado'
  | 'recebido_parcial' | 'recebido' | 'cancelado'

export type ItemPedido = {
  id: number
  itemEstoqueId: number
  sku: string
  nome: string
  unidade: string
  quantidade: number
  quantidadeRecebida: number
  precoUnitario: number
}

export type PedidoCompra = {
  id: number
  numero: string
  fornecedor: string
  situacao: SituacaoPedido
  criadoPor: string
  criadoEm: string
  aprovadoPor: string | null
  aprovadoEm: string | null
  previsaoEntrega: string
  condicaoPagamento: string
  observacao: string
  itens: ItemPedido[]
  /** Vínculos criados no recebimento. */
  lancamentoId: number | null
}

export type EventoPedido = {
  id: number
  pedidoId: number
  criadoEm: string
  autor: string
  acao: string
  detalhe: string
}

export type SugestaoCompra = {
  itemEstoqueId: number
  sku: string
  nome: string
  unidade: string
  disponivel: number
  pontoDePedido: number
  sugerido: number
  custoMedio: number
  fornecedor: string
  prazoReposicaoDias: number
}

export type TotaisCompras = {
  aguardandoAprovacao: number
  aReceber: number
  atrasados: number
  valorEmAberto: number
  sugestoes: number
}

// ── Vendas ───────────────────────────────────────────────────────────────────

export type SituacaoVenda =
  | 'orcamento' | 'aguardando_desconto' | 'confirmado' | 'faturado_parcial' | 'faturado' | 'cancelado'

export type ItemVenda = {
  id: number
  itemEstoqueId: number
  sku: string
  nome: string
  unidade: string
  quantidade: number
  quantidadeFaturada: number
  /** Preço de tabela COPIADO na criação — tabela que muda depois não mexe no pedido. */
  precoTabela: number
  precoPraticado: number
  /** Custo médio no momento da venda, também copiado: é o que sustenta a margem. */
  custoNaVenda: number
}

export type PedidoVenda = {
  id: number
  numero: string
  clienteId: number
  cliente: string
  situacao: SituacaoVenda
  vendedor: string
  criadoEm: string
  validadeOrcamento: string
  condicaoPagamento: string
  aprovadoPor: string | null
  aprovadoEm: string | null
  itens: ItemVenda[]
  lancamentoId: number | null
  observacao: string
}

export type TotaisVendas = {
  emOrcamento: number
  aguardandoDesconto: number
  aFaturar: number
  faturadoMes: number
  margemMedia: number
}

// ── RH ───────────────────────────────────────────────────────────────────────

export type SituacaoColaborador = 'ativo' | 'ferias' | 'afastado' | 'aviso_previo' | 'desligado'
export type TipoContrato = 'CLT' | 'PJ' | 'Estágio' | 'Aprendiz'

export type Colaborador = {
  id: number
  nome: string
  email: string
  /** Só dígitos; exibido mascarado mesmo para quem pode ver. */
  cpf: string
  cargo: string
  departamento: string
  gestor: string
  contrato: TipoContrato
  admissao: string
  desligamento: string | null
  situacao: SituacaoColaborador
  /** RESTRITO: só chega ao cliente para quem tem permissão de remuneração. */
  salario: number | null
  telefone: string
  localizacao: string
  fotoUrl: string | null
}

/**
 * Período AQUISITIVO (12 meses trabalhados) × CONCESSIVO (12 meses seguintes
 * para gozar). Passou do concessivo sem conceder, a empresa paga em DOBRO.
 */
export type PeriodoFerias = {
  id: number
  colaboradorId: number
  aquisitivoInicio: string
  aquisitivoFim: string
  concessivoFim: string
  diasDireito: number
  diasGozados: number
  diasVendidos: number
  agendadoPara: string | null
}

export type Ausencia = {
  id: number
  colaboradorId: number
  tipo: 'falta' | 'atestado' | 'licenca' | 'home_office' | 'folga'
  inicio: string
  fim: string
  dias: number
  justificada: boolean
  observacao: string
}

export type ItemDesligamento = { id: number; rotulo: string; responsavel: string; feito: boolean; critico: boolean }

export type TotaisRh = {
  ativos: number
  emFerias: number
  feriasVencendo: number
  feriasEmDobra: number
  aniversariantes: number
  custoFolha: number | null
}

// ── Projetos ─────────────────────────────────────────────────────────────────

export type SituacaoProjeto = 'planejado' | 'em_andamento' | 'em_risco' | 'pausado' | 'concluido' | 'cancelado'

export type Marco = {
  id: number
  projetoId: number
  nome: string
  previsto: string
  /** Data da linha de base original — o replanejamento não a apaga. */
  previstoBaseline: string
  entregue: string | null
  /** Peso do marco no avanço físico do projeto (soma 100). */
  peso: number
  concluido: boolean
}

export type Apontamento = {
  id: number
  projetoId: number
  pessoa: string
  data: string
  horas: number
  atividade: string
  faturavel: boolean
}

export type Risco = {
  id: number
  projetoId: number
  descricao: string
  probabilidade: 'baixa' | 'media' | 'alta'
  impacto: 'baixo' | 'medio' | 'alto'
  mitigacao: string
  aberto: boolean
}

export type Replanejamento = {
  id: number
  projetoId: number
  criadoEm: string
  autor: string
  motivo: string
  prazoAnterior: string
  prazoNovo: string
  horasAnteriores: number
  horasNovas: number
}

export type Projeto = {
  id: number
  codigo: string
  nome: string
  cliente: string
  clienteId: number
  responsavel: string
  situacao: SituacaoProjeto
  inicio: string
  prazo: string
  /** Linha de base: o prazo prometido no começo. */
  prazoBaseline: string
  horasOrcadas: number
  horasBaseline: number
  valorContrato: number
  custoHora: number
  despesas: number
}

export type TotaisProjetos = {
  emAndamento: number
  atrasados: number
  estourandoHoras: number
  margemMedia: number
  horasMes: number
}

// ── Projetos: estrutura e alocação ───────────────────────────────────────────

export type Fase = {
  id: number
  projetoId: number
  nome: string
  ordem: number
  inicioPrevisto: string
  fimPrevisto: string
  concluida: boolean
}

export type TarefaProjeto = {
  id: number
  projetoId: number
  faseId: number
  nome: string
  responsavel: string | null
  horasEstimadas: number
  horasApontadas: number
  inicioPrevisto: string
  fimPrevisto: string
  /** Tarefa que precisa terminar antes desta começar. */
  dependeDe: number | null
  concluida: boolean
}

export type CapacidadePessoa = {
  pessoa: string
  /** Horas por dia útil que a pessoa tem para projetos. */
  capacidadeDiaria: number
  horasAlocadas: number
  diasUteisNoPeriodo: number
  capacidadeTotal: number
}

export type NovoProjeto = {
  nome: string
  cliente: string
  clienteId: number
  responsavel: string
  inicio: string
  prazo: string
  valorContrato: number
  custoHora: number
  horasOrcadas: number
}

// ── Chamados ─────────────────────────────────────────────────────────────────

export type SituacaoChamado =
  | 'novo' | 'em_atendimento' | 'aguardando_cliente' | 'resolvido' | 'fechado' | 'cancelado'

export type Urgencia = 'baixa' | 'media' | 'alta'
export type Impacto = 'individual' | 'equipe' | 'empresa'
export type Prioridade = 'P1' | 'P2' | 'P3' | 'P4'

export type MensagemChamado = {
  id: number
  chamadoId: number
  autor: string
  interno: boolean
  automatica: boolean
  texto: string
  criadoEm: string
}

export type Chamado = {
  id: number
  numero: string
  assunto: string
  descricao: string
  clienteId: number
  cliente: string
  solicitante: string
  categoria: string
  urgencia: Urgencia
  impacto: Impacto
  situacao: SituacaoChamado
  responsavel: string | null
  abertoEm: string
  /** Primeira resposta HUMANA — a automática não conta. */
  primeiraRespostaEm: string | null
  resolvidoEm: string | null
  /** Soma dos períodos em que a bola estava com o cliente. */
  minutosPausados: number
  pausadoDesde: string | null
  reaberturas: number
  canal: 'e-mail' | 'telefone' | 'WhatsApp' | 'portal'
}

export type TotaisChamados = {
  abertos: number
  semResponsavel: number
  slaEstourado: number
  slaEmRisco: number
  primeiraRespostaMedia: number
  taxaReabertura: number
}

// ── Metas e indicadores ──────────────────────────────────────────────────────

export type Perspectiva = 'financeiro' | 'cliente' | 'operacao' | 'pessoas'
export type DirecaoMeta = 'maior_melhor' | 'menor_melhor'
export type FormatoIndicador = 'moeda' | 'numero' | 'percentual' | 'minutos'

export type Indicador = {
  id: string
  nome: string
  perspectiva: Perspectiva
  descricao: string
  /** De ONDE o número sai — indicador digitado é indicador que ninguém confia. */
  fonte: string
  rotaFonte: string | null
  formato: FormatoIndicador
  direcao: DirecaoMeta
  meta: number
  /** Indicador que serve de contrapeso a este (o par que impede o jogo). */
  contrapesoId: string | null
  responsavel: string
  periodo: string
  /** Fração do período já decorrida (0–1). */
  decorrido: number
  atual: number
  serie: { rotulo: string; valor: number }[]
}

export type RevisaoMeta = {
  id: number
  indicadorId: string
  criadoEm: string
  autor: string
  de: number
  para: number
  motivo: string
}
