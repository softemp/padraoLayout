import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  alternarTarefaProjeto, atribuirTarefa, avancoPorTarefas, capacidadeEquipe, criarFase,
  criarTarefaProjeto, equipeDisponivel, horasPlanejadas, obterFases, obterTarefasProjeto,
  ocupacao, pesoFase,
} from '@/shared/api/projetos'
import type { Projeto } from '@/shared/api/types'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input, Select } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { date, number, percent } from '@/shared/lib/format'

/**
 * A estrutura do projeto: fases → tarefas, com estimativa e prazo. Três coisas
 * que a tela precisa mostrar e quase nunca mostra:
 *  · a SOMA das tarefas contra as horas orçadas (se não bate, um é ficção);
 *  · o peso de cada fase DERIVADO das horas, não digitado;
 *  · a ocupação de cada pessoa contra a capacidade dela no período.
 */
export function EstruturaProjeto({ projeto }: { projeto: Projeto }) {
  const qc = useQueryClient()
  const [faseAberta, setFaseAberta] = useState(false)
  const [tarefaAberta, setTarefaAberta] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const [nomeFase, setNomeFase] = useState('')
  const [inicioFase, setInicioFase] = useState('')
  const [fimFase, setFimFase] = useState('')

  const [nomeTarefa, setNomeTarefa] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [horasEstimadas, setHorasEstimadas] = useState(8)
  const [inicioTarefa, setInicioTarefa] = useState('')
  const [fimTarefa, setFimTarefa] = useState('')

  const fases = useQuery({ queryKey: ['projeto-fases', projeto.id], queryFn: () => obterFases(projeto.id) })
  const tarefas = useQuery({ queryKey: ['projeto-tarefas', projeto.id], queryFn: () => obterTarefasProjeto(projeto.id) })
  const capacidade = useQuery({ queryKey: ['projeto-capacidade', projeto.id], queryFn: () => capacidadeEquipe(projeto.id) })

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['projeto-fases', projeto.id] })
    void qc.invalidateQueries({ queryKey: ['projeto-tarefas', projeto.id] })
    void qc.invalidateQueries({ queryKey: ['projeto-capacidade', projeto.id] })
    void qc.invalidateQueries({ queryKey: ['projetos'] })
  }

  const novaFase = useMutation({
    mutationFn: () => criarFase(projeto.id, nomeFase, new Date(`${inicioFase}T12:00:00`).toISOString(), new Date(`${fimFase}T12:00:00`).toISOString()),
    onSuccess: () => { invalidar(); setFaseAberta(false); setNomeFase(''); setErro(null) },
    onError: (e: Error) => setErro(e.message),
  })

  const novaTarefa = useMutation({
    mutationFn: () =>
      criarTarefaProjeto(projeto.id, {
        faseId: tarefaAberta!,
        nome: nomeTarefa,
        responsavel: responsavel || null,
        horasEstimadas,
        inicioPrevisto: new Date(`${inicioTarefa}T12:00:00`).toISOString(),
        fimPrevisto: new Date(`${fimTarefa}T12:00:00`).toISOString(),
      }),
    onSuccess: () => { invalidar(); setTarefaAberta(null); setNomeTarefa(''); setErro(null) },
    onError: (e: Error) => setErro(e.message),
  })

  const alternar = useMutation({ mutationFn: (id: number) => alternarTarefaProjeto(projeto.id, id), onSuccess: invalidar })
  const atribuir = useMutation({
    mutationFn: ({ id, pessoa }: { id: number; pessoa: string | null }) => atribuirTarefa(projeto.id, id, pessoa),
    onSuccess: invalidar,
  })

  const planejadas = horasPlanejadas(projeto.id)
  const diferenca = planejadas - projeto.horasOrcadas
  const avanco = avancoPorTarefas(projeto.id)

  return (
    <div className="space-y-4">
      {/* O confronto que quase nenhuma ferramenta faz. */}
      <Card className={cn(Math.abs(diferenca) / Math.max(projeto.horasOrcadas, 1) > 0.1 && 'border-warning/40')}>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { rotulo: 'Horas orçadas', valor: `${number(projeto.horasOrcadas)}h` },
              { rotulo: 'Planejado nas tarefas', valor: `${number(planejadas)}h` },
              { rotulo: 'Diferença', valor: `${diferenca >= 0 ? '+' : ''}${number(diferenca)}h`, destaque: Math.abs(diferenca) / Math.max(projeto.horasOrcadas, 1) > 0.1 ? (diferenca > 0 ? 'text-critical' : 'text-warning') : 'text-good' },
              { rotulo: 'Escopo concluído', valor: percent(avanco), destaque: 'text-good' },
            ].map((c) => (
              <div key={c.rotulo}>
                <p className="text-[11px] uppercase tracking-wide text-text-muted">{c.rotulo}</p>
                <p className={cn('mt-0.5 text-[15px] font-semibold tabular-nums', c.destaque ?? 'text-text')}>{c.valor}</p>
              </div>
            ))}
          </div>
          <Button size="sm" onClick={() => { setErro(null); setInicioFase(projeto.inicio.slice(0, 10)); setFimFase(projeto.prazo.slice(0, 10)); setFaseAberta(true) }}>
            ＋ Nova fase
          </Button>
        </CardBody>
        {Math.abs(diferenca) / Math.max(projeto.horasOrcadas, 1) > 0.1 && (
          <p className="border-t border-border px-4 py-3 text-[12px] text-text-secondary">
            <strong className="text-text">O plano e o orçamento discordam em {number(Math.abs(diferenca))}h.</strong>{' '}
            {diferenca > 0
              ? 'As tarefas somam mais do que foi vendido — ou o escopo cresceu, ou a proposta subestimou. Replanejar agora é barato; descobrir no fim, não.'
              : 'As tarefas somam menos do que foi orçado — plano incompleto ou folga não declarada. Folga escondida some no primeiro imprevisto.'}
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {fases.isLoading && <Skeleton className="h-64 w-full rounded-xl" />}

          {!fases.isLoading && fases.data?.length === 0 && (
            <Card>
              <EmptyState
                icone="🧱"
                titulo="Projeto sem fases"
                descricao="Comece pela estrutura: fases dão o esqueleto do cronograma, e as tarefas dentro delas é que viram estimativa."
                acao={<Button size="sm" onClick={() => { setInicioFase(projeto.inicio.slice(0, 10)); setFimFase(projeto.prazo.slice(0, 10)); setFaseAberta(true) }}>Criar a primeira fase</Button>}
              />
            </Card>
          )}

          {fases.data?.map((fase) => {
            const daFase = tarefas.data?.filter((t) => t.faseId === fase.id) ?? []
            const horas = daFase.reduce((s, t) => s + t.horasEstimadas, 0)
            const feitas = daFase.filter((t) => t.concluida).length
            const peso = pesoFase(projeto.id, fase.id)

            return (
              <Card key={fase.id}>
                <CardHeader
                  titulo={`${fase.ordem}. ${fase.nome}`}
                  descricao={`${date(fase.inicioPrevisto)} → ${date(fase.fimPrevisto)} · ${number(horas)}h estimadas · ${feitas}/${daFase.length} tarefas`}
                  acoes={
                    <>
                      {/* Peso derivado das horas — não digitado. */}
                      <Badge tom="neutro">{percent(peso)} do escopo</Badge>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setErro(null); setNomeTarefa(''); setResponsavel(''); setHorasEstimadas(8)
                          setInicioTarefa(fase.inicioPrevisto.slice(0, 10)); setFimTarefa(fase.fimPrevisto.slice(0, 10))
                          setTarefaAberta(fase.id)
                        }}
                      >
                        ＋ Tarefa
                      </Button>
                    </>
                  }
                />
                {daFase.length ? (
                  <ul className="divide-y divide-border">
                    {daFase.map((t) => {
                      const estourou = t.horasApontadas > t.horasEstimadas
                      const atrasada = !t.concluida && new Date(t.fimPrevisto) < new Date()
                      return (
                        <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 sm:px-5">
                          <input
                            type="checkbox"
                            checked={t.concluida}
                            onChange={() => alternar.mutate(t.id)}
                            aria-label={t.nome}
                            className="h-4 w-4 cursor-pointer rounded border-border-strong accent-[rgb(var(--primary))]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className={cn('text-[13px]', t.concluida ? 'text-text-muted line-through' : 'font-medium text-text')}>{t.nome}</p>
                            <p className="text-[11px] text-text-muted">
                              {date(t.inicioPrevisto)} → {date(t.fimPrevisto)} · {number(t.horasEstimadas)}h estimadas
                              {t.horasApontadas > 0 && ` · ${number(t.horasApontadas)}h apontadas`}
                            </p>
                          </div>
                          {estourou && <Badge tom="warning">estourou a estimativa</Badge>}
                          {atrasada && <Badge tom="critical">atrasada</Badge>}
                          {/* Atribuir sem sair da lista: alocar é a operação
                              mais frequente do planejamento. */}
                          <label className="w-40">
                            <span className="sr-only">Responsável por {t.nome}</span>
                            <select
                              value={t.responsavel ?? ''}
                              onChange={(e) => atribuir.mutate({ id: t.id, pessoa: e.target.value || null })}
                              className={cn(
                                'h-8 w-full rounded-md border bg-surface px-2 text-[12px] text-text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25',
                                t.responsavel ? 'border-border' : 'border-warning/50',
                              )}
                            >
                              <option value="">sem responsável</option>
                              {equipeDisponivel.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="px-4 py-4 text-center text-[12px] text-text-muted sm:px-5">
                    Fase sem tarefas — ela não conta no escopo enquanto não tiver estimativa.
                  </p>
                )}
              </Card>
            )
          })}
        </div>

        <Card className="h-fit">
          <CardHeader
            titulo="Alocação × capacidade"
            descricao="Horas atribuídas contra o que a pessoa tem no período do projeto"
          />
          <ul className="divide-y divide-border">
            {capacidade.data?.map((c) => {
              const uso = ocupacao(c)
              const sobrecarga = uso > 1
              return (
                <li key={c.pessoa} className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    {c.pessoa.startsWith('—') ? (
                      <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-warning/15 text-[12px]">?</span>
                    ) : (
                      <Avatar nome={c.pessoa} size="sm" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">{c.pessoa}</span>
                    <span className={cn('text-[13px] font-semibold tabular-nums', sobrecarga ? 'text-critical' : uso > 0.85 ? 'text-warning' : 'text-good')}>
                      {percent(uso)}
                    </span>
                  </div>
                  <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                    <span
                      className={cn('block h-full rounded-full', sobrecarga ? 'bg-critical' : uso > 0.85 ? 'bg-warning' : 'bg-primary')}
                      style={{ width: `${Math.min(uso, 1) * 100}%` }}
                    />
                  </span>
                  <p className="mt-1 text-[11px] text-text-muted">
                    {number(c.horasAlocadas)}h alocadas · {number(c.capacidadeTotal)}h disponíveis
                    ({c.capacidadeDiaria}h/dia × {number(c.diasUteisNoPeriodo)} dias úteis)
                  </p>
                </li>
              )
            })}
          </ul>
          <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted">
            A capacidade considera <strong className="text-text-secondary">{6}h por dia útil</strong>, não 8: reunião,
            suporte e imprevisto comem o resto. Alocar acima de 100% não é otimismo — é atraso já contratado, que só
            aparece quando a data chega.
          </p>
        </Card>
      </div>

      <Modal
        aberto={faseAberta}
        titulo="Nova fase"
        descricao="A fase precisa caber dentro do prazo do projeto."
        onFechar={novaFase.isPending ? () => {} : () => setFaseAberta(false)}
        rodape={
          <>
            <Button variant="ghost" onClick={() => setFaseAberta(false)} disabled={novaFase.isPending}>Cancelar</Button>
            <Button loading={novaFase.isPending} onClick={() => novaFase.mutate()}>Criar fase</Button>
          </>
        }
      >
        <div className="space-y-4">
          {erro && <p role="alert" className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2.5 text-[13px] text-critical">⚠️ {erro}</p>}
          <Input label="Nome da fase" data-foco-inicial placeholder="Ex.: Homologação" value={nomeFase} onChange={(e) => setNomeFase(e.target.value)} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Início previsto" type="date" value={inicioFase} onChange={(e) => setInicioFase(e.target.value)} />
            <Input label="Fim previsto" type="date" hint={`Projeto termina em ${date(projeto.prazo)}`} value={fimFase} onChange={(e) => setFimFase(e.target.value)} />
          </div>
        </div>
      </Modal>

      <Modal
        aberto={tarefaAberta !== null}
        titulo="Nova tarefa"
        descricao="Estimativa e prazo entram aqui — é a soma delas que vira o plano."
        onFechar={novaTarefa.isPending ? () => {} : () => setTarefaAberta(null)}
        largura="max-w-xl"
        rodape={
          <>
            <Button variant="ghost" onClick={() => setTarefaAberta(null)} disabled={novaTarefa.isPending}>Cancelar</Button>
            <Button loading={novaTarefa.isPending} onClick={() => novaTarefa.mutate()}>Criar tarefa</Button>
          </>
        }
      >
        <div className="space-y-4">
          {erro && <p role="alert" className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2.5 text-[13px] text-critical">⚠️ {erro}</p>}
          <Input label="O que precisa ser feito" data-foco-inicial value={nomeTarefa} onChange={(e) => setNomeTarefa(e.target.value)} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Responsável" hint="Tarefa sem responsável não é feita, é reencontrada." value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
              <option value="">Definir depois</option>
              {equipeDisponivel.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
            <Input label="Horas estimadas" type="number" min={1} value={horasEstimadas} onChange={(e) => setHorasEstimadas(Number(e.target.value))} />
            <Input label="Início previsto" type="date" value={inicioTarefa} onChange={(e) => setInicioTarefa(e.target.value)} />
            <Input label="Fim previsto" type="date" value={fimTarefa} onChange={(e) => setFimTarefa(e.target.value)} />
          </div>
          {responsavel && (
            <p className="rounded-md bg-surface-2 px-3 py-2 text-[12px] text-text-secondary">
              {(() => {
                const c = capacidade.data?.find((x) => x.pessoa === responsavel)
                if (!c) return `${responsavel} ainda não tem tarefas neste projeto.`
                const nova = (c.horasAlocadas + horasEstimadas) / Math.max(c.capacidadeTotal, 1)
                return `Com esta tarefa, ${responsavel} fica com ${percent(nova)} da capacidade no período${nova > 1 ? ' — acima do que cabe.' : '.'}`
              })()}
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}
