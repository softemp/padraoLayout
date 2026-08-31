import { listarClientes } from '@/shared/api/api'
import type { Cliente, ListParams } from '@/shared/api/types'
import type { ConfigExport } from '@/shared/export/tipos'
import { date, money } from '@/shared/lib/format'
import { mascaraCpf } from './colunas'

const rotuloStatus: Record<Cliente['status'], string> = {
  ativo: 'Ativo', pendente: 'Pendente', inadimplente: 'Inadimplente', inativo: 'Inativo',
}

/**
 * Uma definição de exportação por listagem, ao lado das colunas da tela.
 * O `peso` distribui a largura no PDF e na folha impressa.
 */
export function exportacaoClientes(params: ListParams): ConfigExport<Cliente> {
  const naLixeira = params.escopo === 'lixeira'
  const filtros = [
    naLixeira && 'somente registros na lixeira',
    params.search && `busca: "${params.search}"`,
    params.filters?.status && `status: ${rotuloStatus[params.filters.status as Cliente['status']]}`,
    params.filters?.plano && `plano: ${params.filters.plano}`,
  ].filter(Boolean)

  return {
    nomeArquivo: naLixeira ? 'clientes-lixeira' : 'clientes',
    titulo: naLixeira ? 'Clientes na lixeira' : 'Clientes',
    subtitulo: filtros.length ? filtros.join(' · ') : 'Todos os registros',
    orientacao: 'paisagem',
    rodape: 'Documento gerado pelo painel SoftEmp · uso interno',
    colunas: [
      { chave: 'nome', cabecalho: 'Cliente', peso: 2.1, valor: (c) => c.nome },
      { chave: 'email', cabecalho: 'E-mail', peso: 2.4, valor: (c) => c.email },
      { chave: 'documento', cabecalho: 'Documento', peso: 1.3, valor: (c) => mascaraCpf(c.documento), valorCsv: (c) => c.documento },
      { chave: 'plano', cabecalho: 'Plano', peso: 1, valor: (c) => c.plano },
      { chave: 'status', cabecalho: 'Status', peso: 1.2, valor: (c) => rotuloStatus[c.status] },
      { chave: 'mrr', cabecalho: 'MRR', peso: 1.1, alinhamento: 'direita', valor: (c) => money(c.mrr), valorCsv: (c) => c.mrr },
      naLixeira
        ? { chave: 'excluidoEm', cabecalho: 'Excluído em', peso: 1.2, alinhamento: 'direita' as const, valor: (c: Cliente) => (c.excluidoEm ? date(c.excluidoEm) : '—'), valorCsv: (c: Cliente) => c.excluidoEm?.slice(0, 10) ?? '' }
        : { chave: 'criadoEm', cabecalho: 'Cliente desde', peso: 1.2, alinhamento: 'direita' as const, valor: (c: Cliente) => date(c.criadoEm), valorCsv: (c: Cliente) => c.criadoEm.slice(0, 10) },
    ],
    // Leva a lista INTEIRA com os filtros da tela — não a página visível.
    buscarLinhas: async () => {
      const { data } = await listarClientes({ ...params, page: 1, perPage: 10_000 })
      return data
    },
  }
}
