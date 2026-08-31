/** Contrato canônico de listagem — o MESMO em toda tela e todo projeto. */
export type ListParams = {
  page: number
  perPage: number
  sortBy: string
  sortDir: 'asc' | 'desc'
  search?: string
  filters?: Record<string, string | undefined>
}

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
