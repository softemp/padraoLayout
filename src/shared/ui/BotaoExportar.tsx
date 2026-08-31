import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/shared/lib/cn'
import { baixarCsv } from '@/shared/export/csv'
import { DocumentoImpressao } from '@/shared/export/DocumentoImpressao'
import type { ConfigExport, FormatosExport } from '@/shared/export/tipos'
import { Dropdown, DropdownItem } from './Dropdown'

/**
 * Botão de exportação do kit. Três saídas, cada uma com a sua regra de quebra
 * de página já configurada:
 *
 *  · CSV  — planilha: sem página, mas com separador/BOM que o Excel pt-BR abre,
 *           e número CRU para a coluna poder ser somada.
 *  · PDF  — cabeçalho repetido em toda folha, linha nunca partida ao meio,
 *           "Página X de Y" no rodapé. Texto pesquisável, não imagem.
 *  · Imprimir — mesma folha, direto na impressora: o resto da aplicação some
 *           e só o documento vai ao papel.
 *
 * Os formatos ligam e desligam por prop (`formatos`); o menu só mostra o que
 * está ligado e, com um formato só, vira botão direto (sem menu de uma opção).
 */
export type BotaoExportarProps<T> = ConfigExport<T> & {
  formatos?: FormatosExport
  rotulo?: string
  variante?: 'primary' | 'secondary' | 'ghost'
  tamanho?: 'sm' | 'md'
}

type Formato = 'csv' | 'pdf' | 'imprimir'

const ROTULOS: Record<Formato, { icone: string; titulo: string; detalhe: string }> = {
  csv: { icone: '📄', titulo: 'CSV (planilha)', detalhe: 'Abre no Excel · colunas somáveis' },
  pdf: { icone: '📕', titulo: 'PDF', detalhe: 'Cabeçalho em toda página · linha inteira' },
  imprimir: { icone: '🖨️', titulo: 'Imprimir', detalhe: 'Envia direto para a impressora' },
}

export function BotaoExportar<T>({
  formatos = { csv: true, pdf: true, imprimir: true },
  rotulo = 'Exportar',
  variante = 'secondary',
  tamanho = 'md',
  ...config
}: BotaoExportarProps<T>) {
  const [ocupado, setOcupado] = useState<Formato | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [impressao, setImpressao] = useState<T[] | null>(null)

  const habilitados = (Object.keys(ROTULOS) as Formato[]).filter((f) => formatos[f])

  // Impressão: renderiza o documento, espera a pintura e só então chama o
  // diálogo. Sem esperar, o navegador imprime a folha em branco.
  useEffect(() => {
    if (!impressao) return
    const limpar = () => setImpressao(null)
    window.addEventListener('afterprint', limpar, { once: true })
    const id = requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('afterprint', limpar)
    }
  }, [impressao])

  const exportar = useCallback(
    async (formato: Formato) => {
      setErro(null)
      setOcupado(formato)
      try {
        // A exportação leva a lista INTEIRA (com os filtros aplicados), nunca
        // as 10 linhas que estão na tela.
        const linhas = await config.buscarLinhas()
        if (!linhas.length) {
          setErro('Nada para exportar com os filtros atuais.')
          return
        }
        if (formato === 'csv') baixarCsv(linhas, config.colunas, config.nomeArquivo)
        if (formato === 'pdf') {
          // ~400 KB entram só quando alguém pede PDF.
          const { baixarPdf } = await import('@/shared/export/pdf')
          await baixarPdf(linhas, config)
        }
        if (formato === 'imprimir') setImpressao(linhas)
      } catch {
        setErro('Não foi possível gerar o arquivo. Tente novamente.')
      } finally {
        // Sem guarda de "ainda montado": no StrictMode o efeito de montagem roda
        // duas vezes, a limpeza marcava o componente como morto e o spinner
        // nunca mais desligava. Em React 18 atualizar estado de componente
        // desmontado é inofensivo — a guarda é que era o bug.
        setOcupado(null)
      }
    },
    [config],
  )

  if (!habilitados.length) return null

  const classesGatilho = cn(
    'inline-flex select-none items-center gap-2 rounded-lg font-medium transition-colors',
    tamanho === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-9 px-4 text-sm',
    variante === 'primary' && 'bg-primary text-text-inverse hover:bg-primary-hover shadow-card',
    variante === 'secondary' && 'bg-surface text-text border border-border hover:bg-surface-2',
    variante === 'ghost' && 'text-text-secondary hover:bg-surface-2 hover:text-text',
    ocupado && 'opacity-70',
  )

  const conteudoGatilho = (comSeta: boolean) => (
    <>
      {ocupado ? (
        <span aria-hidden className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
      ) : (
        <span aria-hidden>⬇️</span>
      )}
      {ocupado ? 'Gerando…' : rotulo}
      {comSeta && <span aria-hidden className="text-[10px] opacity-60">▾</span>}
    </>
  )

  return (
    <>
      {/* Um formato só não merece um menu de uma opção. */}
      {habilitados.length === 1 ? (
        <button type="button" className={classesGatilho} disabled={!!ocupado} onClick={() => exportar(habilitados[0])}>
          {conteudoGatilho(false)}
        </button>
      ) : (
        <Dropdown
          rotuloGatilho={`${rotulo} — escolher formato`}
          largura="w-64"
          gatilho={() => <span className={classesGatilho}>{conteudoGatilho(true)}</span>}
        >
          {(fechar) => (
            <div className="py-1.5">
              {habilitados.map((formato) => (
                <DropdownItem
                  key={formato}
                  icone={ROTULOS[formato].icone}
                  onClick={() => { fechar(); void exportar(formato) }}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-text">{ROTULOS[formato].titulo}</span>
                    <span className="block truncate text-[12px] text-text-muted">{ROTULOS[formato].detalhe}</span>
                  </span>
                </DropdownItem>
              ))}
            </div>
          )}
        </Dropdown>
      )}

      {erro && (
        <span role="alert" className="text-[12px] font-medium text-critical">{erro}</span>
      )}

      {impressao && <DocumentoImpressao config={config} linhas={impressao} />}
    </>
  )
}
