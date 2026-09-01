import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { alternarChecklist, comentar, listarComentarios, moverTarefa, SITUACOES } from '@/shared/api/tarefas'
import type { SituacaoTarefa, Tarefa } from '@/shared/api/types'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { date, timeAgo } from '@/shared/lib/format'
import { estaAtrasada } from '@/shared/api/tarefas'

export function TarefaModal({ tarefa, onFechar }: { tarefa: Tarefa | null; onFechar: () => void }) {
  const qc = useQueryClient()
  const [texto, setTexto] = useState('')

  const comentarios = useQuery({
    queryKey: ['tarefa-comentarios', tarefa?.id],
    queryFn: () => listarComentarios(tarefa!.id),
    enabled: !!tarefa,
  })

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['tarefas'] })
    void qc.invalidateQueries({ queryKey: ['tarefas-quadro'] })
    void qc.invalidateQueries({ queryKey: ['tarefas-totais'] })
  }

  const mover = useMutation({
    mutationFn: (situacao: SituacaoTarefa) => moverTarefa(tarefa!.id, situacao, true),
    onSuccess: () => { invalidar(); onFechar() },
  })
  const checar = useMutation({
    mutationFn: (itemId: number) => alternarChecklist(tarefa!.id, itemId),
    onSuccess: invalidar,
  })
  const enviar = useMutation({
    mutationFn: (t: string) => comentar(tarefa!.id, t),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tarefa-comentarios', tarefa?.id] })
      invalidar()
      setTexto('')
    },
  })

  const feitos = tarefa?.checklist.filter((c) => c.feito).length ?? 0

  return (
    <Modal
      aberto={!!tarefa}
      titulo={tarefa?.titulo ?? ''}
      descricao={tarefa ? `Criada por ${tarefa.criadoPor} · ${timeAgo(tarefa.criadoEm)}` : undefined}
      largura="max-w-2xl"
      onFechar={onFechar}
      rodape={
        tarefa?.situacao === 'concluida' ? (
          <Button variant="secondary" loading={mover.isPending} onClick={() => mover.mutate('a_fazer')}>
            Reabrir tarefa
          </Button>
        ) : (
          <Button loading={mover.isPending} onClick={() => mover.mutate('concluida')} data-foco-inicial>
            Concluir tarefa
          </Button>
        )
      }
    >
      {tarefa && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tom={tarefa.situacao === 'concluida' ? 'good' : 'info'}>
              {SITUACOES.find((s) => s.id === tarefa.situacao)?.rotulo ?? tarefa.situacao}
            </Badge>
            <Badge tom={tarefa.prioridade === 'urgente' ? 'critical' : tarefa.prioridade === 'alta' ? 'warning' : 'neutro'}>
              {tarefa.prioridade}
            </Badge>
            {estaAtrasada(tarefa) && <Badge tom="critical">Atrasada</Badge>}
            {tarefa.etiquetas.map((e) => <Badge key={e} tom="neutro">{e}</Badge>)}
          </div>

          <p className="text-[13px] leading-relaxed text-text-secondary">{tarefa.descricao}</p>

          <dl className="grid grid-cols-2 rounded-lg border border-border bg-surface-2 p-2 sm:p-4 sm:grid-cols-4 gap-2 sm:gap-4 lg:gap-6">
            {[
              ['Responsável', tarefa.responsavel ?? 'ninguém'],
              ['Prazo', tarefa.prazo ? date(tarefa.prazo) : 'sem prazo'],
              ['Vínculo', tarefa.vinculo.rotulo],
              ['Concluída', tarefa.concluidaEm ? `${date(tarefa.concluidaEm)} · ${tarefa.concluidaPor}` : '—'],
            ].map(([rotulo, valor]) => (
              <div key={rotulo}>
                <dt className="text-[11px] uppercase tracking-wide text-text-muted">{rotulo}</dt>
                <dd className="mt-0.5 truncate text-[13px] font-medium text-text">{valor}</dd>
              </div>
            ))}
          </dl>

          {tarefa.checklist.length > 0 && (
            <div className="space-y-2">
              <p className="text-[13px] font-semibold text-text">Checklist · {feitos}/{tarefa.checklist.length}</p>
              {tarefa.checklist.map((item) => (
                <label key={item.id} className="flex cursor-pointer items-center gap-2.5 text-[13px]">
                  <input
                    type="checkbox"
                    checked={item.feito}
                    onChange={() => checar.mutate(item.id)}
                    className="h-4 w-4 cursor-pointer rounded border-border-strong accent-[rgb(var(--primary))]"
                  />
                  <span className={cn(item.feito ? 'text-text-muted line-through' : 'text-text-secondary')}>{item.texto}</span>
                </label>
              ))}
            </div>
          )}

          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-[13px] font-semibold text-text">Comentários</p>

            <form
              onSubmit={(e) => { e.preventDefault(); if (texto.trim()) enviar.mutate(texto) }}
              className="flex items-start gap-2"
            >
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escreva um comentário…"
                className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
              <Button type="submit" size="sm" loading={enviar.isPending} disabled={!texto.trim()}>Enviar</Button>
            </form>

            {comentarios.isLoading && <Skeleton className="h-16 w-full" />}
            <ul className="space-y-3">
              {comentarios.data?.map((c) => (
                <li key={c.id} className="flex gap-2.5">
                  <Avatar nome={c.autor} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px]">
                      <span className="font-semibold text-text">{c.autor}</span>{' '}
                      <span className="text-text-muted">{timeAgo(c.criadoEm)}</span>
                    </p>
                    <p className="text-[13px] text-text-secondary">{c.texto}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  )
}
