import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelarReserva, confirmarReserva, criarReserva, fazerCheckin, fazerCheckout, HORARIOS, hoje,
  listarReservas, mapaOcupacao, marcarNoShow, noites, POLITICA, totaisReservas, unidades,
} from '@/shared/api/reservas'
import type { Reserva } from '@/shared/api/types'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardHeader } from '@/shared/ui/Card'
import { CartaoResumo, GradeResumo } from '@/shared/ui/CartaoResumo'
import { ConfirmarAcao } from '@/shared/ui/ConfirmarAcao'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Modal } from '@/shared/ui/Modal'
import { PageHeader } from '@/shared/ui/PageHeader'
import { cn } from '@/shared/lib/cn'
import { date, money, number, percent } from '@/shared/lib/format'
import { CANAL, SITUACAO, TIPO } from './comum'
import { MapaOcupacao } from './MapaOcupacao'
import { NovaReservaModal } from './NovaReservaModal'
import { UnidadesPainel } from './UnidadesPainel'

const maisDias = (base: string, n: number) =>
  new Date(+new Date(`${base}T12:00:00`) + n * 86400000).toISOString().slice(0, 10)

type Aba = 'mapa' | 'reservas' | 'unidades'

export function ReservasPage() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const aba = (params.get('aba') ?? 'mapa') as Aba
  const [inicioMapa, setInicioMapa] = useState(maisDias(hoje(), -2))
  const [nova, setNova] = useState<{ unidadeId?: number; data?: string } | null>(null)
  const [detalhe, setDetalhe] = useState<Reserva | null>(null)
  const [cancelando, setCancelando] = useState<Reserva | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const { data: totais } = useQuery({ queryKey: ['reservas-totais'], queryFn: totaisReservas })
  const { data: linhas, isLoading: carregandoMapa } = useQuery({
    queryKey: ['reservas-mapa', inicioMapa],
    queryFn: () => mapaOcupacao(inicioMapa, 14),
    enabled: aba === 'mapa',
  })
  const { data: lista } = useQuery({
    queryKey: ['reservas-lista'],
    queryFn: () => listarReservas(),
    enabled: aba === 'reservas',
  })

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['reservas-mapa'] })
    void qc.invalidateQueries({ queryKey: ['reservas-lista'] })
    void qc.invalidateQueries({ queryKey: ['reservas-totais'] })
    void qc.invalidateQueries({ queryKey: ['reservas-disponiveis'] })
  }
  const aoErrar = (e: Error) => setErro(e.message)
  const aoAcertar = () => { invalidar(); setErro(null); setDetalhe(null) }

  const criar = useMutation({
    mutationFn: criarReserva,
    onSuccess: () => { invalidar(); setErro(null); setNova(null) },
    onError: aoErrar,
  })
  const confirmar = useMutation({ mutationFn: (id: number) => confirmarReserva(id), onSuccess: aoAcertar, onError: aoErrar })
  const checkin = useMutation({ mutationFn: (id: number) => fazerCheckin(id), onSuccess: aoAcertar, onError: aoErrar })
  const checkout = useMutation({
    mutationFn: (id: number) => fazerCheckout(id),
    onSuccess: ({ lateCheckout }) => { aoAcertar(); if (lateCheckout) setErro(`Saída após ${HORARIOS.saida} — late check-out: lance a diária extra antes de fechar a conta.`) },
    onError: aoErrar,
  })
  const noShow = useMutation({ mutationFn: (id: number) => marcarNoShow(id), onSuccess: aoAcertar, onError: aoErrar })
  const cancelar = useMutation({
    mutationFn: (id: number) => cancelarReserva(id, 'Cancelado pelo hóspede'),
    onSuccess: ({ multa }) => { aoAcertar(); setCancelando(null); if (multa > 0) setErro(`Cancelamento dentro do prazo de ${POLITICA.cancelamentoDias} dias: multa de ${money(multa)} a cobrar.`) },
    onError: aoErrar,
  })

  return (
    <div className="space-y-2 sm:space-y-4 lg:space-y-6">
      <PageHeader
        titulo="Reservas"
        descricao={`Entrada ${HORARIOS.entrada} · saída ${HORARIOS.saida} — o que se vende é a noite, não o dia.`}
        acoes={<Button onClick={() => setNova({})}><span aria-hidden>＋</span> Nova reserva</Button>}
      />

      <GradeResumo>
        <CartaoResumo rotulo="Ocupação (30 dias)" valor={totais && percent(totais.ocupacao)} nota={totais ? `${number(totais.noitesVendidas)} noites vendidas` : undefined} />
        <CartaoResumo rotulo="Diária média" valor={totais && money(totais.diariaMedia)} nota="o par que impede encher com desconto" />
        <CartaoResumo rotulo="Receita por unidade" valor={totais && money(totais.receitaPorUnidade)} nota="ocupação × diária, por noite disponível" />
        <CartaoResumo
          rotulo="Hoje"
          valor={totais && `${totais.chegadasHoje} ↓ / ${totais.saidasHoje} ↑`}
          nota={totais ? `${totais.hospedados} hospedados agora` : undefined}
        />
      </GradeResumo>

      {erro && (
        <p role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-text-secondary">
          <span><span aria-hidden>⚠️ </span>{erro}</span>
          <button type="button" onClick={() => setErro(null)} className="shrink-0 font-medium text-primary hover:underline">entendi</button>
        </p>
      )}

      <div role="tablist" aria-label="Seções de reservas" className="flex flex-wrap items-center gap-1 border-b border-border">
        {([
          { id: 'mapa', rotulo: 'Mapa de ocupação', icone: '🗓️' },
          { id: 'reservas', rotulo: 'Reservas', icone: '📋' },
          { id: 'unidades', rotulo: 'Quartos e cabanas', icone: '🏡' },
        ] as const).map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={aba === item.id}
            onClick={() => setParams({ aba: item.id }, { replace: true })}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors',
              aba === item.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:border-border-strong hover:text-text',
            )}
          >
            <span aria-hidden>{item.icone}</span>{item.rotulo}
          </button>
        ))}
      </div>

      {aba === 'mapa' && (
        <Card>
          <CardHeader
            titulo="Mapa de ocupação"
            descricao="Cada coluna é uma NOITE. Clique numa célula livre para reservar."
            acoes={
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setInicioMapa(maisDias(inicioMapa, -7))}>←</Button>
                <Button size="sm" variant="ghost" onClick={() => setInicioMapa(maisDias(hoje(), -2))}>Hoje</Button>
                <Button size="sm" variant="ghost" onClick={() => setInicioMapa(maisDias(inicioMapa, 7))}>→</Button>
              </div>
            }
          />
          <MapaOcupacao
            linhas={linhas}
            carregando={carregandoMapa}
            onCelulaVazia={(unidadeId, data) => setNova({ unidadeId, data })}
            onReserva={(r) => setDetalhe(r)}
          />
          <div className="flex flex-wrap items-center gap-3 border-t border-border p-2 text-[12px] text-text-muted sm:p-4 lg:p-6">
            {(['pre_reserva', 'confirmada', 'hospedado', 'finalizada'] as const).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span aria-hidden className={cn('h-3 w-5 rounded', SITUACAO[s].barra)} />{SITUACAO[s].rotulo}
              </span>
            ))}
            <span className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-5 rounded bg-surface-3" />Bloqueio (manutenção)</span>
            <span className="ml-auto">
              A barra termina na <strong className="text-text-secondary">última noite</strong>: o dia da saída já está à venda.
            </span>
          </div>
        </Card>
      )}

      {aba === 'reservas' && (
        <Card>
          <CardHeader titulo="Reservas" descricao="Ordenadas por data de entrada" />
          {lista?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-text-muted">
                    <th className="px-4 py-2.5 text-left font-semibold">Reserva</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Unidade</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Período</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Noites</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Total</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Situação</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((r) => {
                    const u = unidades.find((x) => x.id === r.unidadeId)!
                    return (
                      <tr key={r.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2">
                        <td className="px-4 py-2.5">
                          <button type="button" onClick={() => setDetalhe(r)} className="font-mono text-[12px] font-medium text-text hover:underline">{r.codigo}</button>
                          <p className="truncate text-[12px] text-text-secondary">{r.hospede ?? `🔧 ${r.motivo}`}</p>
                        </td>
                        <td className="px-3 py-2.5 text-text-secondary"><span aria-hidden>{TIPO[u.tipo].icone} </span>{u.nome}</td>
                        <td className="px-3 py-2.5 text-text-secondary">{date(r.entrada)} → {date(r.saida)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-text-secondary">{noites(r.entrada, r.saida)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text">{money(r.valorDiarias + r.valorExtras)}</td>
                        <td className="px-3 py-2.5"><Badge tom={SITUACAO[r.situacao].tom}>{SITUACAO[r.situacao].rotulo}</Badge></td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {r.situacao === 'pre_reserva' && <Button size="sm" variant="ghost" onClick={() => confirmar.mutate(r.id)}>Confirmar</Button>}
                            {r.situacao === 'confirmada' && r.origem === 'hospede' && <Button size="sm" variant="ghost" onClick={() => checkin.mutate(r.id)}>Check-in</Button>}
                            {r.situacao === 'hospedado' && <Button size="sm" variant="ghost" onClick={() => checkout.mutate(r.id)}>Check-out</Button>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icone="🗓️" titulo="Nenhuma reserva" />
          )}
        </Card>
      )}

      {aba === 'unidades' && <UnidadesPainel />}

      <NovaReservaModal
        aberto={nova !== null}
        inicial={nova}
        carregando={criar.isPending}
        erro={criar.isError ? (criar.error as Error).message : null}
        onFechar={() => { setNova(null); criar.reset() }}
        onCriar={(dados) => criar.mutate(dados)}
      />

      <Modal
        aberto={detalhe !== null}
        onFechar={() => setDetalhe(null)}
        titulo={detalhe?.origem === 'bloqueio' ? 'Bloqueio' : `Reserva ${detalhe?.codigo ?? ''}`}
        descricao={detalhe ? `${unidades.find((u) => u.id === detalhe.unidadeId)?.nome} · ${date(detalhe.entrada)} → ${date(detalhe.saida)}` : undefined}
        largura="max-w-lg"
        rodape={detalhe && detalhe.origem === 'hospede' && (
          <>
            {detalhe.situacao === 'pre_reserva' && <Button variant="ghost" loading={confirmar.isPending} onClick={() => confirmar.mutate(detalhe.id)}>Confirmar</Button>}
            {detalhe.situacao === 'confirmada' && <Button variant="ghost" loading={checkin.isPending} onClick={() => checkin.mutate(detalhe.id)}>Check-in</Button>}
            {detalhe.situacao === 'confirmada' && <Button variant="ghost" loading={noShow.isPending} onClick={() => noShow.mutate(detalhe.id)}>No-show</Button>}
            {detalhe.situacao === 'hospedado' && <Button loading={checkout.isPending} onClick={() => checkout.mutate(detalhe.id)}>Check-out</Button>}
            {(detalhe.situacao === 'pre_reserva' || detalhe.situacao === 'confirmada') && (
              <Button variant="ghost" onClick={() => setCancelando(detalhe)}>Cancelar reserva</Button>
            )}
          </>
        )}
      >
        {detalhe && (
          <div className="space-y-4">
            {detalhe.origem === 'bloqueio' ? (
              <p className="rounded-lg bg-surface-2 p-2 text-[13px] text-text-secondary sm:p-4">
                <span aria-hidden>🔧 </span>{detalhe.motivo}. Bloqueio ocupa o calendário como qualquer reserva — é
                por isso que não existe um campo “quarto em manutenção”: haveria duas verdades sobre a mesma noite.
              </p>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-2 sm:gap-4 lg:gap-6">
                  {[
                    ['Hóspede', detalhe.hospede],
                    ['Telefone', detalhe.telefone ?? '—'],
                    ['Pessoas', `${detalhe.adultos} adulto(s)${detalhe.criancas ? ` + ${detalhe.criancas} criança(s)` : ''}`],
                    ['Canal', CANAL[detalhe.canal]],
                  ].map(([k, v]) => (
                    <div key={k as string}>
                      <dt className="text-[12px] text-text-muted">{k}</dt>
                      <dd className="text-[13px] font-medium text-text">{v}</dd>
                    </div>
                  ))}
                </dl>

                <div>
                  <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
                    Diárias — o valor de cada noite, congelado na reserva
                  </p>
                  <table className="w-full text-[13px]">
                    <tbody>
                      {detalhe.diarias.map((d) => (
                        <tr key={d.data} className="border-b border-border/60 last:border-0">
                          <td className="py-1 text-text-secondary">{date(d.data)}</td>
                          <td className="py-1 text-right tabular-nums text-text">{money(d.valor)}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-border">
                        <td className="pt-1.5 font-semibold text-text">{detalhe.diarias.length} noites{detalhe.valorExtras > 0 && ' + extras'}</td>
                        <td className="pt-1.5 text-right font-semibold tabular-nums text-text">{money(detalhe.valorDiarias + detalhe.valorExtras)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {detalhe.checkinReal && (
                  <p className="text-[12px] text-text-muted">
                    Check-in real: {new Date(detalhe.checkinReal).toLocaleString('pt-BR')}
                    {detalhe.checkoutReal && ` · check-out: ${new Date(detalhe.checkoutReal).toLocaleString('pt-BR')}`}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </Modal>

      <ConfirmarAcao
        aberto={cancelando !== null}
        titulo="Cancelar reserva"
        rotuloConfirmar="Cancelar reserva"
        carregando={cancelar.isPending}
        onCancelar={() => setCancelando(null)}
        onConfirmar={() => cancelando && cancelar.mutate(cancelando.id)}
        mensagem={
          <>
            A unidade volta ao mapa <strong className="font-semibold text-text">na hora</strong> — disponibilidade é
            derivada das reservas, não há sinalizador a limpar. Cancelamento com menos de{' '}
            {POLITICA.cancelamentoDias} dias da entrada gera multa de {percent(POLITICA.multaPercentual)} das diárias.
          </>
        }
      />
    </div>
  )
}
