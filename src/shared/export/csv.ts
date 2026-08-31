import type { ColunaExport } from './tipos'
import { nomeComData } from './tipos'

/**
 * CSV para Excel pt-BR: separador `;`, quebra CRLF e BOM UTF-8.
 * Sem o BOM o Excel abre "SÃ£o Paulo"; com vírgula como separador ele joga a
 * linha inteira numa coluna só.
 */
export function baixarCsv<T>(linhas: T[], colunas: ColunaExport<T>[], nomeArquivo: string) {
  const escapar = (valor: string | number) => {
    const texto = String(valor ?? '')
    return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
  }

  const cabecalho = colunas.map((c) => escapar(c.cabecalho)).join(';')
  const corpo = linhas.map((linha) =>
    colunas
      .map((c) => {
        const bruto = c.valorCsv ? c.valorCsv(linha) : c.valor(linha)
        // Número vai com vírgula decimal: é o que o Excel pt-BR entende como número.
        return escapar(typeof bruto === 'number' ? String(bruto).replace('.', ',') : bruto)
      })
      .join(';'),
  )

  const conteudo = '﻿' + [cabecalho, ...corpo].join('\r\n')
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${nomeComData(nomeArquivo)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
