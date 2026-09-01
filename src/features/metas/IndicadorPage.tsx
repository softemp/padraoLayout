import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  atingimento, esperadoAteAgora, farol, listarIndicadores, listarRevisoes, projecaoFimDoPeriodo,
  revisarMeta, ritmo, rotuloDirecao,
} from '@/shared/api/indicadores'
import { ChartTooltip } from '@/shared/charts/ChartTooltip'
import { eixoBase, useChartTokens } from '@/shared/charts/tokens'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { datetime, percent } from '@/shared/lib/format'
import { formatarValor } from './MetasPage'

export function IndicadorPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const t = useChartTokens()

  const [revisando, setRevisando] = useState(false)
  const [novaMeta, setNovaMeta] = useState(0)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['indicadores'], queryFn: listarIndicadores })
  const indicador = data?.find((i) => i.id === id)
  const contrapeso = data?.find((i) => i.id === indicador?.contrapesoId)

  const revisoes = useQuery({ queryKey: ['indicador-revisoes', id], queryFn: () => listarRevisoes(id!), enabled: !!id })

  const revisar = useMutation({
    mutationFn: () => revisarMeta(id!, novaMeta, motivo, indicador!.meta),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['indicador-revisoes', id] })
      setRevisando(false); setMotivo(''); setErro(null)
    },
    onError: (e: Error) => setErro(e.message),
  })

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-56" /><Skeleton className="h-64 w-full rounded-xl" /></div>
  if (!indicador) {
    return <Card><EmptyState icone="🔍" titulo="Indicador não encontrado" acao={<Button variant="secondary" size="sm"><Link to="/metas">Voltar</Link></Button>} /></Card>
  }

  const f = farol(indicador)
  const r = ritmo(indicador)
  const maiorMelhor = indicador.direcao === 'maior_melhor'
  const serie = indicador.serie.map((p) => ({ ...p, meta: indicador.meta }))

  return (
    <div className="space-y-4 sm:space-y-5">
      <nav aria-label="Trilha" className="flex items-center gap-1.5 text-[13px] text-text-muted">
        <Link to="/metas" className="font-medium text-primary hover:underline">Metas e indicadores</Link>
        <span aria-hidden>/</span>
        <span className="truncate text-text-secondary">{indicador.nome}</span>
      </nav>

      <PageHeader
        titulo={indicador.nome}
        descricao={indicador.descricao}
        acoes={
          <>
            {indicador.rotaFonte && (
              <Button variant="secondary"><Link to={indicador.rotaFonte}>Ver a origem do número</Link></Button>
            )}
            <Button onClick={() => { setErro(null); setNovaMeta(indicador.meta); setRevisando(true) }}>Revisar meta</Button>
          </>
        }
      />

      <Card>
        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-5">
          {[
            { rotulo: 'Atual', valor: formatarValor(indicador, indicador.atual), destaque: f === 'verde' ? 'text-good' : f === 'amarelo' ? 'text-warning' : 'text-critical' },
            { rotulo: 'Meta', valor: formatarValor(indicador, indicador.meta) },
            { rotulo: 'Esperado até hoje', valor: maiorMelhor ? formatarValor(indicador, esperadoAteAgora(indicador)) : '—', nota: `${percent(indicador.decorrido)} do período` },
            { rotulo: 'Ritmo', valor: percent(r), destaque: r >= 0.95 ? 'text-good' : r >= 0.8 ? 'text-warning' : 'text-critical' },
            { rotulo: 'Projeção do período', valor: maiorMelhor ? formatarValor(indicador, projecaoFimDoPeriodo(indicador)) : '—' },
          ].map((c) => (
            <div key={c.rotulo} className="bg-surface px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-text-muted">{c.rotulo}</p>
              <p className={cn('mt-0.5 text-[15px] font-semibold tabular-nums', c.destaque ?? 'text-text')}>{c.valor}</p>
              {c.nota && <p className="text-[11px] text-text-muted">{c.nota}</p>}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader titulo="Histórico" descricao="Últimos períodos contra a meta atual" />
          <CardBody>
            <div className="h-56 w-full sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={serie} margin={{ top: 16, right: 16, bottom: 4, left: 4 }}>
                  <defs>
                    <linearGradient id="grad-ind" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={t.serie[0]} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={t.serie[0]} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={t.grid} strokeWidth={1} vertical={false} />
                  <XAxis dataKey="rotulo" {...eixoBase(t.textoMuted)} dy={6} />
                  <YAxis {...eixoBase(t.textoMuted)} width={64} tickFormatter={(v: number) => formatarValor(indicador, v)} />
                  <Tooltip cursor={{ stroke: t.grid, strokeWidth: 1 }} content={<ChartTooltip formatar={(v) => formatarValor(indicador, v)} />} />
                  <ReferenceLine y={indicador.meta} stroke={t.serieMuted} strokeWidth={2} />
                  <Area
                    type="monotone" dataKey="valor" name={indicador.nome}
                    stroke={t.serie[0]} strokeWidth={2} fill="url(#grad-ind)"
                    isAnimationActive={false} dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: t.superficie }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-[12px] text-text-muted">
              A linha cinza é a meta atual. {rotuloDirecao(indicador.direcao)} — o farol respeita essa direção, senão
              um indicador que piora aparece verde.
            </p>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader titulo="De onde vem o número" />
            <CardBody className="space-y-2 text-[13px] text-text-secondary">
              <p><strong className="text-text">{indicador.fonte}</strong></p>
              <p>Responsável: <strong className="text-text">{indicador.responsavel}</strong> · período {indicador.periodo}.</p>
              {indicador.rotaFonte && (
                <Button variant="secondary" size="sm" block><Link to={indicador.rotaFonte}>Abrir a tela de origem</Link></Button>
              )}
              <p className="border-t border-border pt-2 text-[12px] text-text-muted">
                Indicador digitado à mão fica verde por três meses porque alguém esqueceu de atualizar. Este é
                calculado na leitura, a partir do módulo — e por isso não tem como estar velho.
              </p>
            </CardBody>
          </Card>

          {contrapeso && (
            <Card>
              <CardHeader titulo="Contrapeso" descricao="O par que impede o jogo" />
              <CardBody className="space-y-2">
                <Link to={`/metas/${contrapeso.id}`} className="block rounded-lg border border-border p-3 transition-colors hover:bg-surface-2">
                  <p className="text-[13px] font-semibold text-text">{contrapeso.nome}</p>
                  <p className="mt-0.5 text-[13px] tabular-nums text-text-secondary">
                    {formatarValor(contrapeso, contrapeso.atual)} · meta {formatarValor(contrapeso, contrapeso.meta)}
                  </p>
                  <span className="mt-1.5 inline-block"><Badge tom={farol(contrapeso) === 'verde' ? 'good' : farol(contrapeso) === 'amarelo' ? 'warning' : 'critical'}>{percent(atingimento(contrapeso))}</Badge></span>
                </Link>
                <p className="text-[12px] text-text-muted">
                  Melhorar <strong className="text-text-secondary">{indicador.nome}</strong> às custas de{' '}
                  <strong className="text-text-secondary">{contrapeso.nome}</strong> não é melhorar — é empurrar o
                  problema para o outro número.
                </p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardHeader titulo="Revisões da meta" descricao="Mudar a meta é legítimo; mudar sem deixar rastro, não" />
        {revisoes.data?.length ? (
          <ol className="divide-y divide-border">
            {revisoes.data.map((r) => (
              <li key={r.id} className="px-4 py-3 sm:px-5">
                <p className="text-[13px] font-medium text-text">{r.motivo}</p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px]">
                  <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-text-muted line-through">{formatarValor(indicador, r.de)}</span>
                  <span aria-hidden className="text-text-muted">→</span>
                  <span className="rounded bg-warning/15 px-1.5 py-0.5 font-mono text-text-secondary">{formatarValor(indicador, r.para)}</span>
                </p>
                <p className="mt-1 text-[11px] tabular-nums text-text-muted">{r.autor} · {datetime(r.criadoEm)}</p>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState
            icone="🎯"
            titulo="Meta original, nunca revisada"
            descricao="Meta que se ajusta ao realizado sem deixar rastro é meta sempre batida — e um painel que só confirma o que já aconteceu."
          />
        )}
      </Card>

      <Modal
        aberto={revisando}
        titulo="Revisar meta"
        descricao="O antes e o depois ficam registrados, com o motivo."
        onFechar={revisar.isPending ? () => {} : () => setRevisando(false)}
        rodape={
          <>
            <Button variant="ghost" onClick={() => setRevisando(false)} disabled={revisar.isPending}>Cancelar</Button>
            <Button loading={revisar.isPending} onClick={() => revisar.mutate()}>Registrar revisão</Button>
          </>
        }
      >
        <div className="space-y-4">
          {erro && <p role="alert" className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2.5 text-[13px] text-critical">⚠️ {erro}</p>}
          <Input
            label={`Nova meta (${indicador.formato === 'percentual' ? 'fração, ex.: 0.28' : indicador.formato})`}
            type="number"
            step="any"
            data-foco-inicial
            value={novaMeta}
            onChange={(e) => setNovaMeta(Number(e.target.value))}
          />
          <Input
            label="Motivo"
            placeholder="Ex.: escopo do time mudou com a saída de dois vendedores"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <dl className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface-2 p-3 text-center">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-text-muted">Meta atual</dt>
              <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-text">{formatarValor(indicador, indicador.meta)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-text-muted">Passa a ser</dt>
              <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-text">{formatarValor(indicador, novaMeta)}</dd>
            </div>
          </dl>
        </div>
      </Modal>
    </div>
  )
}
