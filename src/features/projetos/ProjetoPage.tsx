import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  apontarHoras, atrasado, avancoFisico, concluirMarco, consumoHoras, custoPrevisto,
  custoRealizado, desvio, horasGastas, margemProjeto, obterApontamentos, obterMarcos,
  obterProjeto, obterReplanejamentos, obterRiscos, replanejar,
} from '@/shared/api/projetos'
import type { Risco } from '@/shared/api/types'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Checkbox, Input } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { Skeleton } from '@/shared/ui/Skeleton'
import { EstruturaProjeto } from './EstruturaProjeto'
import { cn } from '@/shared/lib/cn'
import { date, datetime, money, number, percent } from '@/shared/lib/format'

const ABAS = [
  { id: 'resumo', rotulo: 'Resumo', icone: '📊' },
  { id: 'estrutura', rotulo: 'Estrutura', icone: '🧱' },
  { id: 'cronograma', rotulo: 'Marcos', icone: '📅' },
  { id: 'horas', rotulo: 'Horas', icone: '⏱️' },
  { id: 'riscos', rotulo: 'Riscos', icone: '⚠️' },
  { id: 'replanejamentos', rotulo: 'Replanejamentos', icone: '🔁' },
] as const
type AbaId = (typeof ABAS)[number]['id']

const grauRisco = (r: Risco) => {
  const peso = { baixa: 1, media: 2, alta: 3, baixo: 1, medio: 2, alto: 3 } as Record<string, number>
  return peso[r.probabilidade] * peso[r.impacto]
}

