import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { conciliarPar, listarConciliacao } from '@/shared/api/operacao'
import type { ParConciliacao } from '@/shared/api/types'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardHeader } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Meter } from '@/shared/ui/Meter'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { date, money } from '@/shared/lib/format'

/**
 * Conciliação lado a lado: extrato do banco (o que aconteceu) × lançamento do
 * sistema (o que registramos). A sugestão de par é SUGESTÃO — quem concilia é
 * a pessoa. Casar automático em cima de "quase igual" é como diferença de
 * centavos vira divergência que ninguém acha três meses depois.
 */
export function ConciliacaoPage() {
  const qc = useQueryClient()
  const [ignorados, setIgnorados] = useState<Set<number>>(new Set())
  const { data, isLoading } = useQuery({ queryKey: ['conciliacao'], queryFn: listarConciliacao })

  const conciliar = useMutation({
    mutationFn: conciliarPar,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conciliacao'] }),
  })

  const pares = (data ?? []).filter((p) => !ignorados.has(p.banco.id))
  const conciliados = pares.filter((p) => p.situacao === 'conciliado').length
  const pendentes = pares.length - conciliados

  const situacaoBadge = (par: ParConciliacao) => {
    if (par.situacao === 'conciliado') return <Badge tom="good">Conciliado</Badge>
    if (par.situacao === 'sem_par') return <Badge tom="critical">Sem par no sistema</Badge>
    return par.confianca === 1 ? <Badge tom="info">Par exato</Badge> : <Badge tom="warning">Par aproximado</Badge>
  }

  return (
    <div className="space-y-2 sm:space-y-4 lg:space-y-6">
      <PageHeader
        titulo="Conciliação bancária"
        descricao="O extrato do banco de um lado, o que o sistema registrou do outro."
        acoes={
          <>
            <Button variant="secondary"><span aria-hidden>📥</span> Importar OFX</Button>
            <Button variant="secondary"><span aria-hidden>🔄</span> Sincronizar banco</Button>
          </>
        }
      />

      <Card>
        <div className="grid grid-cols-1 p-4 sm:grid-cols-3 sm:p-5 gap-2 sm:gap-4 lg:gap-6">
          <Meter rotulo="Conciliado no período" valor={conciliados} total={pares.length || 1} formatar={(n) => `${n} lançamentos`} />
          <div>
            <p className="text-[13px] font-medium text-text-muted">Pendentes</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-text">{pendentes}</p>
          </div>
          <div>
            <p className="text-[13px] font-medium text-text-muted">Diferença acumulada</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-critical">
              {money(pares.reduce((s, p) => s + (p.sistema ? Math.abs(p.banco.valor - p.sistema.valor) : 0), 0))}
            </p>
          </div>
        </div>
      </Card>

      {isLoading && <Card><div className="p-4"><Skeleton className="h-40 w-full" /></div></Card>}

      {!isLoading && pares.length === 0 && (
        <Card><EmptyState icone="✅" titulo="Nada a conciliar" descricao="Todos os lançamentos do período já foram tratados." /></Card>
      )}

      <div className="space-y-3">
        {pares.map((par) => {
          const diferenca = par.sistema ? par.banco.valor - par.sistema.valor : null
          return (
            <Card key={par.banco.id} className="overflow-hidden">
              <CardHeader
                titulo={date(par.banco.data)}
                descricao={`Documento ${par.banco.documento}`}
                acoes={situacaoBadge(par)}
              />

              <div className="grid grid-cols-1 divide-y divide-border lg:grid-cols-[1fr_auto_1fr] lg:divide-x lg:divide-y-0">
                {/* Extrato do banco */}
                <div className="p-4 sm:p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Extrato do banco</p>
                  <p className="mt-1.5 text-[13px] font-medium text-text">{par.banco.descricao}</p>
                  <p className={cn('mt-1 text-lg font-semibold tabular-nums', par.banco.valor >= 0 ? 'text-good' : 'text-critical')}>
                    {money(par.banco.valor)}
                  </p>
                </div>

                {/* Diferença no meio: é o número que decide */}
                <div className="flex items-center justify-center gap-2 bg-surface-2/60 px-4 py-3 lg:flex-col lg:px-6">
                  <span aria-hidden className="text-text-muted">⇄</span>
                  {diferenca === null ? (
                    <span className="text-[12px] text-text-muted">sem par</span>
                  ) : diferenca === 0 ? (
                    <span className="text-[12px] font-medium text-good">valores iguais</span>
                  ) : (
                    <span className="text-[12px] font-semibold tabular-nums text-warning">
                      diferença {money(Math.abs(diferenca))}
                    </span>
                  )}
                </div>

                {/* Lançamento do sistema */}
                <div className="p-4 sm:p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Lançamento no sistema</p>
                  {par.sistema ? (
                    <>
                      <p className="mt-1.5 text-[13px] font-medium text-text">{par.sistema.descricao}</p>
                      <p className="mt-0.5 text-[12px] text-text-muted">{par.sistema.origem}</p>
                      <p className={cn('mt-1 text-lg font-semibold tabular-nums', par.sistema.valor >= 0 ? 'text-good' : 'text-critical')}>
                        {money(par.sistema.valor)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1.5 text-[13px] text-text-muted">
                      Nenhum lançamento com data e valor próximos. Crie o lançamento ou marque como
                      movimento que não pertence a esta operação.
                    </p>
                  )}
                </div>
              </div>

              {par.situacao !== 'conciliado' && (
                <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface-2/40 px-4 py-3">
                  {par.sistema ? (
                    <Button
                      size="sm"
                      loading={conciliar.isPending && conciliar.variables === par.banco.id}
                      onClick={() => conciliar.mutate(par.banco.id)}
                    >
                      Conciliar par
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary">Criar lançamento</Button>
                  )}
                  <Button size="sm" variant="ghost">Procurar outro lançamento</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => setIgnorados((atual) => new Set(atual).add(par.banco.id))}
                  >
                    Ignorar por ora
                  </Button>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      <p className="text-[12px] text-text-muted">
        A sugestão de par vem de data e valor próximos — e é sugestão. Casar sozinho o que está
        “quase igual” é como diferença de centavos vira divergência que ninguém acha depois.
      </p>
    </div>
  )
}
