import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  aceitarTransferencia, assumirConversa, devolverParaFila, emRisco, encerrarConversa,
  enviarMensagem, listarAtendentes, listarConversas, listarMensagens, listarTransferencias,
  marcarAguardandoCliente, recusarTransferencia, relogios, totaisChat, transferir as transferirApi,
} from '@/shared/api/chat'
import { USUARIO_ATUAL } from '@/shared/api/tarefas'
import type { Conversa, MensagemChat, SituacaoConversa } from '@/shared/api/types'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { CartaoResumo, GradeResumo } from '@/shared/ui/CartaoResumo'
import { ConfirmarAcao } from '@/shared/ui/ConfirmarAcao'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input } from '@/shared/ui/Field'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { datetime, number, timeAgo } from '@/shared/lib/format'
import { CANAL, dur, SITUACAO, STATUS } from './comum'
import { PainelSla } from './PainelSla'
import { TransferirModal } from './TransferirModal'

type Aba = 'na_fila' | 'minhas' | 'todas'
const ABAS: { id: Aba; rotulo: string; icone: string }[] = [
  { id: 'na_fila', rotulo: 'Fila', icone: '⏳' },
  { id: 'minhas', rotulo: 'Minhas', icone: '👤' },
  { id: 'todas', rotulo: 'Todas', icone: '📋' },
]

