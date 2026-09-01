import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  aguardarCliente, atribuirChamado, ATENDENTES, emAberto, formatarMinutos, listarMensagens,
  minutosParaPrimeiraResposta, minutosUteis, obterChamado, prioridadeChamado, reabrir,
  resolver, responder, SLA, slaEmRisco, slaResolucaoConsumido, slaResolucaoEstourado,
  slaRespostaEstourado,
} from '@/shared/api/chamados'
import type { SituacaoChamado } from '@/shared/api/types'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { Checkbox, Input } from '@/shared/ui/Field'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Modal } from '@/shared/ui/Modal'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { datetime, percent, timeAgo } from '@/shared/lib/format'

const situacaoInfo: Record<SituacaoChamado, { tom: 'info' | 'warning' | 'good' | 'neutro'; rotulo: string }> = {
  novo: { tom: 'warning', rotulo: 'Novo' },
  em_atendimento: { tom: 'info', rotulo: 'Em atendimento' },
  aguardando_cliente: { tom: 'neutro', rotulo: 'Aguardando cliente' },
  resolvido: { tom: 'good', rotulo: 'Resolvido' },
  fechado: { tom: 'neutro', rotulo: 'Fechado' },
  cancelado: { tom: 'neutro', rotulo: 'Cancelado' },
}

