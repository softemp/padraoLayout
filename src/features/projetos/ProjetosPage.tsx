import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  atrasado, avancoFisico, consumoHoras, derrapando, desvio, estourandoHoras, listarProjetos,
  margemProjeto, responsaveisProjeto, totaisProjetos,
} from '@/shared/api/projetos'
import type { Projeto, SituacaoProjeto } from '@/shared/api/types'
import { useTableState } from '@/shared/hooks/useTableState'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { BotaoExportar } from '@/shared/ui/BotaoExportar'
import { Card, CardHeader } from '@/shared/ui/Card'
import { DataTable } from '@/shared/ui/DataTable'
import { Select } from '@/shared/ui/Field'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { NovoProjetoModal } from './NovoProjetoModal'
import { date, number, percent } from '@/shared/lib/format'

const situacaoInfo: Record<SituacaoProjeto, { tom: 'good' | 'info' | 'warning' | 'neutro' | 'critical'; rotulo: string }> = {
  planejado: { tom: 'neutro', rotulo: 'Planejado' },
  em_andamento: { tom: 'info', rotulo: 'Em andamento' },
  em_risco: { tom: 'warning', rotulo: 'Em risco' },
  pausado: { tom: 'neutro', rotulo: 'Pausado' },
  concluido: { tom: 'good', rotulo: 'Concluído' },
  cancelado: { tom: 'neutro', rotulo: 'Cancelado' },
}

/**
 * A barra dupla é o coração da tela: consumo de horas em cima, avanço físico
 * embaixo. Uma barra só — a de horas — é a que faz o projeto estourar sem
 * ninguém ver chegando.
 */