export function ProjetoPage() {
  const { id } = useParams()
  const projetoId = Number(id)
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const aba = (params.get('aba') ?? 'resumo') as AbaId

  const [apontando, setApontando] = useState(false)
  const [replan, setReplan] = useState(false)
  const [horas, setHoras] = useState(4)
  const [atividade, setAtividade] = useState('')
  const [faturavel, setFaturavel] = useState(true)
  const [prazoNovo, setPrazoNovo] = useState('')
  const [horasNovas, setHorasNovas] = useState(0)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const projeto = useQuery({ queryKey: ['projeto', projetoId], queryFn: () => obterProjeto(projetoId) })
  const marcos = useQuery({ queryKey: ['projeto-marcos', projetoId], queryFn: () => obterMarcos(projetoId) })
  const apontamentos = useQuery({ queryKey: ['projeto-horas', projetoId], queryFn: () => obterApontamentos(projetoId) })
  const riscos = useQuery({ queryKey: ['projeto-riscos', projetoId], queryFn: () => obterRiscos(projetoId) })
  const replanejamentos = useQuery({ queryKey: ['projeto-replan', projetoId], queryFn: () => obterReplanejamentos(projetoId) })

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['projeto', projetoId] })
    void qc.invalidateQueries({ queryKey: ['projeto-marcos', projetoId] })
    void qc.invalidateQueries({ queryKey: ['projeto-horas', projetoId] })
    void qc.invalidateQueries({ queryKey: ['projeto-replan', projetoId] })
    void qc.invalidateQueries({ queryKey: ['projetos'] })
    void qc.invalidateQueries({ queryKey: ['projetos-totais'] })
  }

  const marcar = useMutation({ mutationFn: (marcoId: number) => concluirMarco(projetoId, marcoId), onSuccess: invalidar })
  const apontar = useMutation({
    mutationFn: () => apontarHoras(projetoId, { horas, atividade, faturavel }),
    onSuccess: () => { invalidar(); setApontando(false); setAtividade(''); setErro(null) },
    onError: (e: Error) => setErro(e.message),
  })
  const replanejarMut = useMutation({
    mutationFn: () => replanejar(projetoId, { prazoNovo: new Date(`${prazoNovo}T12:00:00`).toISOString(), horasNovas, motivo }),
    onSuccess: () => { invalidar(); setReplan(false); setMotivo(''); setErro(null) },
    onError: (e: Error) => setErro(e.message),
  })

  if (projeto.isError) {
    return <Card><EmptyState icone="🔍" titulo="Projeto não encontrado" acao={<Button variant="secondary" size="sm"><Link to="/projetos">Voltar</Link></Button>} /></Card>
  }

  const p = projeto.data
  const consumo = p ? consumoHoras(p) : 0
  const avanco = p ? avancoFisico(p.id) : 0
  const d = p ? desvio(p) : 0

  return (
    <div className="space-y-4 sm:space-y-5">
      <nav aria-label="Trilha" className="flex items-center gap-1.5 text-[13px] text-text-muted">
        <Link to="/projetos" className="font-medium text-primary hover:underline">Projetos</Link>
        <span aria-hidden>/</span>
        <span className="truncate text-text-secondary">{p?.codigo ?? '…'}</span>
      </nav>

      <Card>
        <CardBody className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-text sm:text-xl">{p?.nome ?? '…'}</h1>
            <p className="mt-1 truncate text-[13px] text-text-muted">
              {p ? <>{p.codigo} · <Link to={`/clientes/${p.clienteId}`} className="text-primary hover:underline">{p.cliente}</Link> · responsável {p.responsavel}</> : '…'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => { setErro(null); setApontando(true) }} disabled={!p}>
              <span aria-hidden>⏱️</span> Apontar horas
            </Button>
            <Button variant="secondary" onClick={() => { if (!p) return; setErro(null); setPrazoNovo(p.prazo.slice(0, 10)); setHorasNovas(p.horasOrcadas); setReplan(true) }} disabled={!p}>
              <span aria-hidden>🔁</span> Replanejar
            </Button>
          </div>
        </CardBody>

        {/* Os dois números que não podem andar separados. */}
        <div className="grid grid-cols-2 gap-px border-t border-border bg-border lg:grid-cols-5">
          {[
            { rotulo: 'Horas consumidas', valor: p ? `${percent(consumo)} · ${number(horasGastas(p.id))}h` : null, destaque: consumo > 1 ? 'text-critical' : undefined },
            { rotulo: 'Escopo entregue', valor: p ? percent(avanco) : null, destaque: 'text-good' },
            { rotulo: 'Desvio', valor: p ? `${d >= 0 ? '+' : ''}${percent(d)}` : null, destaque: d > 0.2 ? 'text-critical' : d > 0.05 ? 'text-warning' : 'text-good' },
            { rotulo: 'Prazo', valor: p ? date(p.prazo) : null, destaque: p && atrasado(p) ? 'text-critical' : undefined },
            { rotulo: 'Margem', valor: p ? percent(margemProjeto(p)) : null, destaque: p && margemProjeto(p) < 0.2 ? 'text-warning' : 'text-good' },
          ].map((c) => (
            <div key={c.rotulo} className="bg-surface px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-text-muted">{c.rotulo}</p>
              {c.valor === null ? <Skeleton className="mt-1.5 h-5 w-20" /> : (
                <p className={cn('mt-0.5 text-[13px] font-semibold tabular-nums', c.destaque ?? 'text-text')}>{c.valor}</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {p && d > 0.2 && (
        <p className="flex items-start gap-2 rounded-lg border border-critical/40 bg-critical/10 px-4 py-3 text-[13px] text-text-secondary">
          <span aria-hidden>📉</span>
          <span>
            <strong className="text-critical">Consumo {percent(consumo)} contra {percent(avanco)} entregue.</strong> A
            diferença é o desvio: no ritmo atual, terminar o escopo custa cerca de{' '}
            <strong className="text-text">{number(Math.round(horasGastas(p.id) / Math.max(avanco, 0.05)))}h</strong> —
            contra as {number(p.horasOrcadas)}h orçadas.
          </span>
        </p>
      )}

      <div role="tablist" aria-label="Seções do projeto" className="flex flex-wrap items-center gap-1 border-b border-border">
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
              <span aria-hidden>{item.icone}</span>{item.rotulo}
            </button>
          )
        })}
      </div>

      {aba === 'resumo' && p && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader titulo="Financeiro do projeto" descricao="Contrato, custo realizado e o que sobra" />
            <CardBody>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ['Valor do contrato', money(p.valorContrato)],
                  ['Custo previsto', money(custoPrevisto(p))],
                  ['Custo realizado', money(custoRealizado(p))],
                  ['Resultado', money(p.valorContrato - custoRealizado(p))],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo}>
                    <dt className="text-[11px] uppercase tracking-wide text-text-muted">{rotulo}</dt>
                    <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-text">{valor}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 border-t border-border pt-3 text-[12px] text-text-muted">
                Custo = horas apontadas × {money(p.custoHora)}/h + {money(p.despesas)} de despesas. O custo/hora fica
                <strong className="text-text-secondary"> copiado no projeto</strong>: aumento de salário no ano que vem não
                reescreve a margem do projeto do ano passado.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader titulo="Linha de base" descricao="O que foi prometido no começo" />
            <CardBody className="space-y-3 text-[13px] text-text-secondary">
              <div className="flex items-baseline justify-between">
                <span>Prazo original</span>
                <span className="font-medium tabular-nums text-text">{date(p.prazoBaseline)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span>Prazo atual</span>
                <span className={cn('font-medium tabular-nums', p.prazo !== p.prazoBaseline ? 'text-warning' : 'text-text')}>{date(p.prazo)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span>Horas originais</span>
                <span className="font-medium tabular-nums text-text">{number(p.horasBaseline)}h</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span>Horas atuais</span>
                <span className={cn('font-medium tabular-nums', p.horasOrcadas !== p.horasBaseline ? 'text-warning' : 'text-text')}>{number(p.horasOrcadas)}h</span>
              </div>
              <p className="border-t border-border pt-2 text-[12px] text-text-muted">
                O desvio é medido contra a <strong className="text-text-secondary">linha de base</strong>, não contra o
                último replanejamento — senão o projeto que estourou três vezes aparece sempre "no prazo".
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      {aba === 'estrutura' && p && <EstruturaProjeto projeto={p} />}

      {aba === 'cronograma' && (
        <Card>
          <CardHeader titulo="Marcos" descricao="O avanço físico sai daqui: peso do marco concluído, não horas gastas" />
          <ul className="divide-y divide-border">
            {marcos.data?.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <input
                  type="checkbox"
                  checked={m.concluido}
                  onChange={() => marcar.mutate(m.id)}
                  aria-label={m.nome}
                  className="h-4 w-4 cursor-pointer rounded border-border-strong accent-[rgb(var(--primary))]"
                />
                <div className="min-w-0 flex-1">
                  <p className={cn('text-[13px]', m.concluido ? 'text-text-muted line-through' : 'font-medium text-text')}>{m.nome}</p>
                  <p className="text-[12px] text-text-muted">
                    previsto {date(m.previsto)}
                    {m.previsto !== m.previstoBaseline && ` · baseline ${date(m.previstoBaseline)}`}
                    {m.entregue && ` · entregue ${date(m.entregue)}`}
                  </p>
                </div>
                <Badge tom="neutro">{m.peso}% do escopo</Badge>
                {!m.concluido && new Date(m.previsto) < new Date() && <Badge tom="critical">Atrasado</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {aba === 'horas' && (
        <Card>
          <CardHeader
            titulo="Apontamentos"
            descricao={p ? `${number(horasGastas(p.id))}h de ${number(p.horasOrcadas)}h orçadas` : undefined}
            acoes={<Button size="sm" onClick={() => { setErro(null); setApontando(true) }}>⏱️ Apontar</Button>}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[38rem] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-2.5 text-left font-semibold">Data</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Pessoa</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Atividade</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Horas</th>
                </tr>
              </thead>
              <tbody>
                {apontamentos.data?.slice(0, 25).map((a) => (
                  <tr key={a.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2">
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-text-secondary">{date(a.data)}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <Avatar nome={a.pessoa} size="sm" />
                        <span className="text-text-secondary">{a.pessoa}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="text-text">{a.atividade}</span>
                        {!a.faturavel && <Badge tom="neutro">não faturável</Badge>}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums text-text">{a.horas}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {aba === 'riscos' && (
        <Card>
          <CardHeader titulo="Riscos" descricao="Probabilidade × impacto, com a mitigação combinada" />
          {riscos.data?.length ? (
            <ul className="divide-y divide-border">
              {[...riscos.data].sort((a, b) => grauRisco(b) - grauRisco(a)).map((r) => {
                const grau = grauRisco(r)
                return (
                  <li key={r.id} className="flex flex-wrap items-start gap-3 px-4 py-3.5 sm:px-5">
                    <Badge tom={grau >= 6 ? 'critical' : grau >= 4 ? 'warning' : 'neutro'}>
                      {r.probabilidade}/{r.impacto}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-[13px] font-medium', r.aberto ? 'text-text' : 'text-text-muted line-through')}>{r.descricao}</p>
                      <p className="text-[12px] text-text-muted">Mitigação: {r.mitigacao}</p>
                    </div>
                    <Badge tom={r.aberto ? 'warning' : 'good'}>{r.aberto ? 'Aberto' : 'Encerrado'}</Badge>
                  </li>
                )
              })}
            </ul>
          ) : <EmptyState icone="⚠️" titulo="Nenhum risco registrado" descricao="Projeto sem risco mapeado costuma ser projeto com risco não olhado." />}
        </Card>
      )}

      {aba === 'replanejamentos' && (
        <Card>
          <CardHeader titulo="Replanejamentos" descricao="Cada mudança de prazo ou orçamento fica registrada, com o antes e o depois" />
          {replanejamentos.data?.length ? (
            <ol className="divide-y divide-border">
              {replanejamentos.data.map((r) => (
                <li key={r.id} className="px-4 py-3.5 sm:px-5">
                  <p className="text-[13px] font-medium text-text">{r.motivo}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px]">
                    <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-text-muted line-through">{date(r.prazoAnterior)} · {number(r.horasAnteriores)}h</span>
                    <span aria-hidden className="text-text-muted">→</span>
                    <span className="rounded bg-warning/15 px-1.5 py-0.5 font-mono text-text-secondary">{date(r.prazoNovo)} · {number(r.horasNovas)}h</span>
                  </p>
                  <p className="mt-1 text-[11px] tabular-nums text-text-muted">{r.autor} · {datetime(r.criadoEm)}</p>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              icone="🔁"
              titulo="Nenhum replanejamento"
              descricao="O projeto segue a linha de base original. Replanejar não é fracasso — esconder o replanejamento é."
            />
          )}
        </Card>
      )}

      <Modal
        aberto={apontando}
        titulo="Apontar horas"
        onFechar={apontar.isPending ? () => {} : () => setApontando(false)}
        rodape={
          <>
            <Button variant="ghost" onClick={() => setApontando(false)} disabled={apontar.isPending}>Cancelar</Button>
            <Button loading={apontar.isPending} onClick={() => apontar.mutate()}>Apontar</Button>
          </>
        }
      >
        <div className="space-y-4">
          {erro && <p role="alert" className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2.5 text-[13px] text-critical">⚠️ {erro}</p>}
          <Input label="Horas" type="number" step="0.5" min={0.5} max={24} data-foco-inicial value={horas} onChange={(e) => setHoras(Number(e.target.value))} />
          <Input label="Atividade" placeholder="Ex.: ajuste na integração de pagamentos" value={atividade} onChange={(e) => setAtividade(e.target.value)} />
          <Checkbox label="Hora faturável ao cliente" checked={faturavel} onChange={(e) => setFaturavel(e.target.checked)} />
        </div>
      </Modal>

      <Modal
        aberto={replan}
        titulo="Replanejar projeto"
        descricao="A linha de base original não muda — é contra ela que o desvio é medido."
        onFechar={replanejarMut.isPending ? () => {} : () => setReplan(false)}
        rodape={
          <>
            <Button variant="ghost" onClick={() => setReplan(false)} disabled={replanejarMut.isPending}>Cancelar</Button>
            <Button loading={replanejarMut.isPending} onClick={() => replanejarMut.mutate()}>Registrar replanejamento</Button>
          </>
        }
      >
        <div className="space-y-4">
          {erro && <p role="alert" className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2.5 text-[13px] text-critical">⚠️ {erro}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Novo prazo" type="date" data-foco-inicial value={prazoNovo} onChange={(e) => setPrazoNovo(e.target.value)} />
            <Input label="Novas horas orçadas" type="number" min={1} value={horasNovas} onChange={(e) => setHorasNovas(Number(e.target.value))} />
          </div>
          <Input
            label="Motivo"
            placeholder="Ex.: escopo ampliado com o módulo fiscal, acordado em ata de 12/08"
            hint="É o que explica o desvio quando alguém perguntar seis meses depois."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          {p && (
            <dl className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface-2 p-3 text-center">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-text-muted">Linha de base</dt>
                <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-text">{date(p.prazoBaseline)} · {number(p.horasBaseline)}h</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-text-muted">Passa a valer</dt>
                <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-text">
                  {prazoNovo ? date(`${prazoNovo}T12:00:00`) : '—'} · {number(horasNovas)}h
                </dd>
              </div>
            </dl>
          )}
        </div>
      </Modal>
    </div>
  )
}
