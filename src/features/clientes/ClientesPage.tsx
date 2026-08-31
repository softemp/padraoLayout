import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  contarLixeira, excluirDefinitivo, listarClientes, moverParaLixeira, restaurarCliente, salvarCliente,
} from '@/shared/api/api'
import type { Cliente, EscopoRegistro } from '@/shared/api/types'
import { useTableState } from '@/shared/hooks/useTableState'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { DataTable } from '@/shared/ui/DataTable'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { BotaoExportar } from '@/shared/ui/BotaoExportar'
import { ConfirmarAcao } from '@/shared/ui/ConfirmarAcao'
import { Select } from '@/shared/ui/Field'
import { cn } from '@/shared/lib/cn'
import { colunasClientes } from './colunas'
import { ClienteFormModal, type ClienteFormulario } from './ClienteFormModal'
import { exportacaoClientes } from './exportacao'

type Confirmacao = { tipo: 'lixeira' | 'excluir'; cliente: Cliente } | null

export function ClientesPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const tabela = useTableState({ sortBy: 'nome', sortDir: 'asc' })
  const [busca, setBusca] = useState(tabela.search ?? '')
  const buscaDebounced = useDebouncedValue(busca, 450)

  const [editando, setEditando] = useState<Cliente | null>(null)
  const [confirmacao, setConfirmacao] = useState<Confirmacao>(null)

  // Digitou → espera parar → busca no servidor e volta para a página 1.
  useEffect(() => {
    if (buscaDebounced !== (tabela.search ?? '')) tabela.setSearch(buscaDebounced)
  }, [buscaDebounced]) // eslint-disable-line react-hooks/exhaustive-deps

  const paramsAtuais = {
    page: tabela.page,
    perPage: tabela.perPage,
    sortBy: tabela.sortBy,
    sortDir: tabela.sortDir,
    search: tabela.search,
    filters: tabela.filters,
    escopo: tabela.escopo,
  }

  const { data, isFetching, error } = useQuery({
    queryKey: ['clientes', paramsAtuais],
    queryFn: () => listarClientes(paramsAtuais),
    // Mantém a página anterior visível enquanto a nova chega: a tabela não
    // pisca em branco a cada clique de paginação.
    placeholderData: keepPreviousData,
  })

  const { data: naLixeira = 0 } = useQuery({ queryKey: ['clientes-lixeira-total'], queryFn: contarLixeira })

  // Toda mutação invalida a listagem E a contagem da aba: o badge não pode
  // discordar da tabela que está ao lado dele.
  const aoConcluir = () => {
    void qc.invalidateQueries({ queryKey: ['clientes'] })
    void qc.invalidateQueries({ queryKey: ['clientes-lixeira-total'] })
    setConfirmacao(null)
  }

  const mover = useMutation({ mutationFn: moverParaLixeira, onSuccess: aoConcluir })
  const restaurar = useMutation({ mutationFn: restaurarCliente, onSuccess: aoConcluir })
  const excluir = useMutation({ mutationFn: excluirDefinitivo, onSuccess: aoConcluir })
  const salvar = useMutation({
    mutationFn: ({ id, dados }: { id: number; dados: ClienteFormulario }) => salvarCliente(id, dados),
    onSuccess: () => { aoConcluir(); setEditando(null) },
  })

  const ocupadoId =
    (mover.isPending && mover.variables) || (restaurar.isPending && restaurar.variables) ||
    (excluir.isPending && excluir.variables) || null

  const colunas = useMemo(
    () =>
      colunasClientes(tabela.escopo ?? 'ativos', {
        onGerenciar: (cliente) => navigate(`/clientes/${cliente.id}`),
        onEditar: setEditando,
        onLixeira: (cliente) => setConfirmacao({ tipo: 'lixeira', cliente }),
        onRestaurar: (cliente) => restaurar.mutate(cliente.id),
        onExcluir: (cliente) => setConfirmacao({ tipo: 'excluir', cliente }),
        ocupadoId: typeof ocupadoId === 'number' ? ocupadoId : null,
      }),
    [tabela.escopo, ocupadoId], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const abas: { id: EscopoRegistro; rotulo: string; icone: string; contagem?: number }[] = [
    { id: 'ativos', rotulo: 'Clientes', icone: '📇' },
    { id: 'lixeira', rotulo: 'Lixeira', icone: '🗑️', contagem: naLixeira },
  ]
  const naAbaLixeira = tabela.escopo === 'lixeira'

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        titulo="Clientes"
        descricao="Paginação, ordenação e busca acontecem no servidor — a tela abre igual com 200 ou 200 mil linhas."
        acoes={
          <>
            <BotaoExportar {...exportacaoClientes(paramsAtuais)} />
            {!naAbaLixeira && (
              <Button>
                <span aria-hidden>＋</span> Novo cliente
              </Button>
            )}
          </>
        }
      />

      {/* Abas de escopo: a lixeira é a MESMA listagem com outro recorte —
          mesmas colunas, mesma busca, mesma paginação. */}
      <div role="tablist" aria-label="Escopo da listagem" className="flex items-center gap-1 border-b border-border">
        {abas.map((aba) => {
          const ativa = (tabela.escopo ?? 'ativos') === aba.id
          return (
            <button
              key={aba.id}
              role="tab"
              aria-selected={ativa}
              onClick={() => tabela.setEscopo(aba.id)}
              className={cn(
                'relative -mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors',
                ativa
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:border-border-strong hover:text-text',
              )}
            >
              <span aria-hidden>{aba.icone}</span>
              {aba.rotulo}
              {aba.contagem !== undefined && aba.contagem > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                    ativa ? 'bg-primary/12 text-primary' : 'bg-surface-3 text-text-muted',
                  )}
                >
                  {aba.contagem}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {naAbaLixeira && (
        <p className="flex items-start gap-2 rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-[13px] text-text-secondary">
          <span aria-hidden>ℹ️</span>
          Registros na lixeira não aparecem na operação e podem ser restaurados a qualquer momento.
          A exclusão em definitivo apaga o cadastro e não tem volta.
        </p>
      )}

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
        // A linha inteira leva à conta: o botão ⚙️ é o atalho explícito.
        onLinhaClick={naAbaLixeira ? undefined : (cliente) => navigate(`/clientes/${cliente.id}`)}
        vazio={
          naAbaLixeira
            ? { titulo: 'A lixeira está vazia', descricao: 'Nada foi descartado por aqui — ou tudo já foi restaurado.' }
            : {
                titulo: 'Nenhum cliente com esses filtros',
                descricao: 'Ajuste a busca ou limpe os filtros para ver a lista completa.',
                acao: (
                  <Button variant="secondary" size="sm" onClick={() => { setBusca(''); tabela.limparFiltros() }}>
                    Limpar filtros
                  </Button>
                ),
              }
        }
        toolbar={
          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
            <label className="relative min-w-0 flex-1 sm:max-w-xs">
              <span className="sr-only">Buscar cliente</span>
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-text-muted">🔍</span>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome, e-mail ou documento…"
                className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-muted hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
            </label>

            <Select
              aria-label="Filtrar por status"
              value={tabela.filters?.status ?? ''}
              onChange={(e) => tabela.setFilter('status', e.target.value || undefined)}
              className="w-full sm:w-44"
            >
              <option value="">Todos os status</option>
              <option value="ativo">Ativo</option>
              <option value="pendente">Pendente</option>
              <option value="inadimplente">Inadimplente</option>
              <option value="inativo">Inativo</option>
            </Select>

            <Select
              aria-label="Filtrar por plano"
              value={tabela.filters?.plano ?? ''}
              onChange={(e) => tabela.setFilter('plano', e.target.value || undefined)}
              className="w-full sm:w-40"
            >
              <option value="">Todos os planos</option>
              <option value="Starter">Starter</option>
              <option value="Pro">Pro</option>
              <option value="Enterprise">Enterprise</option>
            </Select>

            {tabela.temFiltro && (
              <Button variant="ghost" size="sm" onClick={() => { setBusca(''); tabela.limparFiltros() }}>
                Limpar
              </Button>
            )}

            {isFetching && (
              <span className="ml-auto hidden items-center gap-2 text-[12px] text-text-muted sm:flex">
                <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
                atualizando…
              </span>
            )}
          </div>
        }
      />

      <ClienteFormModal
        cliente={editando}
        salvando={salvar.isPending}
        onFechar={() => setEditando(null)}
        onSalvar={(dados) => editando && salvar.mutate({ id: editando.id, dados })}
      />

      {/* Mover para a lixeira é reversível, mas ainda assim confirma: some da
          operação. Excluir em definitivo tem confirmação com outro peso. */}
      <ConfirmarAcao
        aberto={confirmacao?.tipo === 'lixeira'}
        titulo="Mover para a lixeira"
        rotuloConfirmar="Mover para a lixeira"
        tom="primary"
        carregando={mover.isPending}
        onCancelar={() => setConfirmacao(null)}
        onConfirmar={() => confirmacao && mover.mutate(confirmacao.cliente.id)}
        mensagem={
          <>
            <strong className="font-semibold text-text">{confirmacao?.cliente.nome}</strong> sai da listagem
            e deixa de aparecer na operação. Você pode restaurá-lo pela aba <strong className="font-semibold text-text">Lixeira</strong> quando quiser.
          </>
        }
      />

      <ConfirmarAcao
        aberto={confirmacao?.tipo === 'excluir'}
        titulo="Excluir em definitivo"
        rotuloConfirmar="Excluir em definitivo"
        carregando={excluir.isPending}
        onCancelar={() => setConfirmacao(null)}
        onConfirmar={() => confirmacao && excluir.mutate(confirmacao.cliente.id)}
        mensagem={
          <>
            O cadastro de <strong className="font-semibold text-text">{confirmacao?.cliente.nome}</strong> será
            apagado, junto com o histórico ligado a ele. <strong className="font-semibold text-critical">Esta ação não tem volta.</strong>
          </>
        }
      />
    </div>
  )
}
