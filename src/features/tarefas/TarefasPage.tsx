import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  estaAtrasada, etiquetasDisponiveis, listarTarefas, moverTarefa, obterQuadro,
  SITUACOES, totaisTarefas, USUARIO_ATUAL, venceHoje,
} from '@/shared/api/tarefas'
import type { SituacaoTarefa, Tarefa } from '@/shared/api/types'
import { useTableState } from '@/shared/hooks/useTableState'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/ui/DataTable'
import { Select } from '@/shared/ui/Field'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { date, number } from '@/shared/lib/format'
import { TarefaCard } from './TarefaCard'
import { TarefaModal } from './TarefaModal'

export function TarefasPage() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const visao = (params.get('visao') ?? 'quadro') as 'quadro' | 'lista'
  const soMinhas = params.get('minhas') !== '0'

  const tabela = useTableState({ sortBy: 'prazo', sortDir: 'asc', filtros: ['situacao', 'prioridade', 'prazo', 'etiqueta'] })
  const [busca, setBusca] = useState(tabela.search ?? '')
  const buscaDebounced = useDebouncedValue(busca, 450)
  const [aberta, setAberta] = useState<Tarefa | null>(null)
  const [arrastando, setArrastando] = useState<number | null>(null)
  const [erroMover, setErroMover] = useState<string | null>(null)

  useEffect(() => {
    if (buscaDebounced !== (tabela.search ?? '')) tabela.setSearch(buscaDebounced)
  }, [buscaDebounced]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtro = {
    page: tabela.page, perPage: tabela.perPage, sortBy: tabela.sortBy, sortDir: tabela.sortDir,
    search: tabela.search, filters: tabela.filters,
    responsavel: soMinhas ? USUARIO_ATUAL : undefined,
  }

  const quadro = useQuery({ queryKey: ['tarefas-quadro', filtro], queryFn: () => obterQuadro(filtro), enabled: visao === 'quadro' })
  const lista = useQuery({
    queryKey: ['tarefas', filtro],
    queryFn: () => listarTarefas(filtro),
    enabled: visao === 'lista',
    placeholderData: keepPreviousData,
  })
  const { data: totais } = useQuery({ queryKey: ['tarefas-totais'], queryFn: totaisTarefas })

  const mover = useMutation({
    mutationFn: ({ id, situacao, forcar }: { id: number; situacao: SituacaoTarefa; forcar?: boolean }) =>
      moverTarefa(id, situacao, forcar),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tarefas-quadro'] })
      void qc.invalidateQueries({ queryKey: ['tarefas'] })
      void qc.invalidateQueries({ queryKey: ['tarefas-totais'] })
      setErroMover(null)
    },
    onError: (e: Error) => setErroMover(e.message),
  })

  const colunas = useMemo<ColumnDef<Tarefa, unknown>[]>(
    () => [
      {
        id: 'titulo',
        header: 'Tarefa',
        cell: ({ row }) => (
          <button type="button" onClick={() => setAberta(row.original)} className="min-w-0 text-left">
            <p className="truncate font-medium text-text">{row.original.titulo}</p>
            <p className="truncate text-[12px] text-text-muted">{row.original.vinculo.rotulo}</p>
          </button>
        ),
      },
      {
        id: 'responsavel',
        header: 'Responsável',
        cell: ({ row }) =>
          row.original.responsavel ? (
            <span className="flex items-center gap-2">
              <Avatar nome={row.original.responsavel} size="sm" />
              <span className="text-text-secondary">{row.original.responsavel}</span>
            </span>
          ) : (
            <Badge tom="warning">sem responsável</Badge>
          ),
      },
      {
        id: 'prazo',
        header: 'Prazo',
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => {
          const t = row.original
          if (!t.prazo) return <span className="text-[13px] text-text-muted">sem prazo</span>
          return (
            <span className={cn('tabular-nums', estaAtrasada(t) ? 'font-semibold text-critical' : venceHoje(t) ? 'font-semibold text-warning' : 'text-text-secondary')}>
              {date(t.prazo)}
            </span>
          )
        },
      },
      { id: 'prioridade', header: 'Prioridade', cell: ({ row }) => <span className="text-text-secondary">{row.original.prioridade}</span> },
      {
        id: 'situacao',
        header: 'Situação',
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tom={row.original.situacao === 'concluida' ? 'good' : 'info'}>
              {SITUACOES.find((s) => s.id === row.original.situacao)?.rotulo ?? row.original.situacao}
            </Badge>
            {estaAtrasada(row.original) && <Badge tom="critical">Atrasada</Badge>}
          </div>
        ),
      },
    ],
    [],
  )

  const cartoes = [
    { rotulo: 'Minhas tarefas abertas', valor: totais ? number(totais.minhas) : null },
    { rotulo: 'Atrasadas', valor: totais ? number(totais.atrasadas) : null, destaque: 'text-critical' },
    { rotulo: 'Sem responsável', valor: totais ? number(totais.semResponsavel) : null, destaque: 'text-warning', nota: 'é lembrete, não tarefa' },
    { rotulo: 'Concluídas na semana', valor: totais ? number(totais.concluidasSemana) : null, destaque: 'text-good' },
  ]

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        titulo="Tarefas"
        descricao="O que precisa ser feito, por quem e até quando — no quadro ou na lista."
        acoes={
          <>
            <div className="flex rounded-lg border border-border p-0.5">
              {(['quadro', 'lista'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.set('visao', v); return n }, { replace: true })}
                  aria-pressed={visao === v}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                    visao === v ? 'bg-surface-3 text-text' : 'text-text-muted hover:text-text',
                  )}
                >
                  {v === 'quadro' ? '▦ Quadro' : '☰ Lista'}
                </button>
              ))}
            </div>
            <Button><span aria-hidden>＋</span> Nova tarefa</Button>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cartoes.map((cartao) => (
          <div key={cartao.rotulo} className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <p className="text-[13px] font-medium text-text-muted">{cartao.rotulo}</p>
            {cartao.valor === null ? <Skeleton className="mt-2 h-7 w-16" /> : (
              <p className={cn('mt-1 text-xl font-semibold tabular-nums lg:text-2xl', cartao.destaque ?? 'text-text')}>{cartao.valor}</p>
            )}
            {cartao.nota && <p className="mt-1 text-[12px] text-text-muted">{cartao.nota}</p>}
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface p-2.5 sm:gap-3">
        <label className="relative min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Buscar tarefa</span>
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-text-muted">🔍</span>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Título ou vínculo…"
            className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </label>

        {/* "Minhas" ligado por padrão: quadro de time inteiro é ruído para quem
            só quer saber o que É DELE hoje. */}
        <button
          type="button"
          onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.set('minhas', soMinhas ? '0' : '1'); return n }, { replace: true })}
          aria-pressed={soMinhas}
          className={cn(
            'flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-colors',
            soMinhas ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-secondary hover:bg-surface-2',
          )}
        >
          <Avatar nome={USUARIO_ATUAL} size="sm" /> Só as minhas
        </button>

        <Select aria-label="Prioridade" value={tabela.filters?.prioridade ?? ''} onChange={(e) => tabela.setFilter('prioridade', e.target.value || undefined)} className="w-full sm:w-36">
          <option value="">Toda prioridade</option>
          <option value="urgente">Urgente</option>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </Select>

        <Select aria-label="Prazo" value={tabela.filters?.prazo ?? ''} onChange={(e) => tabela.setFilter('prazo', e.target.value || undefined)} className="w-full sm:w-40">
          <option value="">Qualquer prazo</option>
          <option value="atrasada">Atrasadas (derivado)</option>
          <option value="hoje">Vencem hoje</option>
          <option value="sem_prazo">Sem prazo</option>
        </Select>

        <Select aria-label="Etiqueta" value={tabela.filters?.etiqueta ?? ''} onChange={(e) => tabela.setFilter('etiqueta', e.target.value || undefined)} className="w-full sm:w-36">
          <option value="">Toda etiqueta</option>
          {etiquetasDisponiveis.map((e) => <option key={e} value={e}>{e}</option>)}
        </Select>

        {tabela.temFiltro && <Button variant="ghost" size="sm" onClick={() => { setBusca(''); tabela.limparFiltros() }}>Limpar</Button>}
      </div>

      {erroMover && (
        <p role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-text-secondary">
          <span><span aria-hidden>⚠️ </span>{erroMover}</span>
          <button type="button" onClick={() => setErroMover(null)} className="font-medium text-primary hover:underline">entendi</button>
        </p>
      )}

      {visao === 'quadro' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {SITUACOES.map((coluna) => {
            const cartoesColuna = quadro.data?.[coluna.id] ?? []
            const estourou = coluna.limite != null && cartoesColuna.length > coluna.limite
            return (
              <section
                key={coluna.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (arrastando) mover.mutate({ id: arrastando, situacao: coluna.id }); setArrastando(null) }}
                className="flex flex-col rounded-xl border border-border bg-surface-2/50 p-2.5"
              >
                <header className="flex items-center justify-between gap-2 px-1 pb-2.5">
                  <h2 className="text-[13px] font-semibold text-text">{coluna.rotulo}</h2>
                  {/* O limite fica visível SEMPRE, não só quando estoura: é ele
                      que faz a pergunta "o que terminamos antes de puxar mais?" */}
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                    estourou ? 'bg-critical/15 text-critical' : 'bg-surface-3 text-text-muted')}>
                    {cartoesColuna.length}{coluna.limite ? `/${coluna.limite}` : ''}
                  </span>
                </header>

                <div className="flex flex-1 flex-col gap-2.5">
                  {quadro.isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}

                  {cartoesColuna.map((tarefa) => (
                    <TarefaCard
                      key={tarefa.id}
                      tarefa={tarefa}
                      arrastando={arrastando === tarefa.id}
                      onDragStart={() => setArrastando(tarefa.id)}
                      onDragEnd={() => setArrastando(null)}
                      onAbrir={() => setAberta(tarefa)}
                      onMover={(situacao) => mover.mutate({ id: tarefa.id, situacao })}
                    />
                  ))}

                  {!quadro.isLoading && cartoesColuna.length === 0 && (
                    <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[12px] text-text-muted">
                      nada por aqui
                    </p>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <DataTable
          columns={colunas}
          resposta={lista.data}
          carregando={lista.isFetching && !lista.data}
          erro={lista.error}
          sortBy={tabela.sortBy}
          sortDir={tabela.sortDir}
          onSort={tabela.setSort}
          onPage={tabela.setPage}
          onPerPage={tabela.setPerPage}
          onLinhaClick={(t) => setAberta(t)}
          vazio={{ titulo: 'Nenhuma tarefa com esses filtros', descricao: 'Troque o responsável, o prazo ou a etiqueta.' }}
        />
      )}

      {/* Sem responsável é o vazamento silencioso do quadro: a tarefa existe,
          está na coluna, e ninguém acordou pensando nela. */}
      {(totais?.semResponsavel ?? 0) > 0 && !soMinhas && (
        <p className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-[13px] text-text-secondary">
          <strong className="text-text">{number(totais!.semResponsavel)} tarefas sem responsável.</strong> Tarefa
          sem dono e sem prazo é lembrete: ela não é feita, é reencontrada meses depois.{' '}
          <button type="button" onClick={() => tabela.setFilter('prazo', undefined)} className="font-medium text-primary hover:underline">
            ver na lista
          </button>
        </p>
      )}

      <TarefaModal tarefa={aberta} onFechar={() => setAberta(null)} />
    </div>
  )
}
