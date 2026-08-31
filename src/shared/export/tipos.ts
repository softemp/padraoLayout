/** Contrato único de exportação: uma definição serve CSV, PDF e impressão. */

export type AlinhamentoExport = 'esquerda' | 'direita' | 'centro'

export type ColunaExport<T> = {
  chave: string
  cabecalho: string
  /** Peso relativo da largura no PDF/impressão (default 1). */
  peso?: number
  alinhamento?: AlinhamentoExport
  /** Valor legível (já formatado: R$ 1.234,56 · 31/08/2026). */
  valor: (linha: T) => string
  /**
   * Valor CRU para planilha (número/data ISO). Sem isso o Excel recebe texto e
   * não soma a coluna — o erro mais comum de export de listagem.
   */
  valorCsv?: (linha: T) => string | number
}

export type FormatosExport = {
  csv?: boolean
  pdf?: boolean
  imprimir?: boolean
}

export type ConfigExport<T> = {
  /** Sem extensão: cada formato acrescenta a sua. */
  nomeArquivo: string
  titulo: string
  subtitulo?: string
  colunas: ColunaExport<T>[]
  /**
   * Fonte das linhas. É função (e pode ser async) porque a exportação leva a
   * lista INTEIRA — não as 10 linhas da página que está na tela.
   */
  buscarLinhas: () => Promise<T[]> | T[]
  orientacao?: 'retrato' | 'paisagem'
  papel?: 'a4' | 'letter'
  /** Linha de rodapé fixa (além da data e da numeração de páginas). */
  rodape?: string
}

export const MARGEM_MM = 12
export const nomeComData = (nome: string) => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${nome}_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`
}
