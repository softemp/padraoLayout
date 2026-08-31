import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  lancarAjuste, obterAssinatura, obterAuditoria, obterCliente, obterExtrato, obterUsuariosDaConta,
  salvarCliente,
} from '@/shared/api/api'
import type { AjusteConta, MovimentoConta } from '@/shared/api/types'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Meter } from '@/shared/ui/Meter'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { date, datetime, money, timeAgo } from '@/shared/lib/format'
import { AjusteContaModal } from './AjusteContaModal'
import { ClienteFormModal, type ClienteFormulario } from './ClienteFormModal'
import { mascaraCpf } from './colunas'

const ABAS = [
  { id: 'visao', rotulo: 'Visão geral', icone: '📋' },
  { id: 'financeiro', rotulo: 'Financeiro', icone: '💰' },
  { id: 'assinatura', rotulo: 'Assinatura', icone: '🔁' },
  { id: 'usuarios', rotulo: 'Usuários', icone: '👥' },
  { id: 'historico', rotulo: 'Histórico', icone: '🕘' },
] as const
type AbaId = (typeof ABAS)[number]['id']

const tomStatus = { ativo: 'good', pendente: 'warning', inadimplente: 'critical', inativo: 'neutro' } as const
const rotuloStatus = { ativo: 'Ativo', pendente: 'Pendente', inadimplente: 'Inadimplente', inativo: 'Inativo' } as const

const tomMovimento: Record<MovimentoConta['tipo'], { rotulo: string; classe: string }> = {
  credito: { rotulo: 'Crédito', classe: 'text-good' },
  estorno: { rotulo: 'Estorno', classe: 'text-good' },
  debito: { rotulo: 'Débito', classe: 'text-critical' },
  cobranca: { rotulo: 'Cobrança', classe: 'text-critical' },
}

