import type { PrioridadeTarefa, SituacaoTarefa, Tarefa } from '@/shared/api/types'
import { estaAtrasada, venceHoje, SITUACOES } from '@/shared/api/tarefas'
import { Avatar } from '@/shared/ui/Avatar'
import { cn } from '@/shared/lib/cn'
import { date } from '@/shared/lib/format'

const corPrioridade: Record<PrioridadeTarefa, string> = {
  urgente: 'bg-critical', alta: 'bg-warning', media: 'bg-primary', baixa: 'bg-border-strong',
}
const rotuloPrioridade: Record<PrioridadeTarefa, string> = {
  urgente: 'Urgente', alta: 'Alta', media: 'Média', baixa: 'Baixa',
}

/**
 * Cartão do quadro. Arrastar é conveniência, não o único caminho: o seletor
 * "mover para" existe porque quem usa teclado ou leitor de tela não arrasta —
 * quadro só com drag-and-drop é quadro inacessível.
 */
export function TarefaCard({
  tarefa, onAbrir, onMover, arrastando, onDragStart, onDragEnd,
}: {
  tarefa: Tarefa
  onAbrir: () => void
  onMover: (situacao: SituacaoTarefa) => void
  arrastando?: boolean
  onDragStart?: () => void
  onDragEnd?: () => void
}) {
  const atrasada = estaAtrasada(tarefa)
  const feitos = tarefa.checklist.filter((c) => c.feito).length

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'group rounded-xl border border-border bg-surface p-2 shadow-card sm:p-4 transition-shadow',
        'hover:shadow-pop',
        arrastando && 'opacity-40',
      )}
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          title={rotuloPrioridade[tarefa.prioridade]}
          className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', corPrioridade[tarefa.prioridade])}
        />
        <button type="button" onClick={onAbrir} className="min-w-0 flex-1 text-left">
          <p className="text-[13px] font-medium leading-snug text-text">{tarefa.titulo}</p>
          {tarefa.vinculo.tipo !== 'nenhum' && (
            <p className="mt-0.5 truncate text-[11px] text-text-muted">{tarefa.vinculo.rotulo}</p>
          )}
        </button>
      </div>

      {tarefa.etiquetas.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tarefa.etiquetas.map((e) => (
            <span key={e} className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-text-muted">{e}</span>
          ))}
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
        {tarefa.prazo ? (
          <span className={cn('tabular-nums', atrasada ? 'font-semibold text-critical' : venceHoje(tarefa) ? 'font-semibold text-warning' : 'text-text-muted')}>
            {atrasada ? '⚠ ' : '📅 '}{date(tarefa.prazo)}
          </span>
        ) : (
          <span className="text-text-muted">sem prazo</span>
        )}
        {tarefa.checklist.length > 0 && (
          <span className="text-text-muted">☑ {feitos}/{tarefa.checklist.length}</span>
        )}
        {tarefa.comentarios > 0 && <span className="text-text-muted">💬 {tarefa.comentarios}</span>}

        <span className="ml-auto flex items-center gap-1.5">
          {tarefa.responsavel ? (
            <>
              <Avatar nome={tarefa.responsavel} size="sm" />
              <span className="sr-only">{tarefa.responsavel}</span>
            </>
          ) : (
            <span className="rounded bg-warning/15 px-1.5 py-0.5 font-medium text-text-secondary">sem responsável</span>
          )}
        </span>
      </div>

      {/* Caminho acessível de mover, além do arrastar. */}
      <label className="mt-2 block">
        <span className="sr-only">Mover {tarefa.titulo} para</span>
        <select
          value={tarefa.situacao}
          onChange={(e) => onMover(e.target.value as SituacaoTarefa)}
          className="h-7 w-full rounded-md border border-border bg-surface-2 px-1.5 text-[11px] text-text-secondary opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
        >
          {SITUACOES.map((s) => <option key={s.id} value={s.id}>Mover para {s.rotulo}</option>)}
        </select>
      </label>
    </article>
  )
}