function BarraDupla({ projeto }: { projeto: Projeto }) {
  const consumo = consumoHoras(projeto)
  const avanco = avancoFisico(projeto.id)
  const d = desvio(projeto)

  return (
    <div className="w-40 space-y-1">
      <div className="flex items-center gap-1.5">
        <span className="w-10 text-[10px] uppercase tracking-wide text-text-muted">horas</span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
          <span
            className={cn('block h-full rounded-full', consumo > 1 ? 'bg-critical' : d > 0.2 ? 'bg-warning' : 'bg-primary')}
            style={{ width: `${Math.min(consumo, 1) * 100}%` }}
          />
        </span>
        <span className="w-9 text-right text-[11px] tabular-nums text-text-secondary">{percent(consumo)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-10 text-[10px] uppercase tracking-wide text-text-muted">entrega</span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
          <span className="block h-full rounded-full bg-good" style={{ width: `${avanco * 100}%` }} />
        </span>
        <span className="w-9 text-right text-[11px] tabular-nums text-text-secondary">{percent(avanco)}</span>
      </div>
    </div>
  )
}

export function ProjetosPage() {
  const navigate = useNavigate()
  const tabela = useTableState({ sortBy: 'prazo', sortDir: 'asc', filtros: ['situacao', 'responsavel'] })
  const [busca, setBusca] = useState(tabela.search ?? '')
  const [criando, setCriando] = useState(false)
  const buscaDebounced = useDebouncedValue(busca, 450)

  useEffect(() => {
    if (buscaDebounced !== (tabela.search ?? '')) tabela.setSearch(buscaDebounced)
  }, [buscaDebounced]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtro = {
    page: tabela.page, perPage: tabela.perPage, sortBy: tabela.sortBy, sortDir: tabela.sortDir,
    search: tabela.search, filters: tabela.filters,
  }

  const { data, isFetching, error } = useQuery({
    queryKey: ['projetos', filtro],
    queryFn: () => listarProjetos(filtro),
    placeholderData: keepPreviousData,
  })
  const { data: totais } = useQuery({ queryKey: ['projetos-totais'], queryFn: totaisProjetos })

  const colunas = useMemo<ColumnDef<Projeto, unknown>[]>(
    () => [
      {
        id: 'nome',
        header: 'Projeto',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-text">{row.original.nome}</p>
            <p className="truncate text-[12px] text-text-muted">{row.original.codigo} · {row.original.cliente}</p>
          </div>
        ),
      },
      {
        id: 'desvio',
        header: 'Consumo × entrega',
        enableSorting: true,
        cell: ({ row }) => <BarraDupla projeto={row.original} />,
      },
      {
        id: 'prazo',
        header: 'Prazo',
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => {
          const p = row.original
          const replanejado = p.prazo !== p.prazoBaseline
          return (
            <div className="text-right">
              <p className={cn('tabular-nums', atrasado(p) ? 'font-semibold text-critical' : 'text-text-secondary')}>{date(p.prazo)}</p>
              {replanejado && <p className="text-[11px] text-text-muted">baseline {date(p.prazoBaseline)}</p>}
            </div>
          )
        },
      },
      {
        id: 'margem',
        header: 'Margem',
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => {
          const m = margemProjeto(row.original)
          return (
            <span className={cn('font-semibold tabular-nums', m <= 0 ? 'text-critical' : m < 0.2 ? 'text-warning' : 'text-good')}>
              {percent(m)}
            </span>
          )
        },
      },
      {
        id: 'situacao',
        header: 'Situação',
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tom={situacaoInfo[row.original.situacao].tom}>{situacaoInfo[row.original.situacao].rotulo}</Badge>
            {atrasado(row.original) && <Badge tom="critical">Atrasado</Badge>}
            {derrapando(row.original) && <Badge tom="warning">Derrapando</Badge>}
            {estourandoHoras(row.original) && <Badge tom="critical">Horas estouradas</Badge>}
          </div>
        ),
      },
      { id: 'responsavel', header: 'Responsável', cell: ({ row }) => <span className="text-text-secondary">{row.original.responsavel}</span> },
      {
        id: 'acoes',
        header: 'Ações',
        enableSorting: false,
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => (
          <button
            type="button"
            title={`Abrir ${row.original.codigo}`}
            aria-label={`Abrir ${row.original.codigo}`}
            onClick={(e) => { e.stopPropagation(); navigate(`/projetos/${row.original.id}`) }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text"
          >
            <span aria-hidden>📁</span>
          </button>
        ),
      },
    ],
    [navigate],
  )

  const cartoes = [
    { rotulo: 'Em andamento', valor: totais ? number(totais.emAndamento) : null },
    { rotulo: 'Atrasados', valor: totais ? number(totais.atrasados) : null, destaque: 'text-critical' },
    { rotulo: 'Horas estouradas', valor: totais ? number(totais.estourandoHoras) : null, destaque: 'text-warning', nota: 'consumo acima do orçado' },
    { rotulo: 'Margem média', valor: totais ? percent(totais.margemMedia) : null, destaque: totais && totais.margemMedia < 0.2 ? 'text-warning' : 'text-good', nota: totais ? `${number(totais.horasMes)}h apontadas no mês` : undefined },
  ]

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        titulo="Projetos"
        descricao="Carteira com o que importa lado a lado: horas consumidas e escopo entregue."
        acoes={
          <>
            <BotaoExportar
              nomeArquivo="projetos"
              titulo="Carteira de projetos"
              orientacao="paisagem"
              colunas={[
                { chave: 'codigo', cabecalho: 'Código', peso: 1, valor: (p: Projeto) => p.codigo },
                { chave: 'nome', cabecalho: 'Projeto', peso: 2, valor: (p: Projeto) => p.nome },
                { chave: 'cliente', cabecalho: 'Cliente', peso: 2, valor: (p: Projeto) => p.cliente },
                { chave: 'consumo', cabecalho: 'Horas', peso: 1, alinhamento: 'direita', valor: (p: Projeto) => percent(consumoHoras(p)), valorCsv: (p: Projeto) => Number((consumoHoras(p) * 100).toFixed(1)) },
                { chave: 'avanco', cabecalho: 'Entregue', peso: 1, alinhamento: 'direita', valor: (p: Projeto) => percent(avancoFisico(p.id)), valorCsv: (p: Projeto) => Number((avancoFisico(p.id) * 100).toFixed(1)) },
                { chave: 'prazo', cabecalho: 'Prazo', peso: 1.1, alinhamento: 'direita', valor: (p: Projeto) => date(p.prazo), valorCsv: (p: Projeto) => p.prazo.slice(0, 10) },
                { chave: 'margem', cabecalho: 'Margem', peso: 1, alinhamento: 'direita', valor: (p: Projeto) => percent(margemProjeto(p)), valorCsv: (p: Projeto) => Number((margemProjeto(p) * 100).toFixed(1)) },
              ]}
              buscarLinhas={async () => (await listarProjetos({ ...filtro, page: 1, perPage: 10_000 })).data}
            />
            <Button onClick={() => setCriando(true)}><span aria-hidden>＋</span> Novo projeto</Button>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cartoes.map((c) => (
          <div key={c.rotulo} className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <p className="text-[13px] font-medium text-text-muted">{c.rotulo}</p>
            {c.valor === null ? <Skeleton className="mt-2 h-7 w-20" /> : (
              <p className={cn('mt-1 text-xl font-semibold tabular-nums lg:text-2xl', c.destaque ?? 'text-text')}>{c.valor}</p>
            )}
            {c.nota && <p className="mt-1 text-[12px] text-text-muted">{c.nota}</p>}
          </div>
        ))}
      </section>

      <Card>
        <CardHeader
          titulo="Consumo de horas não é avanço"
          descricao="Gastar 80% das horas com 40% do escopo entregue é um projeto em apuros que parece saudável em qualquer painel que mostre só uma das duas barras."
          acoes={<Button size="sm" variant="secondary" onClick={() => tabela.setFilter('situacao', 'derrapando')}>Ver quem está derrapando</Button>}
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
        onLinhaClick={(p) => navigate(`/projetos/${p.id}`)}
        vazio={{ titulo: 'Nenhum projeto com esses filtros', descricao: 'Ajuste a situação ou o responsável.' }}
        toolbar={
          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
            <label className="relative min-w-0 flex-1 sm:max-w-xs">
              <span className="sr-only">Buscar projeto</span>
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-text-muted">🔍</span>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome, código ou cliente…"
                className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
            </label>

            <Select aria-label="Situação" value={tabela.filters?.situacao ?? ''} onChange={(e) => tabela.setFilter('situacao', e.target.value || undefined)} className="w-full sm:w-52">
              <option value="">Todas as situações</option>
              <option value="em_andamento">Em andamento</option>
              <option value="em_risco">Em risco</option>
              <option value="atrasado">Atrasado (derivado)</option>
              <option value="derrapando">Derrapando (derivado)</option>
              <option value="planejado">Planejado</option>
              <option value="pausado">Pausado</option>
              <option value="concluido">Concluído</option>
            </Select>

            <Select aria-label="Responsável" value={tabela.filters?.responsavel ?? ''} onChange={(e) => tabela.setFilter('responsavel', e.target.value || undefined)} className="w-full sm:w-44">
              <option value="">Todos os responsáveis</option>
              {responsaveisProjeto.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>

            {tabela.temFiltro && <Button variant="ghost" size="sm" onClick={() => { setBusca(''); tabela.limparFiltros() }}>Limpar</Button>}
          </div>
        }
      />

      <NovoProjetoModal
        aberto={criando}
        onFechar={() => setCriando(false)}
        onCriado={(id) => { setCriando(false); navigate(`/projetos/${id}?aba=estrutura`) }}
      />
    </div>
  )
}
