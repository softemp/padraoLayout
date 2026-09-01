import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  ATENDENTES, categoriasChamado, emAberto, formatarMinutos, listarChamados,
  minutosParaPrimeiraResposta, prioridadeChamado, SLA, slaEmRisco, slaRespostaEstourado,
  slaResolucaoConsumido, slaResolucaoEstourado, totaisChamados,
} from '@/shared/api/chamados'
import type { Chamado, Prioridade, SituacaoChamado } from '@/shared/api/types'
import { useTableState } from '@/shared/hooks/useTableState'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { BotaoExportar } from '@/shared/ui/BotaoExportar'
import { Card, CardHeader } from '@/shared/ui/Card'
import { DataTable } from '@/shared/ui/DataTable'
import { Select } from '@/shared/ui/Field'
import { PageHeader } from '@/shared/ui/PageHeader'
import { cn } from '@/shared/lib/cn'
import { CartaoResumo, GradeResumo } from '@/shared/ui/CartaoResumo'
import { number, percent } from '@/shared/lib/format'

const situacaoInfo: Record<SituacaoChamado, { tom: 'info' | 'warning' | 'good' | 'neutro'; rotulo: string }> = {
  novo: { tom: 'warning', rotulo: 'Novo' },
  em_atendimento: { tom: 'info', rotulo: 'Em atendimento' },
  aguardando_cliente: { tom: 'neutro', rotulo: 'Aguardando cliente' },
  resolvido: { tom: 'good', rotulo: 'Resolvido' },
  fechado: { tom: 'neutro', rotulo: 'Fechado' },
  cancelado: { tom: 'neutro', rotulo: 'Cancelado' },
}

const corPrioridade: Record<Prioridade, string> = {
  P1: 'bg-critical text-white', P2: 'bg-warning text-[rgb(60,40,0)]', P3: 'bg-primary/15 text-primary', P4: 'bg-surface-3 text-text-muted',
}

