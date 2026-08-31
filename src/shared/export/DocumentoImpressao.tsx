import { createPortal } from 'react-dom'
import type { ConfigExport } from './tipos'

/**
 * Documento que vai para a impressora. Vive num portal na raiz do <body>
 * porque a folha de impressão esconde TODO o resto (`body > *`) e deixa só ele:
 * assim a sidebar, a navbar e os filtros não vão para o papel.
 *
 * A quebra de página é responsabilidade do CSS de impressão (index.css):
 *  - `thead { display: table-header-group }` repete o cabeçalho em toda folha;
 *  - `tr { break-inside: avoid }` impede linha partida ao meio;
 *  - o bloco de título não se separa da primeira leva de linhas.
 */
export function DocumentoImpressao<T>({ config, linhas }: { config: ConfigExport<T>; linhas: T[] }) {
  const gerado = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())

  return createPortal(
    <div id="doc-impressao" data-orientacao={config.orientacao ?? 'retrato'}>
      <header className="doc-cabecalho">
        <div>
          <h1>{config.titulo}</h1>
          <p>
            {[config.subtitulo, `${linhas.length} registros`, `Gerado em ${gerado}`].filter(Boolean).join('  ·  ')}
          </p>
        </div>
        <span className="doc-marca">SoftEmp</span>
      </header>

      <table>
        <thead>
          <tr>
            {config.colunas.map((c) => (
              <th key={c.chave} data-alinhamento={c.alinhamento ?? 'esquerda'} style={{ width: `${((c.peso ?? 1) / config.colunas.reduce((a, x) => a + (x.peso ?? 1), 0)) * 100}%` }}>
                {c.cabecalho}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, i) => (
            <tr key={i}>
              {config.colunas.map((c) => (
                <td key={c.chave} data-alinhamento={c.alinhamento ?? 'esquerda'}>
                  {c.valor(linha)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {config.rodape && <p className="doc-rodape">{config.rodape}</p>}
    </div>,
    document.body,
  )
}