export function ContaClientePage() {
  const { id } = useParams()
  const clienteId = Number(id)
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const aba = (params.get('aba') ?? 'visao') as AbaId

  const [editando, setEditando] = useState(false)
  const [ajuste, setAjuste] = useState<'credito' | 'debito' | null>(null)

  const cliente = useQuery({ queryKey: ['cliente', clienteId], queryFn: () => obterCliente(clienteId) })
  const extrato = useQuery({ queryKey: ['cliente-extrato', clienteId], queryFn: () => obterExtrato(clienteId) })
  const assinatura = useQuery({ queryKey: ['cliente-assinatura', clienteId], queryFn: () => obterAssinatura(clienteId) })
  const usuarios = useQuery({ queryKey: ['cliente-usuarios', clienteId], queryFn: () => obterUsuariosDaConta(clienteId) })
  const auditoria = useQuery({ queryKey: ['cliente-auditoria', clienteId], queryFn: () => obterAuditoria(clienteId) })

  const aplicarAjuste = useMutation({
    mutationFn: (dados: AjusteConta) => lancarAjuste(clienteId, dados),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cliente-extrato', clienteId] })
      setAjuste(null)
    },
  })

  const salvar = useMutation({
    mutationFn: (dados: ClienteFormulario) => salvarCliente(clienteId, dados),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cliente', clienteId] })
      void qc.invalidateQueries({ queryKey: ['clientes'] })
      setEditando(false)
    },
  })

  if (cliente.isError) {
    return (
      <Card>
        <EmptyState
          icone="🔍"
          titulo="Cliente não encontrado"
          descricao="O cadastro pode ter sido excluído em definitivo."
          acao={<Button variant="secondary" size="sm"><Link to="/clientes">Voltar para a listagem</Link></Button>}
        />
      </Card>
    )
  }

  const c = cliente.data
  const saldo = extrato.data?.saldo ?? 0

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Trilha de volta: quem entra pela ação da tabela precisa do caminho de saída. */}
      <nav aria-label="Trilha" className="flex items-center gap-1.5 text-[13px] text-text-muted">
        <Link to="/clientes" className="font-medium text-primary hover:underline">Clientes</Link>
        <span aria-hidden>/</span>
        <span className="truncate text-text-secondary">{c?.nome ?? '…'}</span>
      </nav>

      {/* Identidade da conta + ações que valem em qualquer aba */}
      <Card>
        <CardBody className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {c ? <Avatar nome={c.nome} size="lg" className="h-12 w-12" /> : <Skeleton className="h-12 w-12 rounded-full" />}
            <div className="min-w-0">
              {c ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-lg font-semibold tracking-tight text-text sm:text-xl">{c.nome}</h1>
                    <Badge tom={tomStatus[c.status]}>{rotuloStatus[c.status]}</Badge>
                    {c.excluidoEm && <Badge tom="neutro">Na lixeira</Badge>}
                  </div>
                  <p className="mt-1 truncate text-[13px] text-text-muted">
                    #{c.id} · {c.email} · {mascaraCpf(c.documento)}
                  </p>
                </>
              ) : (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-3.5 w-64" />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setEditando(true)} disabled={!c}>
              <span aria-hidden>✏️</span> Editar cadastro
            </Button>
            <Button variant="secondary" onClick={() => setAjuste('debito')} disabled={!extrato.data}>
              <span aria-hidden>➖</span> Lançar débito
            </Button>
            <Button onClick={() => setAjuste('credito')} disabled={!extrato.data}>
              <span aria-hidden>➕</span> Lançar crédito
            </Button>
          </div>
        </CardBody>

        {/* Números da conta, sempre visíveis — não só na aba financeira. */}
        <div className="grid grid-cols-2 gap-px border-t border-border bg-border lg:grid-cols-4">
          {[
            { rotulo: 'Saldo em conta', valor: extrato.isLoading ? null : money(saldo), destaque: saldo < 0 },
            { rotulo: 'Receita recorrente', valor: c ? money(c.mrr) : null },
            { rotulo: 'Plano', valor: c?.plano ?? null },
            { rotulo: 'Cliente desde', valor: c ? date(c.criadoEm) : null },
          ].map((item) => (
            <div key={item.rotulo} className="bg-surface px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-text-muted">{item.rotulo}</p>
              {item.valor === null ? (
                <Skeleton className="mt-1.5 h-5 w-24" />
              ) : (
                <p className={cn('mt-0.5 text-[15px] font-semibold tabular-nums text-text', item.destaque && 'text-critical')}>
                  {item.valor}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Abas da conta — o estado mora na URL, então o link leva à aba certa. */}
      <div role="tablist" aria-label="Seções da conta" className="flex flex-wrap items-center gap-1 border-b border-border">
        {ABAS.map((item) => {
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
              <span aria-hidden>{item.icone}</span>
              {item.rotulo}
            </button>
          )
        })}
      </div>

      {aba === 'visao' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader titulo="Dados cadastrais" descricao="O que identifica a conta no sistema" />
            <CardBody>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                {[
                  ['Razão social / nome', c?.nome],
                  ['E-mail de cobrança', c?.email],
                  ['Documento', c ? mascaraCpf(c.documento) : undefined],
                  ['Plano contratado', c?.plano],
                  ['Status', c ? rotuloStatus[c.status] : undefined],
                  ['Último acesso', c ? timeAgo(c.ultimoAcesso) : undefined],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo as string}>
                    <dt className="text-[12px] uppercase tracking-wide text-text-muted">{rotulo}</dt>
                    {valor ? (
                      <dd className="mt-0.5 text-sm font-medium text-text">{valor}</dd>
                    ) : (
                      <Skeleton className="mt-1.5 h-4 w-32" />
                    )}
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader titulo="Saúde da conta" descricao="Sinais que antecedem o problema" />
            <CardBody className="space-y-5">
              <Meter rotulo="Uso do plano" valor={68} total={100} formatar={(n) => `${n}%`} />
              <Meter rotulo="Faturas pagas no prazo" valor={11} total={12} formatar={(n) => `${n}`} />
              <div className="rounded-lg bg-surface-2 p-3.5 text-[13px] text-text-secondary">
                {saldo < 0 ? (
                  <>Saldo negativo de <strong className="font-semibold text-critical">{money(Math.abs(saldo))}</strong> — a próxima cobrança já entra com débito acumulado.</>
                ) : (
                  <>Conta sem pendências financeiras. Próxima cobrança em {assinatura.data ? date(assinatura.data.proximaCobranca) : '—'}.</>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {aba === 'financeiro' && (
        <Card>
          <CardHeader
            titulo="Extrato da conta"
            descricao="Livro-razão: cada linha grava o saldo que ficou depois dela"
            acoes={
              <span className="text-[13px] text-text-muted">
                Saldo atual <strong className={cn('font-semibold tabular-nums text-text', saldo < 0 && 'text-critical')}>{money(saldo)}</strong>
              </span>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-2.5 text-left font-semibold">Data</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Movimento</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Autor</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Valor</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Saldo após</th>
                </tr>
              </thead>
              <tbody>
                {extrato.isLoading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/60">
                      <td colSpan={5} className="px-4 py-2.5"><Skeleton className="h-5 w-full" /></td>
                    </tr>
                  ))}

                {extrato.data?.movimentos.map((m) => {
                  const tom = tomMovimento[m.tipo]
                  return (
                    <tr key={m.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2">
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-text-secondary">{date(m.criadoEm)}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-text">{m.categoria}</p>
                        <p className="text-[12px] text-text-muted">{m.descricao}</p>
                      </td>
                      <td className="px-3 py-2.5 text-text-secondary">{m.autor}</td>
                      <td className={cn('whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums', tom.classe)}>
                        {m.valor > 0 ? '+' : '−'} {money(Math.abs(m.valor))}
                        <span className="ml-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">{tom.rotulo}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-text">{money(m.saldoApos)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted">
            O saldo não é recalculado somando a coluna: ele é gravado junto com o movimento. É o que
            permite explicar, linha a linha, de onde veio o número.
          </p>
        </Card>
      )}

      {aba === 'assinatura' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader titulo="Assinatura" descricao="Plano, ciclo e cobrança" />
            <CardBody>
              {assinatura.data ? (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  {[
                    ['Plano', assinatura.data.plano],
                    ['Ciclo', assinatura.data.ciclo],
                    ['Valor do ciclo', money(assinatura.data.valor)],
                    ['Próxima cobrança', date(assinatura.data.proximaCobranca)],
                    ['Forma de pagamento', assinatura.data.formaPagamento],
                    ['Assinante desde', date(assinatura.data.desde)],
                  ].map(([rotulo, valor]) => (
                    <div key={rotulo}>
                      <dt className="text-[12px] uppercase tracking-wide text-text-muted">{rotulo}</dt>
                      <dd className="mt-0.5 text-sm font-medium text-text">{valor}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <Skeleton className="h-24 w-full" />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader titulo="Ações da assinatura" />
            <CardBody className="space-y-2.5">
              <Button variant="secondary" block>Trocar de plano</Button>
              <Button variant="secondary" block>
                {assinatura.data?.renovacaoAutomatica ? 'Desligar renovação automática' : 'Ligar renovação automática'}
              </Button>
              <Button variant="secondary" block>Emitir segunda via</Button>
              <Button variant="danger" block>Cancelar assinatura</Button>
            </CardBody>
          </Card>
        </div>
      )}

      {aba === 'usuarios' && (
        <Card>
          <CardHeader
            titulo="Usuários da conta"
            descricao="Quem acessa o sistema por este cliente"
            acoes={<Button size="sm"><span aria-hidden>＋</span> Convidar usuário</Button>}
          />
          <ul className="divide-y divide-border">
            {usuarios.isLoading && (
              <li className="px-4 py-4"><Skeleton className="h-10 w-full" /></li>
            )}
            {usuarios.data?.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5">
                <Avatar nome={u.nome} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-text">{u.nome}</p>
                  <p className="truncate text-[12px] text-text-muted">{u.email} · último acesso {timeAgo(u.ultimoAcesso)}</p>
                </div>
                <Badge tom={u.papel === 'Titular' ? 'info' : 'neutro'}>{u.papel}</Badge>
                <Badge tom={u.ativo ? 'good' : 'neutro'}>{u.ativo ? 'Ativo' : 'Desativado'}</Badge>
                <Button variant="ghost" size="sm">{u.ativo ? 'Desativar' : 'Reativar'}</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {aba === 'historico' && (
        <Card>
          <CardHeader titulo="Histórico da conta" descricao="Quem fez o quê, e quando" />
          <ol className="divide-y divide-border">
            {auditoria.isLoading && <li className="px-4 py-4"><Skeleton className="h-10 w-full" /></li>}
            {auditoria.data?.map((evento) => (
              <li key={evento.id} className="flex gap-3 px-4 py-3.5 sm:px-5">
                <span aria-hidden className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary/40 ring-4 ring-primary/10" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-text-secondary">
                    <span className="font-semibold text-text">{evento.autor}</span> · {evento.acao}
                  </p>
                  <p className="text-[13px] text-text-muted">{evento.detalhe}</p>
                </div>
                <span className="shrink-0 whitespace-nowrap text-[12px] tabular-nums text-text-muted">{datetime(evento.criadoEm)}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <ClienteFormModal
        cliente={editando && c ? c : null}
        salvando={salvar.isPending}
        onFechar={() => setEditando(false)}
        onSalvar={(dados) => salvar.mutate(dados)}
      />

      <AjusteContaModal
        tipo={ajuste}
        saldoAtual={saldo}
        salvando={aplicarAjuste.isPending}
        onFechar={() => setAjuste(null)}
        onConfirmar={(dados) => aplicarAjuste.mutate(dados)}
      />
    </div>
  )
}