export function ChamadosPage() {
  const navigate = useNavigate()
  // Ordem padrão da fila: quem está mais perto de estourar, não quem chegou antes.
  const tabela = useTableState({ sortBy: 'sla', sortDir: 'desc', filtros: ['situacao', 'prioridade', 'responsavel', 'categoria'] })
  const [busca, setBusca] = useState(tabela.search ?? '')
  const buscaDebounced = useDebouncedValue(busca, 450)

  useEffect(() => {
    if (buscaDebounced !== (tabela.search ?? '')) tabela.setSearch(buscaDebounced)
  }, [buscaDebounced]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtro = {
    page: tabela.page, perPage: tabela.perPage, sortBy: tabela.sortBy, sortDir: tabela.sortDir,
    search: tabela.search, filters: tabela.filters,
  }

  const { data, isFetching, error } = useQuery({
    queryKey: ['chamados', filtro],
    queryFn: () => listarChamados(filtro),
    placeholderData: keepPreviousData,
    // A fila muda sozinha: o relógio corre mesmo sem ninguém mexer.
    refetchInterval: 60_000,
  })
  const { data: totais } = useQuery({ queryKey: ['chamados-totais'], queryFn: totaisChamados, refetchInterval: 60_000 })

  const colunas = useMemo<ColumnDef<Chamado, unknown>[]>(
    () => [
      {
        id: 'numero',
        header: 'Chamado',
        cell: ({ row }) => {
          const c = row.original
          return (
            <div className="flex min-w-0 items-center gap-2.5">
              <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold', corPrioridade[prioridadeChamado(c)])}>
                {prioridadeChamado(c)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-text">{c.assunto}</p>
                <p className="truncate text-[12px] text-text-muted">{c.numero} · {c.cliente} · {c.canal}</p>
              </div>
            </div>
          )
        },
      },
      {
        id: 'resposta',
        header: '1ª resposta',
        enableSorting: false,
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => {
          const c = row.original
          const min = minutosParaPrimeiraResposta(c)
          const limite = SLA[prioridadeChamado(c)].resposta
          return (
            <div className="text-right">
              <p className={cn('tabular-nums', c.primeiraRespostaEm ? (min > limite ? 'text-critical' : 'text-good') : 'font-semibold text-warning')}>
                {formatarMinutos(min)}
              </p>
              <p className="text-[11px] text-text-muted">meta {formatarMinutos(limite)}</p>
            </div>
          )
        },
      },
      {
        id: 'sla',
        header: 'SLA de resolução',
        cell: ({ row }) => {
          const c = row.original
          const consumo = slaResolucaoConsumido(c)
          return (
            <div className="w-36">
              <div className="flex items-baseline justify-between gap-2">
                <span className={cn('text-[12px] font-semibold tabular-nums', consumo > 1 ? 'text-critical' : consumo > 0.8 ? 'text-warning' : 'text-text-secondary')}>
                  {percent(consumo)}
                </span>
                {c.situacao === 'aguardando_cliente' && <span className="text-[10px] text-text-muted">⏸ pausado</span>}
              </div>
              <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                <span
                  className={cn('block h-full rounded-full', consumo > 1 ? 'bg-critical' : consumo > 0.8 ? 'bg-warning' : 'bg-primary')}
                  style={{ width: `${Math.min(consumo, 1) * 100}%` }}
                />
              </span>
            </div>
          )
        },
      },
      {
        id: 'situacao',
        header: 'Situação',
        cell: ({ row }) => {
          const c = row.original
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tom={situacaoInfo[c.situacao].tom}>{situacaoInfo[c.situacao].rotulo}</Badge>
              {emAberto(c) && slaResolucaoEstourado(c) && <Badge tom="critical">SLA estourado</Badge>}
              {slaEmRisco(c) && <Badge tom="warning">Em risco</Badge>}
              {slaRespostaEstourado(c) && !c.primeiraRespostaEm && <Badge tom="critical">Sem resposta</Badge>}
              {c.reaberturas > 0 && <Badge tom="warning">{c.reaberturas}× reaberto</Badge>}
            </div>
          )
        },
      },
      {
        id: 'responsavel',
        header: 'Responsável',
        cell: ({ row }) =>
          row.original.responsavel
            ? <span className="text-text-secondary">{row.original.responsavel}</span>
            : <Badge tom="warning">sem responsável</Badge>,
      },
      {
        id: 'acoes',
        header: 'Ações',
        enableSorting: false,
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => (
          <button
            type="button"
            title={`Abrir ${row.original.numero}`}
            aria-label={`Abrir ${row.original.numero}`}
            onClick={(e) => { e.stopPropagation(); navigate(`/chamados/${row.original.id}`) }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text"
          >
            <span aria-hidden>💬</span>
          </button>
        ),
      },
    ],
    [navigate],
  )

  const cartoes = [
    { rotulo: 'Chamados abertos', valor: totais ? number(totais.abertos) : null, nota: totais ? `${totais.semResponsavel} sem responsável` : undefined },
    { rotulo: 'SLA estourado', valor: totais ? number(totais.slaEstourado) : null, destaque: 'text-critical' },
    { rotulo: 'Em risco (>80%)', valor: totais ? number(totais.slaEmRisco) : null, destaque: 'text-warning', nota: 'ainda dá para salvar' },
    { rotulo: '1ª resposta média', valor: totais ? formatarMinutos(totais.primeiraRespostaMedia) : null, nota: totais ? `reabertura ${percent(totais.taxaReabertura)}` : undefined },
  ]

  return (
    <div className="space-y-2 sm:space-y-4 lg:space-y-6">
      <PageHeader
        titulo="Chamados"
        descricao="Fila ordenada por quem está mais perto de estourar — não por ordem de chegada."
        acoes={
          <>
            <BotaoExportar
              nomeArquivo="chamados"
              titulo="Fila de chamados"
              orientacao="paisagem"
              colunas={[
                { chave: 'numero', cabecalho: 'Chamado', peso: 1, valor: (c: Chamado) => c.numero },
                { chave: 'assunto', cabecalho: 'Assunto', peso: 2.2, valor: (c: Chamado) => c.assunto },
                { chave: 'cliente', cabecalho: 'Cliente', peso: 2, valor: (c: Chamado) => c.cliente },
                { chave: 'prioridade', cabecalho: 'Prioridade', peso: 0.9, valor: (c: Chamado) => prioridadeChamado(c) },
                { chave: 'resposta', cabecalho: '1ª resposta', peso: 1.1, alinhamento: 'direita', valor: (c: Chamado) => formatarMinutos(minutosParaPrimeiraResposta(c)) },
                { chave: 'sla', cabecalho: 'SLA consumido', peso: 1.2, alinhamento: 'direita', valor: (c: Chamado) => percent(slaResolucaoConsumido(c)), valorCsv: (c: Chamado) => Number((slaResolucaoConsumido(c) * 100).toFixed(1)) },
                { chave: 'situacao', cabecalho: 'Situação', peso: 1.4, valor: (c: Chamado) => situacaoInfo[c.situacao].rotulo },
              ]}
              buscarLinhas={async () => (await listarChamados({ ...filtro, page: 1, perPage: 10_000 })).data}
            />
            <Button><span aria-hidden>＋</span> Novo chamado</Button>
          </>
        }
      />

      <GradeResumo>
        {cartoes.map((c) => (
          <CartaoResumo
            key={c.rotulo}
            rotulo={c.rotulo}
            valor={c.valor}
            nota={c.nota}
            destaque={c.destaque}
          />
        ))}
      </GradeResumo>

      <Card>
        <CardHeader
          titulo="Dois relógios, não um"
          descricao="Primeira resposta é o que o cliente sente; resolução é o que ele contratou. E o relógio para enquanto a bola está com ele — senão a equipe é cobrada pela demora de quem não respondeu."
          acoes={
            <Button size="sm" variant="secondary" onClick={() => tabela.setFilter('situacao', 'sem_responsavel')}>
              Ver sem responsável
            </Button>
          }
        />
      </Card>

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
        onLinhaClick={(c) => navigate(`/chamados/${c.id}`)}
        vazio={{ titulo: 'Nenhum chamado com esses filtros', descricao: 'Ajuste a situação, a prioridade ou o responsável.' }}
        toolbar={
          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
            <label className="relative min-w-0 flex-1 sm:max-w-xs">
              <span className="sr-only">Buscar chamado</span>
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-text-muted">🔍</span>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Número, assunto ou cliente…"
                className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
            </label>

            <Select aria-label="Situação" value={tabela.filters?.situacao ?? ''} onChange={(e) => tabela.setFilter('situacao', e.target.value || undefined)} className="w-full sm:w-52">
              <option value="">Todas as situações</option>
              <option value="estourado">SLA estourado (derivado)</option>
              <option value="em_risco">Em risco (derivado)</option>
              <option value="sem_responsavel">Sem responsável</option>
              <option value="novo">Novo</option>
              <option value="em_atendimento">Em atendimento</option>
              <option value="aguardando_cliente">Aguardando cliente</option>
              <option value="resolvido">Resolvido</option>
            </Select>

            <Select aria-label="Prioridade" value={tabela.filters?.prioridade ?? ''} onChange={(e) => tabela.setFilter('prioridade', e.target.value || undefined)} className="w-full sm:w-32">
              <option value="">Toda prioridade</option>
              <option value="P1">P1</option><option value="P2">P2</option>
              <option value="P3">P3</option><option value="P4">P4</option>
            </Select>

            <Select aria-label="Responsável" value={tabela.filters?.responsavel ?? ''} onChange={(e) => tabela.setFilter('responsavel', e.target.value || undefined)} className="w-full sm:w-40">
              <option value="">Todos</option>
              {ATENDENTES.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>

            <Select aria-label="Categoria" value={tabela.filters?.categoria ?? ''} onChange={(e) => tabela.setFilter('categoria', e.target.value || undefined)} className="w-full sm:w-44">
              <option value="">Todas as categorias</option>
              {categoriasChamado.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>

            {tabela.temFiltro && <Button variant="ghost" size="sm" onClick={() => { setBusca(''); tabela.limparFiltros() }}>Limpar</Button>}
          </div>
        }
      />
    </div>
  )
}
