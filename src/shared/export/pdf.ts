import type { ConfigExport } from './tipos'
import { MARGEM_MM, nomeComData } from './tipos'

/**
 * PDF de TEXTO (pesquisável e selecionável), nunca print da tela rasterizado.
 *
 * A quebra de página é resolvida pela própria autoTable:
 *  - `showHead: 'everyPage'` repete o cabeçalho em toda folha;
 *  - `rowPageBreak: 'avoid'` proíbe partir uma linha ao meio — se não couber,
 *    ela inteira desce para a folha seguinte;
 *  - a margem inferior reservada impede que a última linha invada o rodapé.
 *
 * A biblioteca entra por import dinâmico: ~400 KB não podem viajar no bundle
 * de quem nunca clicou em "Exportar".
 *
 * Documento auditável (contrato, nota, recibo) continua sendo gerado no
 * servidor — este caminho é para listagem operacional.
 */
export async function baixarPdf<T>(linhas: T[], config: ConfigExport<T>) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')])

  /**
   * `jspdf-autotable` é CommonJS: dependendo do interop (Vite, Node, Jest) a
   * função sai em `mod`, em `mod.default` ou em `mod.default.default`. Escolher
   * um caminho só compila e quebra em tempo de execução no outro ambiente.
   */
  const mod = autoTableMod as unknown as Record<string, unknown>
  const candidatos = [mod, mod.default, (mod.default as Record<string, unknown> | undefined)?.default]
  const autoTable = candidatos.find((c) => typeof c === 'function') as typeof autoTableMod.default
  if (!autoTable) throw new Error('jspdf-autotable: função não encontrada no módulo')

  const paisagem = config.orientacao === 'paisagem'
  const doc = new jsPDF({
    orientation: paisagem ? 'landscape' : 'portrait',
    unit: 'mm',
    format: config.papel ?? 'a4',
  })

  const larguraPagina = doc.internal.pageSize.getWidth()
  const alturaPagina = doc.internal.pageSize.getHeight()
  const gerado = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())

  const pesos = config.colunas.map((c) => c.peso ?? 1)
  const somaPesos = pesos.reduce((a, b) => a + b, 0)
  const larguraUtil = larguraPagina - MARGEM_MM * 2

  autoTable(doc, {
    head: [config.colunas.map((c) => c.cabecalho)],
    body: linhas.map((linha) => config.colunas.map((c) => c.valor(linha))),
    // Espaço reservado no topo (título) e no rodapé (paginação).
    margin: { top: MARGEM_MM + 16, right: MARGEM_MM, bottom: MARGEM_MM + 8, left: MARGEM_MM },
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: [241, 243, 246], textColor: [40, 44, 52], fontStyle: 'bold', lineWidth: 0 },
    bodyStyles: { textColor: [55, 60, 68] },
    alternateRowStyles: { fillColor: [250, 251, 252] },
    columnStyles: Object.fromEntries(
      config.colunas.map((c, i) => [
        i,
        {
          cellWidth: (pesos[i] / somaPesos) * larguraUtil,
          halign: c.alinhamento === 'direita' ? 'right' : c.alinhamento === 'centro' ? 'center' : 'left',
        },
      ]),
    ),
    didDrawPage: (dados) => {
      // Cabeçalho do documento, repetido em toda folha.
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(20, 22, 28)
      doc.text(config.titulo, MARGEM_MM, MARGEM_MM + 6)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(120, 126, 136)
      const linhaSub = [config.subtitulo, `${linhas.length} registros`, `Gerado em ${gerado}`]
        .filter(Boolean)
        .join('  ·  ')
      doc.text(linhaSub, MARGEM_MM, MARGEM_MM + 11)

      doc.setDrawColor(226, 230, 236)
      doc.setLineWidth(0.2)
      doc.line(MARGEM_MM, MARGEM_MM + 13.5, larguraPagina - MARGEM_MM, MARGEM_MM + 13.5)

      // Rodapé: "Página X de Y" — o total é escrito no fim, quando se conhece.
      doc.setFontSize(8)
      doc.setTextColor(140, 146, 156)
      if (config.rodape) doc.text(config.rodape, MARGEM_MM, alturaPagina - MARGEM_MM + 4)
      doc.text(`Página ${dados.pageNumber} de {{TOTAL}}`, larguraPagina - MARGEM_MM, alturaPagina - MARGEM_MM + 4, {
        align: 'right',
      })
    },
  })

  // jsPDF resolve o total de páginas só no final: o placeholder é substituído aqui.
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFillColor(255, 255, 255)
    doc.rect(larguraPagina - MARGEM_MM - 34, alturaPagina - MARGEM_MM, 34, 6, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(140, 146, 156)
    doc.text(`Página ${p} de ${total}`, larguraPagina - MARGEM_MM, alturaPagina - MARGEM_MM + 4, { align: 'right' })
  }

  doc.save(`${nomeComData(config.nomeArquivo)}.pdf`)
}