export function ChatPage() {
  const qc = useQueryClient()
  const [aba, setAba] = useState<Aba>('na_fila')
  const [busca, setBusca] = useState('')
  const [selecionada, setSelecionada] = useState<number | null>(null)
  const [texto, setTexto] = useState('')
  const [interna, setInterna] = useState(false)
  const [transferindo, setTransferindo] = useState(false)
  const [devolvendo, setDevolvendo] = useState(false)
  const [encerrando, setEncerrando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const fim = useRef<HTMLDivElement>(null)

  const filtro = aba === 'todas' ? undefined : { situacao: aba as SituacaoConversa | 'minhas' }
  const { data: totais } = useQuery({ queryKey: ['chat-totais'], queryFn: totaisChat })
  const { data: atendentes } = useQuery({ queryKey: ['chat-atendentes'], queryFn: listarAtendentes })
  const { data: lista, isLoading } = useQuery({
    queryKey: ['chat-conversas', aba, busca],
    queryFn: () => listarConversas({ ...filtro, busca }),
  })
  const conversa = lista?.find((c) => c.id === selecionada) ?? null
  const { data: mensagens } = useQuery({
    queryKey: ['chat-mensagens', selecionada],
    queryFn: () => listarMensagens(selecionada!),
    enabled: selecionada !== null,
  })
  const { data: transferencias } = useQuery({
    queryKey: ['chat-transferencias', selecionada],
    queryFn: () => listarTransferencias(selecionada!),
    enabled: selecionada !== null,
  })
  const pendente = transferencias?.find((t) => t.situacao === 'pendente') ?? null

  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }) }, [mensagens])

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['chat-conversas'] })
    void qc.invalidateQueries({ queryKey: ['chat-mensagens'] })
    void qc.invalidateQueries({ queryKey: ['chat-transferencias'] })
    void qc.invalidateQueries({ queryKey: ['chat-totais'] })
    void qc.invalidateQueries({ queryKey: ['chat-atendentes'] })
  }
  const aoErrar = (e: Error) => setErro(e.message)
  const aoAcertar = () => { invalidar(); setErro(null) }

  const assumir = useMutation({ mutationFn: (id: number) => assumirConversa(id), onSuccess: aoAcertar, onError: aoErrar })
  const enviar = useMutation({
    mutationFn: () => enviarMensagem(selecionada!, texto, interna),
    onSuccess: () => { aoAcertar(); setTexto(''); setInterna(false) },
    onError: aoErrar,
  })
  const transferir = useMutation({
    mutationFn: ({ para, motivo }: { para: string; motivo: string }) => transferirApi(selecionada!, para, motivo),
    onSuccess: () => { aoAcertar(); setTransferindo(false) },
    onError: aoErrar,
  })
  const aceitar = useMutation({ mutationFn: (id: number) => aceitarTransferencia(id), onSuccess: aoAcertar, onError: aoErrar })
  const recusar = useMutation({
    mutationFn: (id: number) => recusarTransferencia(id, 'Não é do meu escopo agora'),
    onSuccess: aoAcertar, onError: aoErrar,
  })
  const devolver = useMutation({
    mutationFn: () => devolverParaFila(selecionada!, 'Preciso sair da mesa'),
    onSuccess: () => { aoAcertar(); setDevolvendo(false) }, onError: aoErrar,
  })
  const esperar = useMutation({ mutationFn: (id: number) => marcarAguardandoCliente(id), onSuccess: aoAcertar, onError: aoErrar })
  const encerrar = useMutation({
    mutationFn: () => encerrarConversa(selecionada!, 'Solicitação atendida e confirmada com o cliente'),
    onSuccess: () => { aoAcertar(); setEncerrando(false) }, onError: aoErrar,
  })

  return (
    <div className="space-y-2 sm:space-y-4 lg:space-y-6">
      <PageHeader
        titulo="Chat de atendimento"
        descricao="Fila, SLA e transferência entre atendentes — com o relógio do cliente, não o do atendente."
      />

      <GradeResumo>
        <CartaoResumo
          rotulo="Na fila"
          valor={totais && number(totais.naFila)}
          nota={totais ? `espera média ${dur(totais.esperaMediaFila)}` : undefined}
          destaque={totais && totais.naFila > 3 ? 'text-serious' : undefined}
        />
        <CartaoResumo rotulo="Em atendimento" valor={totais && number(totais.emAtendimento)} nota={totais ? `${totais.minhas} minhas` : undefined} />
        <CartaoResumo
          rotulo="1ª resposta média"
          valor={totais && dur(totais.primeiraRespostaMedia)}
          nota="assumir não conta"
        />
        <CartaoResumo
          rotulo="Fora da meta"
          valor={totais && number(totais.estouros)}
          destaque={totais && totais.estouros > 0 ? 'text-critical' : 'text-good'}
          nota={totais ? `${totais.transferidasHoje} transferências` : undefined}
        />
      </GradeResumo>

      {erro && (
        <p role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-text-secondary">
          <span><span aria-hidden>⚠️ </span>{erro}</span>
          <button type="button" onClick={() => setErro(null)} className="shrink-0 font-medium text-primary hover:underline">entendi</button>
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:gap-4 lg:h-[calc(100dvh-22rem)] lg:min-h-[32rem] lg:grid-cols-[19rem_1fr] lg:gap-6 xl:grid-cols-[20rem_1fr_18rem]">
        {/* ── Fila e conversas ─────────────────────────────────────────── */}
        <Card className={cn('flex min-h-0 flex-col overflow-hidden', selecionada !== null && 'hidden lg:flex')}>
          <div className="space-y-2 border-b border-border p-2 sm:p-4 lg:p-6">
            <div role="tablist" aria-label="Filtro de conversas" className="flex items-center gap-1">
              {ABAS.map((item) => (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={aba === item.id}
                  onClick={() => setAba(item.id)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium transition-colors',
                    aba === item.id ? 'bg-primary/12 text-primary' : 'text-text-muted hover:bg-surface-2 hover:text-text',
                  )}
                >
                  <span aria-hidden>{item.icone}</span>{item.rotulo}
                  {item.id === 'na_fila' && totais && totais.naFila > 0 && (
                    <span className="rounded-full bg-serious/16 px-1.5 text-[11px] font-semibold text-serious">{totais.naFila}</span>
                  )}
                </button>
              ))}
            </div>
            <Input
              placeholder="Buscar cliente, assunto ou protocolo"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading && <div className="space-y-2 p-2 sm:p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>}
            {lista?.length === 0 && <EmptyState icone="🎉" titulo="Nada na fila" descricao="Ninguém esperando neste recorte." />}
            {lista?.map((c) => <ItemConversa key={c.id} conversa={c} ativa={c.id === selecionada} onClick={() => setSelecionada(c.id)} />)}
          </div>
        </Card>

        {/* ── Conversa ─────────────────────────────────────────────────── */}
        <Card className={cn('flex min-h-0 flex-col overflow-hidden', selecionada === null && 'hidden lg:flex')}>
          {!conversa ? (
            <EmptyState icone="💬" titulo="Escolha uma conversa" descricao="A fila fica à esquerda, ordenada por quem está esperando há mais tempo." />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-border p-2 sm:p-4 lg:p-6">
                <button type="button" onClick={() => setSelecionada(null)} className="rounded-lg px-2 py-1 text-[13px] font-medium text-primary hover:bg-surface-2 lg:hidden">
                  ← Fila
                </button>
                <Avatar nome={conversa.cliente} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-text">{conversa.cliente}</p>
                  <p className="truncate text-[12px] text-text-muted">
                    {conversa.protocolo} · <span aria-hidden>{CANAL[conversa.canal].icone}</span> {CANAL[conversa.canal].rotulo} · {conversa.assunto}
                  </p>
                </div>
                <Badge tom={SITUACAO[conversa.situacao].tom}>{SITUACAO[conversa.situacao].rotulo}</Badge>
              </div>

              {pendente && (
                <div className="flex flex-wrap items-center gap-2 border-b border-border bg-primary/8 p-2 text-[13px] sm:p-4">
                  <span className="min-w-0 flex-1 text-text-secondary">
                    <strong className="text-text">{pendente.de}</strong> quer transferir para{' '}
                    <strong className="text-text">{pendente.para}</strong>: “{pendente.motivo}”.
                    Até alguém aceitar, a conversa segue com {pendente.de}.
                  </span>
                  <Button size="sm" loading={aceitar.isPending} onClick={() => aceitar.mutate(pendente.id)}>Aceitar</Button>
                  <Button size="sm" variant="ghost" loading={recusar.isPending} onClick={() => recusar.mutate(pendente.id)}>Recusar</Button>
                </div>
              )}

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2 sm:p-4 lg:p-6">
                {mensagens?.map((m) => <Bolha key={m.id} mensagem={m} />)}
                <div ref={fim} />
              </div>

              {conversa.situacao === 'na_fila' ? (
                <div className="border-t border-border p-2 sm:p-4 lg:p-6">
                  <Button
                    className="w-full"
                    loading={assumir.isPending}
                    onClick={() => assumir.mutate(conversa.id)}
                  >
                    Assumir atendimento · esperando há {dur(relogios(conversa).fila)}
                  </Button>
                  <p className="mt-2 text-center text-[12px] text-text-muted">
                    Assumir fecha o relógio da fila e abre o da primeira resposta.
                  </p>
                </div>
              ) : conversa.situacao === 'encerrada' ? (
                <p className="border-t border-border p-2 text-center text-[13px] text-text-muted sm:p-4">
                  Encerrada {timeAgo(conversa.encerradaEm!)} — o histórico fica.
                </p>
              ) : (
                <form
                  onSubmit={(e) => { e.preventDefault(); enviar.mutate() }}
                  className="space-y-2 border-t border-border p-2 sm:p-4 lg:p-6"
                >
                  <textarea
                    rows={2}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder={interna ? 'Nota interna — o cliente não vê' : 'Escreva para o cliente'}
                    className={cn(
                      'w-full resize-none rounded-lg border px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/25',
                      interna ? 'border-warning/50 bg-warning/8' : 'border-border bg-surface hover:border-border-strong focus:border-primary',
                    )}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      aria-pressed={interna}
                      onClick={() => setInterna((v) => !v)}
                      className={cn(
                        'rounded-lg px-2 py-1 text-[12px] font-medium transition-colors',
                        interna ? 'bg-warning/16 text-[rgb(146,98,0)] dark:text-warning' : 'text-text-muted hover:bg-surface-2',
                      )}
                    >
                      <span aria-hidden>🔒 </span>Nota interna
                    </button>
                    <span className="text-[11px] text-text-muted">
                      {interna ? 'não conta como resposta ao cliente' : 'para o cliente'}
                    </span>
                    <Button type="submit" size="sm" className="ml-auto" disabled={!texto.trim()} loading={enviar.isPending}>
                      Enviar
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
        </Card>

        {/* ── SLA, ações e equipe ──────────────────────────────────────── */}
        <div className={cn('min-h-0 space-y-2 overflow-y-auto sm:space-y-4 xl:space-y-6', selecionada === null && 'hidden xl:block')}>
          {conversa && (
            <>
              <Card>
                <CardHeader titulo="SLA deste atendimento" />
                <CardBody><PainelSla conversa={conversa} /></CardBody>
              </Card>

              {conversa.situacao !== 'na_fila' && conversa.situacao !== 'encerrada' && (
                <Card>
                  <CardHeader titulo="Ações" descricao={conversa.atendente ? `com ${conversa.atendente}` : undefined} />
                  <CardBody className="grid grid-cols-1 gap-2">
                    <Button variant="secondary" onClick={() => setTransferindo(true)}>
                      <span aria-hidden>↔️ </span> Transferir
                    </Button>
                    {conversa.situacao === 'em_atendimento' && (
                      <Button variant="ghost" loading={esperar.isPending} onClick={() => esperar.mutate(conversa.id)}>
                        <span aria-hidden>⏸️ </span> Aguardando cliente
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => setDevolvendo(true)}>
                      <span aria-hidden>↩️ </span> Devolver para a fila
                    </Button>
                    <Button variant="ghost" onClick={() => setEncerrando(true)}>
                      <span aria-hidden>✔️ </span> Encerrar
                    </Button>
                  </CardBody>
                </Card>
              )}

              {!!transferencias?.length && (
                <Card>
                  <CardHeader titulo="Histórico de transferências" descricao="Quem passou, para quem e por quê" />
                  <CardBody className="space-y-3">
                    {transferencias.map((t) => (
                      <div key={t.id} className="border-l-2 border-border pl-3 text-[12px]">
                        <p className="font-medium text-text">{t.de} → {t.para}</p>
                        <p className="mt-0.5 text-text-secondary">“{t.motivo}”</p>
                        <p className="mt-0.5 text-text-muted">{datetime(t.em)} · {t.situacao}</p>
                      </div>
                    ))}
                  </CardBody>
                </Card>
              )}
            </>
          )}

          <Card>
            <CardHeader titulo="Equipe" descricao="Quem pode receber transferência agora" />
            <CardBody className="space-y-2.5">
              {atendentes?.map((a) => (
                <div key={a.nome} className="flex items-center gap-2.5">
                  <span className="relative shrink-0">
                    <Avatar nome={a.nome} size="sm" />
                    <span aria-hidden className={cn('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface', STATUS[a.status].cor)} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-text">
                      {a.nome}{a.nome === USUARIO_ATUAL && <span className="text-text-muted"> (você)</span>}
                    </span>
                    <span className="block truncate text-[11px] text-text-muted">{a.equipe} · {STATUS[a.status].rotulo}</span>
                  </span>
                  <span className={cn('shrink-0 text-[12px] font-semibold tabular-nums', a.emAtendimento >= a.capacidade ? 'text-critical' : 'text-text-secondary')}>
                    {a.emAtendimento}/{a.capacidade}
                  </span>
                </div>
              ))}
              <p className="pt-1 text-[11px] leading-snug text-text-muted">
                Capacidade é limite que <strong className="text-text-secondary">recusa</strong>:
                transferir para quem já está cheio só move a fila de lugar.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      {conversa && (
        <TransferirModal
          conversa={conversa}
          aberto={transferindo}
          carregando={transferir.isPending}
          erro={transferir.isError ? (transferir.error as Error).message : null}
          onFechar={() => { setTransferindo(false); transferir.reset() }}
          onTransferir={(para, motivo) => transferir.mutate({ para, motivo })}
        />
      )}

      <ConfirmarAcao
        aberto={devolvendo}
        titulo="Devolver para a fila"
        rotuloConfirmar="Devolver"
        carregando={devolver.isPending}
        onCancelar={() => setDevolvendo(false)}
        onConfirmar={() => devolver.mutate()}
        mensagem={
          <>
            A conversa volta para a fila e fica <strong className="font-semibold text-text">sem dono</strong> até
            alguém assumir — o relógio do cliente continua correndo. Se há alguém certo para o
            assunto, transferir é melhor: mantém o dono e leva o contexto junto.
          </>
        }
      />

      <ConfirmarAcao
        aberto={encerrando}
        titulo="Encerrar atendimento"
        rotuloConfirmar="Encerrar"
        tom="primary"
        carregando={encerrar.isPending}
        onCancelar={() => setEncerrando(false)}
        onConfirmar={() => encerrar.mutate()}
        mensagem="O histórico e os relógios ficam registrados. Conversa encerrada não recebe mensagem nova — se o cliente voltar, abre outra, com protocolo próprio."
      />
    </div>
  )
}

function ItemConversa({ conversa, ativa, onClick }: { conversa: Conversa; ativa: boolean; onClick: () => void }) {
  const r = relogios(conversa)
  const risco = emRisco(conversa)

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={ativa}
      className={cn(
        'flex w-full gap-2.5 border-b border-border/60 p-2 text-left transition-colors last:border-0 sm:p-4',
        ativa ? 'bg-primary/8' : 'hover:bg-surface-2',
      )}
    >
      <Avatar nome={conversa.cliente} size="sm" className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text">{conversa.cliente}</span>
          <span className={cn('shrink-0 text-[11px] tabular-nums', risco ? 'font-semibold text-critical' : 'text-text-muted')}>
            {conversa.situacao === 'na_fila' ? dur(r.fila) : timeAgo(conversa.ultimaMensagemEm)}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-text-secondary">{conversa.assunto}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-text-muted">
          <span aria-hidden>{CANAL[conversa.canal].icone}</span>
          <span className="rounded bg-surface-3 px-1 font-medium">{conversa.prioridade}</span>
          {conversa.atendente ? <span className="truncate">{conversa.atendente}</span> : <span className="font-medium text-serious">sem atendente</span>}
          {conversa.transferencias > 0 && <span title="transferências">↔ {conversa.transferencias}</span>}
          {conversa.naoLidas > 0 && (
            <span className="ml-auto rounded-full bg-primary px-1.5 font-semibold text-text-inverse">{conversa.naoLidas}</span>
          )}
        </span>
      </span>
    </button>
  )
}

function Bolha({ mensagem }: { mensagem: MensagemChat }) {
  if (mensagem.autor === 'sistema') {
    return (
      <p className="mx-auto max-w-md rounded-full bg-surface-2 px-3 py-1 text-center text-[11px] text-text-muted">
        {mensagem.texto}
      </p>
    )
  }
  const meu = mensagem.autor === 'atendente'
  return (
    <div className={cn('flex', meu ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-relaxed sm:max-w-[75%]',
        mensagem.interna ? 'border border-warning/40 bg-warning/10 text-text-secondary'
        : meu ? 'bg-primary text-text-inverse' : 'bg-surface-2 text-text')}>
        {mensagem.interna && <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide"><span aria-hidden>🔒 </span>Nota interna</p>}
        <p className="whitespace-pre-wrap">{mensagem.texto}</p>
        <p className={cn('mt-1 text-[11px]', meu && !mensagem.interna ? 'text-text-inverse/70' : 'text-text-muted')}>
          {mensagem.de} · {timeAgo(mensagem.em)}
        </p>
      </div>
    </div>
  )
}
