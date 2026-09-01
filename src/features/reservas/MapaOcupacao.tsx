import type { LinhaMapa, Reserva } from '@/shared/api/types'
import { hoje } from '@/shared/api/reservas'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { money } from '@/shared/lib/format'
import { diaMes, diaSemana, SITUACAO, TIPO } from './comum'

/**
 * O mapa é a tela que a recepção olha o dia inteiro: unidades × NOITES.
 *
 * Cada coluna é uma noite, não um dia do calendário — por isso a última coluna
 * de uma reserva é a última noite dormida, e o dia da saída já aparece livre
 * para quem chega. Desenhar "até a data de saída" é o erro que faz o mapa
 * mostrar o quarto ocupado numa noite que está à venda.
 */
export function MapaOcupacao({
  linhas, carregando, onCelulaVazia, onReserva,
}: {
  linhas: LinhaMapa[] | undefined
  carregando: boolean
  onCelulaVazia: (unidadeId: number, data: string) => void
  onReserva: (r: Reserva) => void
}) {
  if (carregando || !linhas) {
    return <div className="space-y-2 p-2 sm:p-4 lg:p-6">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 rounded-lg" />)}</div>
  }
  const datas = linhas[0]?.celulas.map((c) => c.data) ?? []

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 border-b border-r border-border bg-surface px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-wide text-text-muted">
              Unidade
            </th>
            {datas.map((d) => {
              const fds = ['sex', 'sáb'].includes(diaSemana(d))
              return (
                <th
                  key={d}
                  scope="col"
                  className={cn(
                    'border-b border-border px-0 py-1.5 text-center text-[11px] font-medium',
                    d === hoje() ? 'bg-primary/12 text-primary' : fds ? 'bg-surface-2 text-text-secondary' : 'text-text-muted',
                  )}
                >
                  <span className="block">{diaSemana(d)}</span>
                  <span className="block text-[13px] font-semibold tabular-nums text-text">{diaMes(d)}</span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {linhas.map(({ unidade, celulas }) => (
            <tr key={unidade.id} className="group">
              <th
                scope="row"
                className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-border bg-surface px-3 py-1.5 text-left font-normal group-hover:bg-surface-2"
              >
                <span className="flex items-center gap-1.5">
                  <span aria-hidden>{TIPO[unidade.tipo].icone}</span>
                  <span className="text-[13px] font-medium text-text">{unidade.nome}</span>
                  <span className="text-[11px] text-text-muted">· {unidade.capacidade}p</span>
                </span>
              </th>
              {celulas.map((c) => {
                if (!c.reserva) {
                  return (
                    <td key={c.data} className={cn('border-b border-l border-border/50 p-0', c.data === hoje() && 'bg-primary/8')}>
                      <button
                        type="button"
                        onClick={() => onCelulaVazia(unidade.id, c.data)}
                        title={`${unidade.nome} livre em ${c.data} — clique para reservar`}
                        className="h-8 w-full transition-colors hover:bg-primary/16"
                      >
                        <span className="sr-only">Reservar {unidade.nome} em {c.data}</span>
                      </button>
                    </td>
                  )
                }
                const r = c.reserva
                const bloqueio = r.origem === 'bloqueio'
                return (
                  <td key={c.data} className="border-b border-border/50 p-0">
                    <button
                      type="button"
                      onClick={() => onReserva(r)}
                      title={bloqueio ? `Bloqueio: ${r.motivo}` : `${r.codigo} · ${r.hospede} · ${money(r.valorDiarias)}`}
                      className={cn(
                        'flex h-8 w-full items-center overflow-hidden px-1 text-[11px] font-medium',
                        bloqueio ? 'bg-surface-3 text-text-muted' : SITUACAO[r.situacao].barra,
                        c.inicio && 'rounded-l-md',
                      )}
                    >
                      {c.inicio && (
                        <span className="truncate">
                          {bloqueio ? `🔧 ${r.motivo}` : r.hospede}
                        </span>
                      )}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
