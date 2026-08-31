import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listarNotificacoes, marcarTodasLidas } from '@/shared/api/api'
import { timeAgo } from '@/shared/lib/format'
import { Dropdown } from './Dropdown'
import { Skeleton } from './Skeleton'
import { cn } from '@/shared/lib/cn'
import type { Notificacao } from '@/shared/api/types'

const icone: Record<Notificacao['tipo'], string> = {
  info: 'ℹ️', sucesso: '✅', alerta: '⚠️', critico: '⛔',
}

export function NotificationBell() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['notificacoes'], queryFn: listarNotificacoes })
  const marcar = useMutation({
    mutationFn: marcarTodasLidas,
    onSuccess: (novas) => qc.setQueryData(['notificacoes'], novas),
  })

  const naoLidas = data?.filter((n) => !n.lida).length ?? 0

  return (
    <Dropdown
      rotuloGatilho={naoLidas ? `Notificações, ${naoLidas} não lidas` : 'Notificações'}
      largura="w-[22rem]"
      gatilho={(aberto) => (
        <span
          className={cn(
            'relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-base',
            'text-text-secondary transition-colors hover:bg-surface-2 hover:text-text',
            aberto && 'bg-surface-2 text-text',
          )}
        >
          <span aria-hidden>🔔</span>
          {/* Badge é CONTAGEM e SOME no zero — mostrar "0" é ruído. */}
          {naoLidas > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-critical px-1 text-[11px] font-semibold leading-none text-white ring-2 ring-surface">
              {naoLidas > 9 ? '9+' : naoLidas}
            </span>
          )}
        </span>
      )}
    >
      {(fechar) => (
        <div>
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
            <p className="text-sm font-semibold text-text">Notificações</p>
            {naoLidas > 0 && (
              <button
                type="button"
                data-item
                onClick={() => marcar.mutate()}
                className="text-[13px] font-medium text-primary hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-[min(60vh,24rem)] overflow-y-auto">
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3 px-3.5 py-3">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}

            {data?.map((n) => (
              <button
                key={n.id}
                type="button"
                data-item
                onClick={fechar}
                className={cn(
                  'flex w-full gap-3 border-b border-border/60 px-3.5 py-3 text-left transition-colors last:border-0',
                  'hover:bg-surface-2',
                  !n.lida && 'bg-primary/[0.045]',
                )}
              >
                <span aria-hidden className="mt-0.5 text-base leading-none">{icone[n.tipo]}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={cn('truncate text-[13px]', n.lida ? 'font-medium text-text-secondary' : 'font-semibold text-text')}>
                      {n.titulo}
                    </span>
                    {!n.lida && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-text-muted">{n.descricao}</span>
                  <span className="mt-1 block text-[11px] uppercase tracking-wide text-text-muted">{timeAgo(n.criadoEm)}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="border-t border-border p-2">
            <button
              type="button"
              data-item
              onClick={fechar}
              className="w-full rounded-lg px-3 py-2 text-center text-[13px] font-medium text-primary hover:bg-surface-2"
            >
              Ver todas as notificações
            </button>
          </div>
        </div>
      )}
    </Dropdown>
  )
}
