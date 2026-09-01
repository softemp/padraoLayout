import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  alternarAcessoRemuneracao, departamentos, diasEmAberto, diasParaDobra, emDobra,
  feriasVencendo, getPodeVerRemuneracao, JANELA_AVISO_FERIAS, listarColaboradores,
  painelFerias, totaisRh,
} from '@/shared/api/rh'
import type { Colaborador, SituacaoColaborador } from '@/shared/api/types'
import { useTableState } from '@/shared/hooks/useTableState'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardHeader } from '@/shared/ui/Card'
import { DataTable } from '@/shared/ui/DataTable'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Select } from '@/shared/ui/Field'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { date, money, number } from '@/shared/lib/format'

const situacaoInfo: Record<SituacaoColaborador, { tom: 'good' | 'info' | 'warning' | 'neutro' | 'critical'; rotulo: string }> = {
  ativo: { tom: 'good', rotulo: 'Ativo' },
  ferias: { tom: 'info', rotulo: 'Em férias' },
  afastado: { tom: 'warning', rotulo: 'Afastado' },
  aviso_previo: { tom: 'warning', rotulo: 'Aviso prévio' },
  desligado: { tom: 'neutro', rotulo: 'Desligado' },
}

const tempoDeCasa = (admissao: string) => {
  const meses = Math.floor((Date.now() - +new Date(admissao)) / (30 * 86400000))
  const anos = Math.floor(meses / 12)
  return anos > 0 ? `${anos} ano${anos > 1 ? 's' : ''}` : `${meses} meses`
}