export function ChamadoPage() {
  const { id } = useParams()
  const chamadoId = Number(id)
  const qc = useQueryClient()

  const [texto, setTexto] = useState('')
  const [interno, setInterno] = useState(false)
  const [resolvendo, setResolvendo] = useState(false)
  const [reabrindo, setReabrindo] = useState(false)
  const [solucao, setSolucao] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const chamado = useQuery({ queryKey: ['chamado', chamadoId], queryFn: () => obterChamado(chamadoId), refetchInterval: 60_000 })
  const mensagens = useQuery({ queryKey: ['chamado-mensagens', chamadoId], queryFn: () => listarMensagens(chamadoId) })

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['chamado', chamadoId] })
    void qc.invalidateQueries({ queryKey: ['chamado-mensagens', chamadoId] })
    void qc.invalidateQueries({ queryKey: ['chamados'] })
    void qc.invalidateQueries({ queryKey: ['chamados-totais'] })
  }

  const enviar = useMutation({
    mutationFn: () => responder(chamadoId, texto, interno),
    onSuccess: () => { invalidar(); setTexto(''); setErro(null) },
    onError: (e: Error) => setErro(e.message),
  })
  const pausar = useMutation({ mutationFn: () => aguardarCliente(chamadoId), onSuccess: () => { invalidar(); setErro(null) }, onError: (e: Error) => setErro(e.message) })
  const resolverMut = useMutation({
    mutationFn: () => resolver(chamadoId, solucao),
    onSuccess: () => { invalidar(); setResolvendo(false); setSolucao(''); setErro(null) },
    onError: (e: Error) => setErro(e.message),
  })
  const reabrirMut = useMutation({
    mutationFn: () => reabrir(chamadoId, motivo),
    onSuccess: () => { invalidar(); setReabrindo(false); setMotivo(''); setErro(null) },
    onError: (e: Error) => setErro(e.message),
  })
  const atribuir = useMutation({ mutationFn: (p: string | null) => atribuirChamado(chamadoId, p), onSuccess: invalidar })

  if (chamado.isError) {
    return <Card><EmptyState icone="🔍" titulo="Chamado não encontrado" acao={<Button variant="secondary" size="sm"><Link to="/chamados">Voltar</Link></Button>} /></Card>
  }

  const c = chamado.data
  const consumo = c ? slaResolucaoConsumido(c) : 0
  const prioridade = c ? prioridadeChamado(c) : 'P4'

  return (
    <div className="space-y-4 sm:space-y-5">
      <nav aria-label="Trilha" className="flex items-center gap-1.5 text-[13px] text-text-muted">
        <Link to="/chamados" className="font-medium text-primary hover:underline">Chamados</Link>
        <span aria-hidden>/</span>
        <span className="truncate text-text-secondary">{c?.numero ?? '…'}</span>
      </nav>

      <Card>
        <CardBody className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-semibold tracking-tight text-text sm:text-xl">{c?.assunto ?? '…'}</h1>
              {c && <Badge tom={situacaoInfo[c.situacao].tom}>{situacaoInfo[c.situacao].rotulo}</Badge>}
              {c && <Badge tom={prioridade === 'P1' ? 'critical' : prioridade === 'P2' ? 'warning' : 'neutro'}>{prioridade}</Badge>}
              {c && c.reaberturas > 0 && <Badge tom="warning">{c.reaberturas}× reaberto</Badge>}
            </div>
            <p className="mt-1 truncate text-[13px] text-text-muted">
              {c ? <>{c.numero} · <Link to={`/clientes/${c.clienteId}`} className="text-primary hover:underline">{c.cliente}</Link> · {c.solicitante} · {c.canal} · aberto {timeAgo(c.abertoEm)}</> : '…'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="w-44">
              <span className="sr-only">Responsável</span>
              <select
                value={c?.responsavel ?? ''}
                onChange={(e) => atribuir.mutate(e.target.value || null)}
                className={cn('h-9 w-full rounded-lg border bg-surface px-2 text-[13px] text-text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25',
                  c?.responsavel ? 'border-border' : 'border-warning/50')}
              >
                <option value="">sem responsável</option>
                {ATENDENTES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            {c && emAberto(c) && (
              <>
                <Button variant="secondary" loading={pausar.isPending} onClick={() => pausar.mutate()} disabled={c.situacao === 'aguardando_cliente'}>
                  <span aria-hidden>⏸</span> Aguardar cliente
                </Button>
                <Button onClick={() => { setErro(null); setResolvendo(true) }}><span aria-hidden>✔️</span> Resolver</Button>
              </>
            )}
            {c && ['resolvido', 'fechado'].includes(c.situacao) && (
              <Button variant="secondary" onClick={() => { setErro(null); setReabrindo(true) }}>Reabrir</Button>
            )}
          </div>
        </CardBody>

        {/* Os dois relógios, lado a lado. */}
        <div className="grid grid-cols-2 gap-px border-t border-border bg-border lg:grid-cols-4">
          {c && [
            {
              rotulo: '1ª resposta',
              valor: `${formatarMinutos(minutosParaPrimeiraResposta(c))} / ${formatarMinutos(SLA[prioridade].resposta)}`,
              destaque: slaRespostaEstourado(c) ? 'text-critical' : c.primeiraRespostaEm ? 'text-good' : 'text-warning',
            },
            {
              rotulo: 'Tempo útil',
              valor: formatarMinutos(minutosUteis(c, c.resolvidoEm)),
              nota: c.minutosPausados > 0 ? `${formatarMinutos(c.minutosPausados)} pausados` : undefined,
            },
            {
              rotulo: 'SLA de resolução',
              valor: `${percent(consumo)} de ${formatarMinutos(SLA[prioridade].resolucao)}`,
              destaque: slaResolucaoEstourado(c) ? 'text-critical' : slaEmRisco(c) ? 'text-warning' : 'text-good',
            },
            { rotulo: 'Prioridade', valor: `${prioridade} · ${c.urgencia}/${c.impacto}` },
          ].map((item) => (
            <div key={item.rotulo} className="bg-surface px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-text-muted">{item.rotulo}</p>
              <p className={cn('mt-0.5 text-[13px] font-semibold tabular-nums', item.destaque ?? 'text-text')}>{item.valor}</p>
              {item.nota && <p className="text-[11px] text-text-muted">{item.nota}</p>}
            </div>
          ))}
          {!c && <div className="col-span-4 bg-surface p-4"><Skeleton className="h-10 w-full" /></div>}
        </div>
      </Card>

      {c?.situacao === 'aguardando_cliente' && (
        <p className="flex items-start gap-2 rounded-lg border border-border bg-surface-2 px-4 py-3 text-[13px] text-text-secondary">
          <span aria-hidden>⏸</span>
          <span>
            <strong className="text-text">Relógio pausado há {timeAgo(c.pausadoDesde ?? c.abertoEm)}.</strong> O SLA
            não corre enquanto a bola está com o cliente — mas chamado parado precisa de vigilância: sem cobrança,
            ele fica aqui para sempre e some da fila.
          </span>
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader titulo="Conversa" descricao="Mensagem interna fica visível só para a equipe" />
          <ul className="divide-y divide-border">
            {mensagens.isLoading && <li className="p-4"><Skeleton className="h-24 w-full" /></li>}
            {mensagens.data?.map((m) => (
              <li key={m.id} className={cn('flex gap-3 px-4 py-3.5 sm:px-5', m.interno && 'bg-warning/[0.06]')}>
                {m.automatica ? (
                  <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[13px]">🤖</span>
                ) : (
                  <Avatar nome={m.autor} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="font-semibold text-text">{m.autor}</span>
                    <span className="text-text-muted">{datetime(m.criadoEm)}</span>
                    {m.interno && <Badge tom="warning">nota interna</Badge>}
                    {/* A automática não conta como primeira resposta — e a tela diz. */}
                    {m.automatica && <Badge tom="neutro">automática · não conta como resposta</Badge>}
                  </p>
                  <p className="mt-1 text-[13px] text-text-secondary">{m.texto}</p>
                </div>
              </li>
            ))}
          </ul>

          {c && emAberto(c) && (
            <div className="space-y-2.5 border-t border-border p-4">
              {erro && <p role="alert" className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2 text-[13px] text-critical">⚠️ {erro}</p>}
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={3}
                placeholder={interno ? 'Nota interna — o cliente não vê…' : 'Responder ao cliente…'}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Checkbox label="Nota interna (não vai ao cliente)" checked={interno} onChange={(e) => setInterno(e.target.checked)} />
                <Button loading={enviar.isPending} disabled={!texto.trim()} onClick={() => enviar.mutate()}>
                  {interno ? 'Salvar nota' : 'Responder'}
                </Button>
              </div>
              {!c.primeiraRespostaEm && !interno && (
                <p className="text-[12px] text-text-muted">
                  Esta será a <strong className="text-text-secondary">primeira resposta humana</strong> — é ela que para
                  o relógio de resposta, não a mensagem automática.
                </p>
              )}
            </div>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader titulo="Como a prioridade sai" descricao="Urgência × impacto, não campo livre" />
          <CardBody className="space-y-3 text-[13px] text-text-secondary">
            <p>
              Prioridade calculada: <strong className="text-text">{prioridade}</strong> —
              urgência <strong className="text-text">{c?.urgencia}</strong> × impacto <strong className="text-text">{c?.impacto}</strong>.
            </p>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-text-muted">
                  <th className="py-1 text-left font-semibold">Prioridade</th>
                  <th className="py-1 text-right font-semibold">1ª resposta</th>
                  <th className="py-1 text-right font-semibold">Resolução</th>
                </tr>
              </thead>
              <tbody>
                {(['P1', 'P2', 'P3', 'P4'] as const).map((p) => (
                  <tr key={p} className={cn('border-t border-border/60', p === prioridade && 'font-semibold text-text')}>
                    <td className="py-1.5">{p}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatarMinutos(SLA[p].resposta)}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatarMinutos(SLA[p].resolucao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-border pt-2 text-[12px] text-text-muted">
              Deixar a prioridade como campo livre transforma tudo em "urgente" — e quando tudo é urgente, a fila
              volta a ser ordem de chegada.
            </p>
          </CardBody>
        </Card>
      </div>

      <Modal
        aberto={resolvendo}
        titulo="Resolver chamado"
        descricao="A solução vira base de conhecimento e evita o próximo chamado igual."
        onFechar={resolverMut.isPending ? () => {} : () => setResolvendo(false)}
        rodape={
          <>
            <Button variant="ghost" onClick={() => setResolvendo(false)} disabled={resolverMut.isPending}>Cancelar</Button>
            <Button loading={resolverMut.isPending} onClick={() => resolverMut.mutate()}>Resolver</Button>
          </>
        }
      >
        <div className="space-y-3">
          {erro && <p role="alert" className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2.5 text-[13px] text-critical">⚠️ {erro}</p>}
          <textarea
            value={solucao}
            onChange={(e) => setSolucao(e.target.value)}
            rows={4}
            data-foco-inicial
            placeholder="O que resolveu o problema, e o que o cliente precisa saber."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
          <p className="text-[12px] text-text-muted">
            Resolver rápido e reabrir três vezes é pior que resolver uma vez — a reabertura conta, e aparece no painel.
          </p>
        </div>
      </Modal>

      <Modal
        aberto={reabrindo}
        titulo="Reabrir chamado"
        onFechar={reabrirMut.isPending ? () => {} : () => setReabrindo(false)}
        rodape={
          <>
            <Button variant="ghost" onClick={() => setReabrindo(false)} disabled={reabrirMut.isPending}>Cancelar</Button>
            <Button variant="danger" loading={reabrirMut.isPending} onClick={() => reabrirMut.mutate()}>Reabrir</Button>
          </>
        }
      >
        <div className="space-y-3">
          {erro && <p role="alert" className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2.5 text-[13px] text-critical">⚠️ {erro}</p>}
          <Input label="Por que está sendo reaberto?" data-foco-inicial value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <p className="text-[12px] text-text-muted">
            A reabertura fica registrada no chamado e conta na taxa de reabertura — é o contrapeso do tempo de
            resolução, que sozinho premia fechar rápido.
          </p>
        </div>
      </Modal>
    </div>
  )
}
