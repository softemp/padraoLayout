import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  arquivarDocumento, diasParaVencer, estaVencendo, estaVencido, formatarTamanho, JANELA_RENOVACAO_DIAS,
  listarDocumentos, restaurarDocumento, semVinculo, totaisDocumentos,
} from '@/shared/api/documentos'
import type { Confidencialidade, Documento, TipoDocumento } from '@/shared/api/types'
import { useTableState } from '@/shared/hooks/useTableState'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { BotaoExportar } from '@/shared/ui/BotaoExportar'
import { ConfirmarAcao } from '@/shared/ui/ConfirmarAcao'
import { DataTable } from '@/shared/ui/DataTable'
import { Select } from '@/shared/ui/Field'
import { PageHeader } from '@/shared/ui/PageHeader'
import { cn } from '@/shared/lib/cn'
import { CartaoResumo, GradeResumo } from '@/shared/ui/CartaoResumo'
import { date, number } from '@/shared/lib/format'

const rotuloTipo: Record<TipoDocumento, string> = {
  contrato: 'Contrato', aditivo: 'Aditivo', nota_fiscal: 'Nota fiscal', certidao: 'Certidão',
  procuracao: 'Procuração', identidade: 'Identificação', comprovante: 'Comprovante',
  apolice: 'Apólice', outro: 'Outro',
}

const sigiloInfo: Record<Confidencialidade, { tom: 'neutro' | 'warning' | 'critical'; rotulo: string }> = {
  interno: { tom: 'neutro', rotulo: 'Interno' },
  restrito: { tom: 'warning', rotulo: 'Restrito' },
  confidencial: { tom: 'critical', rotulo: 'Confidencial' },
}

const iconePorExtensao = (ext: string) =>
  ext === 'pdf' ? '📕' : ext === 'docx' ? '📘' : ext === 'xlsx' ? '📗' : ext === 'png' ? '🖼️' : '📄'

