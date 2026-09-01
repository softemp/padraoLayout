import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  custoAnual, desviosDePreco, diasParaVencer, fornecedoresContrato, listarContratosFornecedor,
  naJanelaDeAviso, reajusteDevido, renovouSemDecisao, temCertidaoVencida, totaisContratosFornecedor,
} from '@/shared/api/contratos-fornecedores'
import type { ContratoFornecedor, SituacaoContratoFornecedor } from '@/shared/api/types'
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
import { date, money, number } from '@/shared/lib/format'

const situacaoInfo: Record<SituacaoContratoFornecedor, { tom: 'good' | 'info' | 'warning' | 'neutro' | 'critical'; rotulo: string }> = {
  em_negociacao: { tom: 'neutro', rotulo: 'Em negociação' },
  vigente: { tom: 'good', rotulo: 'Vigente' },
  em_aviso: { tom: 'warning', rotulo: 'Não renovar' },
  encerrado: { tom: 'neutro', rotulo: 'Encerrado' },
  rescindido: { tom: 'critical', rotulo: 'Rescindido' },
}

export function ContratosFornecedorPage() {
  const navigate = useNavigate()
  const tabela = useTableState({ sortBy: 'fim', sortDir: 'asc', filtros: ['situacao', 'tipo', 'fornecedor'] })
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
    queryKey: ['contratos-fornecedor', filtro],
    queryFn: () => listarContratosFornecedor(filtro),
    placeholderData: keepPreviousData,
  })
  const { data: totais } = useQuery({ queryKey: ['contratos-fornecedor-totais'], queryFn: totaisContratosFornecedor })

  const colunas = useMemo<ColumnDef<ContratoFornecedor, unknown>[]>(
    () => [
      {
        id: 'fornecedor',
        header: 'Contrato',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-text">{row.original.fornecedor}</p>
            <p className="truncate text-[12px] text-text-muted">{row.original.numero} · {row.original.objeto}</p>
          </div>
        ),
      },
      { id: 'tipo', header: 'Tipo', cell: ({ row }) => <span className="text-text-secondary">{row.original.tipo}</span> },
      {
        id: 'custoMensal',
        header: 'Custo',
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => {
          const c = row.original
          if (c.custoMensal === 0) return <span className="text-[13px] text-text-muted">por demanda</span>
          return (
            <div className="text-right">
              <p className="font-medium tabular-nums text-text">{money(c.custoMensal)}/mês</p>
              <p className="text-[11px] tabular-nums text-text-muted">{money(custoAnual(c))}/ano</p>
            </div>
          )
        },
      },
      {
        id: 'fim',
        header: 'Vigência até',
        meta: { alinhamento: 'direita' },
        cell: ({ row }) => {
          const c = row.original
          const dias = diasParaVencer(c)
          return (
            <div className="text-right">
              <p className={cn('tabular-nums', naJanelaDeAviso(c) ? 'font-semibold text-warning' : 'text-text-secondary')}>{date(c.fim)}</p>
              {c.situacao === 'vigente' && (
                <p className="text-[11px] text-text-muted">
                  {dias >= 0 ? `em ${number(dias)}d` : `venceu há ${number(Math.abs(dias))}d`}
                  {c.renovacaoAutomatica && ' · renova sozinho'}
                </p>
              )}
            </div>
          )
        },
      },
      {
        id: 'riscos',
        header: 'Riscos',
        enableSorting: false,
        cell: ({ row }) => {
          const c = row.original
          const desvios = desviosDePreco(c.id)
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tom={situacaoInfo[c.situacao].tom}>{situacaoInfo[c.situacao].rotulo}</Badge>
              {renovouSemDecisao(c) && <Badge tom="critical">Renovou sem decisão</Badge>}
              {naJanelaDeAviso(c) && !renovouSemDecisao(c) && <Badge tom="warning">Decidir agora</Badge>}
              {temCertidaoVencida(c) && <Badge tom="critical">Certidão vencida</Badge>}
              {desvios.length > 0 && <Badge tom="warning">{desvios.length} desvio(s) de preço</Badge>}
              {reajusteDevido(c) && <Badge tom="info">Reajuste devido</Badge>}
            </div>
          )
        },
      },
      { id: 'gestor', header: 'Gestor', cell: ({ row }) => <span className="text-text-secondary">{row.original.gestor}</span> },
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
            onClick={(e) => { e.stopPropagation(); navigate(`/contratos-fornecedores/${row.original.id}`) }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text"
          >
            <span aria-hidden>📄</span>
          </button>
        ),
      },
    ],
    [navigate],
  )

  const cartoes = [
    { rotulo: 'Contratos vigentes', valor: totais ? number(totais.vigentes) : null, nota: totais ? `${money(totais.custoMensal)}/mês` : undefined },
    { rotulo: 'Renovam sozinhos', valor: totais ? number(totais.renovamSozinhos) : null, destaque: 'text-warning', nota: totais ? `${money(totais.custoRenovacaoAutomatica)}/ano` : undefined },
    { rotulo: 'Com desvio de preço', valor: totais ? number(totais.comDesvioDePreco) : null, destaque: 'text-warning', nota: 'nota acima do contratado' },
    { rotulo: 'Certidão vencida', valor: totais ? number(totais.certidaoVencida) : null, destaque: 'text-critical', nota: 'risco ao pagar' },
  ]

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        titulo="Contratos de fornecedores"
        descricao="Mesma forma do contrato de cliente — o que muda é o risco: aqui o dinheiro sai."
        acoes={
          <>
            <BotaoExportar
              nomeArquivo="contratos-fornecedores"
              titulo="Contratos de fornecedores"
              orientacao="paisagem"
              colunas={[
                { chave: 'numero', cabecalho: 'Contrato', peso: 1.2, valor: (c: ContratoFornecedor) => c.numero },
                { chave: 'fornecedor', cabecalho: 'Fornecedor', peso: 2, valor: (c: ContratoFornecedor) => c.fornecedor },
                { chave: 'objeto', cabecalho: 'Objeto', peso: 2, valor: (c: ContratoFornecedor) => c.objeto },
                { chave: 'custo', cabecalho: 'Custo mensal', peso: 1.2, alinhamento: 'direita', valor: (c: ContratoFornecedor) => (c.custoMensal ? money(c.custoMensal) : 'por demanda'), valorCsv: (c: ContratoFornecedor) => c.custoMensal },
                { chave: 'fim', cabecalho: 'Vigência até', peso: 1.1, alinhamento: 'direita', valor: (c: ContratoFornecedor) => date(c.fim), valorCsv: (c: ContratoFornecedor) => c.fim.slice(0, 10) },
                { chave: 'renovacao', cabecalho: 'Renovação', peso: 1.1, valor: (c: ContratoFornecedor) => (c.renovacaoAutomatica ? `automática · aviso ${c.avisoPrevioDias}d` : 'manual') },
              ]}
              buscarLinhas={async () => (await listarContratosFornecedor({ ...filtro, page: 1, perPage: 10_000 })).data}
            />
            <Button><span aria-hidden>＋</span> Novo contrato</Button>
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

      <Card className="border-warning/40">
        <CardHeader
          titulo="Onde o dinheiro vaza em silêncio"
          descricao="Renovação automática de contrato que ninguém usa mais · nota cobrada acima do preço acordado · pagamento a fornecedor com certidão vencida. Nenhum dos três dá erro — todos aparecem no extrato."
          acoes={
            <Button size="sm" variant="secondary" onClick={() => tabela.setFilter('situacao', 'renova_sozinho')}>
              Ver os que renovam sozinhos
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
        onLinhaClick={(c) => navigate(`/contratos-fornecedores/${c.id}`)}
        vazio={{ titulo: 'Nenhum contrato com esses filtros', descricao: 'Ajuste a situação, o tipo ou o fornecedor.' }}
        toolbar={
          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
            <label className="relative min-w-0 flex-1 sm:max-w-xs">
              <span className="sr-only">Buscar contrato</span>
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-text-muted">🔍</span>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Fornecedor, número ou objeto…"
                className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
            </label>

            <Select aria-label="Situação" value={tabela.filters?.situacao ?? ''} onChange={(e) => tabela.setFilter('situacao', e.target.value || undefined)} className="w-full sm:w-52">
              <option value="">Todas as situações</option>
              <option value="renova_sozinho">Renovam sozinhos</option>
              <option value="aviso">Na janela de aviso (derivado)</option>
              <option value="certidao">Certidão vencida (derivado)</option>
              <option value="reajuste">Reajuste devido (derivado)</option>
              <option value="vigente">Vigente</option>
              <option value="em_aviso">Marcado para não renovar</option>
              <option value="encerrado">Encerrado</option>
            </Select>

            <Select aria-label="Tipo" value={tabela.filters?.tipo ?? ''} onChange={(e) => tabela.setFilter('tipo', e.target.value || undefined)} className="w-full sm:w-40">
              <option value="">Todos os tipos</option>
              <option value="assinatura">Assinatura</option>
              <option value="fornecimento">Fornecimento</option>
              <option value="servico">Serviço</option>
              <option value="locacao">Locação</option>
              <option value="manutencao">Manutenção</option>
            </Select>

            <Select aria-label="Fornecedor" value={tabela.filters?.fornecedor ?? ''} onChange={(e) => tabela.setFilter('fornecedor', e.target.value || undefined)} className="w-full sm:w-48">
              <option value="">Todos os fornecedores</option>
              {fornecedoresContrato.map((f) => <option key={f} value={f}>{f}</option>)}
            </Select>

            {tabela.temFiltro && <Button variant="ghost" size="sm" onClick={() => { setBusca(''); tabela.limparFiltros() }}>Limpar</Button>}
          </div>
        }
      />
    </div>
  )
}