export function RhPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const aba = (params.get('aba') ?? 'pessoas') as 'pessoas' | 'ferias'

  const tabela = useTableState({ sortBy: 'nome', sortDir: 'asc', filtros: ['situacao', 'departamento', 'contrato'] })
  const [busca, setBusca] = useState(tabela.search ?? '')
  const buscaDebounced = useDebouncedValue(busca, 450)
  const [verSalario, setVerSalario] = useState(getPodeVerRemuneracao())

  useEffect(() => {
    if (buscaDebounced !== (tabela.search ?? '')) tabela.setSearch(buscaDebounced)
  }, [buscaDebounced]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtro = {
    page: tabela.page, perPage: tabela.perPage, sortBy: tabela.sortBy, sortDir: tabela.sortDir,
    search: tabela.search, filters: tabela.filters,
  }

  const { data, isFetching, error } = useQuery({
    queryKey: ['rh', filtro, verSalario],
    queryFn: () => listarColaboradores(filtro),
    placeholderData: keepPreviousData,
    enabled: aba === 'pessoas',
  })
  const { data: totais } = useQuery({ queryKey: ['rh-totais', verSalario], queryFn: totaisRh })
  const { data: ferias } = useQuery({ queryKey: ['rh-ferias'], queryFn: painelFerias, enabled: aba === 'ferias' })

  const alternarAcesso = useMutation({
    mutationFn: (valor: boolean) => alternarAcessoRemuneracao(valor),
    onSuccess: (_, valor) => {
      setVerSalario(valor)
      void qc.invalidateQueries({ queryKey: ['rh'] })
      void qc.invalidateQueries({ queryKey: ['rh-totais'] })
    },
  })

  const colunas = useMemo<ColumnDef<Colaborador, unknown>[]>(
    () => [
      {
        id: 'nome',
        header: 'Pessoa',
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar nome={row.original.nome} />
            <div className="min-w-0">
              <p className="truncate font-medium text-text">{row.original.nome}</p>
              <p className="truncate text-[12px] text-text-muted">{row.original.cargo} · {row.original.departamento}</p>
            </div>
          </div>
        ),
      },
      { id: 'contrato', header: 'Contrato', cell: ({ row }) => <span className="text-text-secondary">{row.original.contrato}</span> },
      { id: 'gestor', header: 'Gestor', cell: ({ row }) => <span className="truncate text-text-secondary">{row.original.gestor}</span> },
      {
        id: 'admissao',
        header: 'Admissão',
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => (
          <div className="text-right">
            <p className="tabular-nums text-text-secondary">{date(row.original.admissao)}</p>
            <p className="text-[11px] text-text-muted">{tempoDeCasa(row.original.admissao)} de casa</p>
          </div>
        ),
      },
      {
        id: 'salario',
        header: 'Remuneração',
        enableSorting: false,
        meta: { alinhamento: 'direita' },
        cell: ({ row }) =>
          // O valor nem chega ao cliente sem permissão: aqui não há o que
          // mascarar, há o que NÃO foi enviado.
          row.original.salario === null ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-text-muted">
              <span aria-hidden>🔒</span> restrito
            </span>
          ) : (
            <span className="font-medium tabular-nums text-text">{money(row.original.salario)}</span>
          ),
      },
      {
        id: 'situacao',
        header: 'Situação',
        cell: ({ row }) => <Badge tom={situacaoInfo[row.original.situacao].tom}>{situacaoInfo[row.original.situacao].rotulo}</Badge>,
      },
      {
        id: 'acoes',
        header: 'Ações',
        enableSorting: false,
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => (
          <button
            type="button"
            title={`Abrir ficha de ${row.original.nome}`}
            aria-label={`Abrir ficha de ${row.original.nome}`}
            onClick={(e) => { e.stopPropagation(); navigate(`/rh/${row.original.id}`) }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text"
          >
            <span aria-hidden>👤</span>
          </button>
        ),
      },
    ],
    [navigate],
  )

  const cartoes = [
    { rotulo: 'Pessoas ativas', valor: totais ? number(totais.ativos) : null, nota: totais ? `${totais.emFerias} em férias` : undefined },
    { rotulo: `Férias vencendo (${JANELA_AVISO_FERIAS}d)`, valor: totais ? number(totais.feriasVencendo) : null, destaque: 'text-warning', nota: 'ainda dá para programar' },
    { rotulo: 'Férias em dobra', valor: totais ? number(totais.feriasEmDobra) : null, destaque: 'text-critical', nota: 'já custa o dobro' },
    {
      rotulo: 'Custo da folha',
      valor: totais ? (totais.custoFolha === null ? '🔒 restrito' : money(totais.custoFolha)) : null,
      nota: totais?.custoFolha === null ? 'exige permissão de remuneração' : 'mensal, sem encargos',
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        titulo="Pessoas"
        descricao="Quadro, férias e desligamento — com o dado sensível fora do alcance de quem não precisa dele."
        acoes={
          <>
            {/* Demonstração do controle: o botão simula ter (ou não) a
                permissão de remuneração. No projeto real é o RBAC. */}
            <Button
              variant={verSalario ? 'secondary' : 'ghost'}
              loading={alternarAcesso.isPending}
              onClick={() => alternarAcesso.mutate(!verSalario)}
            >
              <span aria-hidden>{verSalario ? '🔓' : '🔒'}</span>
              {verSalario ? 'Com permissão de remuneração' : 'Sem permissão de remuneração'}
            </Button>
            <Button><span aria-hidden>＋</span> Admitir pessoa</Button>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cartoes.map((c) => (
          <div key={c.rotulo} className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <p className="text-[13px] font-medium text-text-muted">{c.rotulo}</p>
            {c.valor === null ? <Skeleton className="mt-2 h-7 w-24" /> : (
              <p className={cn('mt-1 text-xl font-semibold tabular-nums lg:text-2xl', c.destaque ?? 'text-text')}>{c.valor}</p>
            )}
            {c.nota && <p className="mt-1 text-[12px] text-text-muted">{c.nota}</p>}
          </div>
        ))}
      </section>

      {(totais?.feriasEmDobra ?? 0) > 0 && (
        <Card className="border-critical/40">
          <CardHeader
            titulo={`${number(totais!.feriasEmDobra)} períodos de férias já em dobra`}
            descricao="Passou o período concessivo com dias em aberto: a partir daí a empresa paga em dobro, e o valor só cresce."
            acoes={<Button size="sm" variant="secondary" onClick={() => setParams({ aba: 'ferias' }, { replace: true })}>Ver painel de férias</Button>}
          />
        </Card>
      )}

      <div role="tablist" aria-label="Seções de RH" className="flex flex-wrap items-center gap-1 border-b border-border">
        {([
          { id: 'pessoas', rotulo: 'Pessoas', icone: '👥' },
          { id: 'ferias', rotulo: 'Férias', icone: '🏖️' },
        ] as const).map((item) => {
          const ativa = aba === item.id
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={ativa}
              onClick={() => setParams({ aba: item.id }, { replace: true })}
              className={cn(
                '-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors',
                ativa ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:border-border-strong hover:text-text',
              )}
            >
              <span aria-hidden>{item.icone}</span>{item.rotulo}
            </button>
          )
        })}
      </div>

      {aba === 'pessoas' ? (
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
          onLinhaClick={(c) => navigate(`/rh/${c.id}`)}
          vazio={{ titulo: 'Ninguém com esses filtros', descricao: 'Ajuste a situação, o departamento ou o contrato.' }}
          toolbar={
            <div className="flex flex-wrap items-end gap-2 sm:gap-3">
              <label className="relative min-w-0 flex-1 sm:max-w-xs">
                <span className="sr-only">Buscar pessoa</span>
                <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-text-muted">🔍</span>
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome, cargo ou e-mail…"
                  className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                />
              </label>

              <Select aria-label="Situação" value={tabela.filters?.situacao ?? ''} onChange={(e) => tabela.setFilter('situacao', e.target.value || undefined)} className="w-full sm:w-40">
                <option value="">Todas as situações</option>
                <option value="ativo">Ativo</option>
                <option value="ferias">Em férias</option>
                <option value="afastado">Afastado</option>
                <option value="aviso_previo">Aviso prévio</option>
                <option value="desligado">Desligado</option>
              </Select>

              <Select aria-label="Departamento" value={tabela.filters?.departamento ?? ''} onChange={(e) => tabela.setFilter('departamento', e.target.value || undefined)} className="w-full sm:w-44">
                <option value="">Todos os departamentos</option>
                {departamentos.map((d) => <option key={d} value={d}>{d}</option>)}
              </Select>

              <Select aria-label="Contrato" value={tabela.filters?.contrato ?? ''} onChange={(e) => tabela.setFilter('contrato', e.target.value || undefined)} className="w-full sm:w-36">
                <option value="">Todo contrato</option>
                <option value="CLT">CLT</option>
                <option value="PJ">PJ</option>
                <option value="Estágio">Estágio</option>
                <option value="Aprendiz">Aprendiz</option>
              </Select>

              {tabela.temFiltro && <Button variant="ghost" size="sm" onClick={() => { setBusca(''); tabela.limparFiltros() }}>Limpar</Button>}
            </div>
          }
        />
      ) : (
        <Card>
          <CardHeader
            titulo="Painel de férias"
            descricao="Do mais urgente ao menos: quem está em dobra, quem está na janela de programação"
          />
          {ferias?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-text-muted">
                    <th className="px-4 py-2.5 text-left font-semibold">Pessoa</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Período aquisitivo</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Dias em aberto</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Limite (dobra)</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {ferias.map(({ colaborador, periodo }) => {
                    const dias = diasParaDobra(periodo)
                    return (
                      <tr key={periodo.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2">
                        <td className="px-4 py-2.5">
                          <button type="button" onClick={() => navigate(`/rh/${colaborador.id}?aba=ferias`)} className="text-left">
                            <p className="text-[13px] font-medium text-text hover:underline">{colaborador.nome}</p>
                            <p className="text-[11px] text-text-muted">{colaborador.departamento}</p>
                          </button>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-text-secondary">
                          {date(periodo.aquisitivoInicio)} → {date(periodo.aquisitivoFim)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text">{number(diasEmAberto(periodo))}</td>
                        <td className={cn('px-3 py-2.5 text-right tabular-nums', emDobra(periodo) ? 'font-semibold text-critical' : 'text-text-secondary')}>
                          {date(periodo.concessivoFim)}
                          <span className="ml-1.5 text-[11px] text-text-muted">
                            {dias >= 0 ? `em ${number(dias)}d` : `há ${number(Math.abs(dias))}d`}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {emDobra(periodo) ? <Badge tom="critical">Em dobra</Badge>
                            : feriasVencendo(periodo) ? <Badge tom="warning">Programar já</Badge>
                            : <Badge tom="good">No prazo</Badge>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icone="🏖️" titulo="Ninguém com dias em aberto" />
          )}
          <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted">
            A janela de aviso é de <strong className="text-text-secondary">{JANELA_AVISO_FERIAS} dias</strong>, não do
            mês do vencimento: férias precisam ser programadas, comunicadas com 30 dias e caber na escala do time.
            Avisar no mês da dobra é avisar quando já não dá para conceder.
          </p>
        </Card>
      )}
    </div>
  )
}