export function DocumentosPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const tabela = useTableState({ sortBy: 'enviadoEm', sortDir: 'desc', filtros: ['tipo', 'confidencialidade', 'validade'] })
  const [busca, setBusca] = useState(tabela.search ?? '')
  const buscaDebounced = useDebouncedValue(busca, 450)
  const [arquivando, setArquivando] = useState<Documento | null>(null)

  useEffect(() => {
    if (buscaDebounced !== (tabela.search ?? '')) tabela.setSearch(buscaDebounced)
  }, [buscaDebounced]) // eslint-disable-line react-hooks/exhaustive-deps

  const params = {
    page: tabela.page, perPage: tabela.perPage, sortBy: tabela.sortBy, sortDir: tabela.sortDir,
    search: tabela.search, filters: tabela.filters, escopo: tabela.escopo,
  }

  const { data, isFetching, error } = useQuery({
    queryKey: ['documentos', params],
    queryFn: () => listarDocumentos(params),
    placeholderData: keepPreviousData,
  })
  const { data: totais } = useQuery({ queryKey: ['documentos-totais'], queryFn: totaisDocumentos })

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['documentos'] })
    void qc.invalidateQueries({ queryKey: ['documentos-totais'] })
    setArquivando(null)
  }
  const arquivar = useMutation({ mutationFn: arquivarDocumento, onSuccess: invalidar })
  const restaurar = useMutation({ mutationFn: restaurarDocumento, onSuccess: invalidar })

  const naLixeira = tabela.escopo === 'lixeira'

  const colunas = useMemo<ColumnDef<Documento, unknown>[]>(
    () => [
      {
        id: 'nome',
        header: 'Documento',
        cell: ({ row }) => {
          const d = row.original
          return (
            <div className="flex min-w-0 items-center gap-2.5">
              <span aria-hidden className="text-base">{iconePorExtensao(d.extensao)}</span>
              <div className="min-w-0">
                <p className="truncate font-medium text-text">{d.nome}</p>
                <p className="truncate text-[12px] text-text-muted">
                  {rotuloTipo[d.tipo]} · v{d.versaoAtual} · {formatarTamanho(d.tamanhoBytes)}
                </p>
              </div>
            </div>
          )
        },
      },
      {
        id: 'vinculo',
        header: 'Vinculado a',
        enableSorting: false,
        cell: ({ row }) => {
          const v = row.original.vinculo
          return (
            <div className="min-w-0">
              <p className="truncate text-text-secondary">{v.rotulo}</p>
              <p className="text-[11px] uppercase tracking-wide text-text-muted">{v.tipo}</p>
            </div>
          )
        },
      },
      {
        id: 'validade',
        header: 'Validade',
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => {
          const d = row.original
          if (!d.validade) return <span className="text-[13px] text-text-muted">não vence</span>
          const dias = diasParaVencer(d)!
          return (
            <div className="text-right">
              <p className={cn('tabular-nums', estaVencido(d) ? 'font-semibold text-critical' : estaVencendo(d) ? 'font-semibold text-warning' : 'text-text-secondary')}>
                {date(d.validade)}
              </p>
              <p className="text-[11px] text-text-muted">
                {dias >= 0 ? `em ${number(dias)} dias` : `venceu há ${number(Math.abs(dias))} dias`}
              </p>
            </div>
          )
        },
      },
      {
        id: 'confidencialidade',
        header: 'Sigilo',
        cell: ({ row }) => {
          const d = row.original
          const info = sigiloInfo[d.confidencialidade]
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tom={info.tom}>{info.rotulo}</Badge>
              {estaVencido(d) && <Badge tom="critical">Vencido</Badge>}
              {estaVencendo(d) && <Badge tom="warning">Vencendo</Badge>}
              {semVinculo(d) && <Badge tom="warning">Sem vínculo</Badge>}
            </div>
          )
        },
      },
      {
        id: 'enviadoEm',
        header: 'Enviado em',
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => (
          <div className="text-right">
            <p className="tabular-nums text-text-secondary">{date(row.original.enviadoEm)}</p>
            <p className="text-[11px] text-text-muted">{row.original.enviadoPor}</p>
          </div>
        ),
      },
      {
        id: 'acoes',
        header: 'Ações',
        enableSorting: false,
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => {
          const d = row.original
          return (
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                title={`Baixar ${d.nome}`}
                aria-label={`Baixar ${d.nome}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text"
              >
                <span aria-hidden>⬇️</span>
              </button>
              {naLixeira ? (
                <button
                  type="button"
                  title={`Restaurar ${d.nome}`}
                  aria-label={`Restaurar ${d.nome}`}
                  onClick={(e) => { e.stopPropagation(); restaurar.mutate(d.id) }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text"
                >
                  <span aria-hidden>↩️</span>
                </button>
              ) : (
                <button
                  type="button"
                  title={`Arquivar ${d.nome}`}
                  aria-label={`Arquivar ${d.nome}`}
                  onClick={(e) => { e.stopPropagation(); setArquivando(d) }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-critical/10 hover:text-critical"
                >
                  <span aria-hidden>🗃️</span>
                </button>
              )}
            </div>
          )
        },
      },
    ],
    [naLixeira, restaurar],
  )

  const cartoes = [
    { rotulo: 'Documentos', valor: totais ? number(totais.total) : null, nota: totais ? formatarTamanho(totais.espacoBytes) : undefined },
    { rotulo: `Vencendo em ${JANELA_RENOVACAO_DIAS} dias`, valor: totais ? number(totais.vencendo) : null, nota: 'janela de renovação', destaque: 'text-warning' },
    { rotulo: 'Vencidos', valor: totais ? number(totais.vencidos) : null, nota: 'não valem mais como prova', destaque: 'text-critical' },
    { rotulo: 'Sem vínculo', valor: totais ? number(totais.semVinculo) : null, nota: 'ninguém acha depois' },
  ]

  return (
    <div className="space-y-2 sm:space-y-4 lg:space-y-6">
      <PageHeader
        titulo="Documentos"
        descricao="Todo arquivo vinculado a alguém, com versão, validade e prazo de compartilhamento."
        acoes={
          <>
            <BotaoExportar
              nomeArquivo="documentos"
              titulo="Repositório de documentos"
              subtitulo={naLixeira ? 'Arquivados' : 'Ativos'}
              orientacao="paisagem"
              colunas={[
                { chave: 'nome', cabecalho: 'Documento', peso: 2.4, valor: (d: Documento) => d.nome },
                { chave: 'tipo', cabecalho: 'Tipo', peso: 1.1, valor: (d: Documento) => rotuloTipo[d.tipo] },
                { chave: 'vinculo', cabecalho: 'Vinculado a', peso: 2.2, valor: (d: Documento) => d.vinculo.rotulo },
                { chave: 'versao', cabecalho: 'Versão', peso: 0.8, alinhamento: 'direita', valor: (d: Documento) => `v${d.versaoAtual}`, valorCsv: (d: Documento) => d.versaoAtual },
                { chave: 'validade', cabecalho: 'Validade', peso: 1.1, alinhamento: 'direita', valor: (d: Documento) => (d.validade ? date(d.validade) : 'não vence'), valorCsv: (d: Documento) => d.validade?.slice(0, 10) ?? '' },
                { chave: 'sigilo', cabecalho: 'Sigilo', peso: 1, valor: (d: Documento) => sigiloInfo[d.confidencialidade].rotulo },
              ]}
              buscarLinhas={async () => (await listarDocumentos({ ...params, page: 1, perPage: 10_000 })).data}
            />
            <Button><span aria-hidden>⬆️</span> Enviar documento</Button>
          </>
        }
      />

      <GradeResumo>
        {cartoes.map((cartao) => (
          <CartaoResumo
            key={cartao.rotulo}
            rotulo={cartao.rotulo}
            valor={cartao.valor}
            nota={cartao.nota}
            destaque={cartao.destaque}
          />
        ))}
      </GradeResumo>

      {/* Arquivado é o mesmo recorte da mesma listagem, não outra tela. */}
      <div role="tablist" aria-label="Escopo" className="flex items-center gap-1 border-b border-border">
        {([
          { id: 'ativos', rotulo: 'Ativos', icone: '📂' },
          { id: 'lixeira', rotulo: 'Arquivados', icone: '🗃️' },
        ] as const).map((escopo) => {
          const ativa = (tabela.escopo ?? 'ativos') === escopo.id
          return (
            <button
              key={escopo.id}
              role="tab"
              aria-selected={ativa}
              onClick={() => tabela.setEscopo(escopo.id)}
              className={cn(
                '-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors',
                ativa ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:border-border-strong hover:text-text',
              )}
            >
              <span aria-hidden>{escopo.icone}</span>{escopo.rotulo}
            </button>
          )
        })}
      </div>

      <DataTable
        columns={colunas}
        resposta={data}
        carregando={isFetching && !data}
        erro={error}
        sortBy={tabela.sortBy}
        sortDir={tabela.sortDir}
        onSort={tabela.setSort}
        onPage={tabela.setPage}
        onPerPage={tabela.setPerPage}
        onLinhaClick={(d) => navigate(`/documentos/${d.id}`)}
        vazio={{
          titulo: naLixeira ? 'Nenhum documento arquivado' : 'Nenhum documento com esses filtros',
          descricao: naLixeira ? 'Nada foi arquivado por aqui.' : 'Ajuste o tipo, o sigilo ou a validade.',
        }}
        toolbar={
          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
            <label className="relative min-w-0 flex-1 sm:max-w-xs">
              <span className="sr-only">Buscar documento</span>
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-text-muted">🔍</span>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome, vínculo ou etiqueta…"
                className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-muted hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
            </label>

            <Select
              aria-label="Filtrar por tipo"
              value={tabela.filters?.tipo ?? ''}
              onChange={(e) => tabela.setFilter('tipo', e.target.value || undefined)}
              className="w-full sm:w-44"
            >
              <option value="">Todos os tipos</option>
              {Object.entries(rotuloTipo).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>

            <Select
              aria-label="Filtrar por validade"
              value={tabela.filters?.validade ?? ''}
              onChange={(e) => tabela.setFilter('validade', e.target.value || undefined)}
              className="w-full sm:w-44"
            >
              <option value="">Qualquer validade</option>
              <option value="vencendo">Vencendo (derivado)</option>
              <option value="vencido">Vencido (derivado)</option>
              <option value="sem_validade">Não vence</option>
            </Select>

            <Select
              aria-label="Filtrar por sigilo"
              value={tabela.filters?.confidencialidade ?? ''}
              onChange={(e) => tabela.setFilter('confidencialidade', e.target.value || undefined)}
              className="w-full sm:w-40"
            >
              <option value="">Todos os sigilos</option>
              <option value="interno">Interno</option>
              <option value="restrito">Restrito</option>
              <option value="confidencial">Confidencial</option>
            </Select>

            {tabela.temFiltro && (
              <Button variant="ghost" size="sm" onClick={() => { setBusca(''); tabela.limparFiltros() }}>Limpar</Button>
            )}
          </div>
        }
      />

      <ConfirmarAcao
        aberto={!!arquivando}
        titulo="Arquivar documento"
        rotuloConfirmar="Arquivar"
        tom="primary"
        carregando={arquivar.isPending}
        onCancelar={() => setArquivando(null)}
        onConfirmar={() => arquivando && arquivar.mutate(arquivando.id)}
        mensagem={
          <>
            <strong className="font-semibold text-text">{arquivando?.nome}</strong> sai do repositório ativo
            e continua acessível na aba <strong className="font-semibold text-text">Arquivados</strong>. O
            arquivo não é apagado — documento é prova, e prova não se joga fora por engano.
          </>
        }
      />
    </div>
  )
}
