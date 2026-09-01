import type { CelulaMapa, LinhaMapa, Reserva } from '@/shared/api/types'
import { hoje, HORARIOS } from '@/shared/api/reservas'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { money } from '@/shared/lib/format'
import { diaMes, diaSemana, SITUACAO, TIPO } from './comum'

/**
 * O espelho de reservas: unidades × dias, com o DIA PARTIDO EM DUAS METADES.
 *
 * Uma diária não é um bloco de 24h. Quem sai às 12h ocupou a manhã; quem entra
 * às 14h ocupa a tarde. No dia de virada as duas metades são de hóspedes
 * diferentes — por isso a saída é um triângulo inferior-esquerdo e a chegada um
 * triângulo superior-direito, com a mesma diagonal.
 *
 * Pintar o dia inteiro esconde justamente a diária que está à venda, que é a
 * informação que a recepção mais precisa enxergar de longe.
 *
 * As duas metades encaixam porque usam a MESMA diagonal (canto superior-esquerdo
 * → canto inferior-direito):
 *
 *     saída ▙   chegada ▜   virada ▚ (duas cores)
 *
 * E a barra continua sem emenda no meio da estadia: o triângulo da chegada tem a
 * aresta direita inteira, o da saída tem a esquerda inteira.
 */
const CORTE_SAIDA = 'polygon(0 0, 100% 100%, 0 100%)'      // ▙ metade da manhã
const CORTE_CHEGADA = 'polygon(0 0, 100% 0, 100% 100%)'    // ▜ metade da tarde

const corDaReserva = (r: Reserva) =>
  r.origem === 'bloqueio' ? 'bg-surface-3 text-text-muted' : SITUACAO[r.situacao].barra

const titulo = (r: Reserva, quando: string) =>
  r.origem === 'bloqueio'
    ? `${quando} · bloqueio: ${r.motivo}`
    : `${quando} · ${r.codigo} — ${r.hospede} · ${money(r.valorDiarias)}`

export function MapaOcupacao({
  linhas, carregando, onCelulaVazia, onReserva,
}: {
  linhas: LinhaMapa[] | undefined
  carregando: boolean
  onCelulaVazia: (unidadeId: number, data: string) => void
  onReserva: (r: Reserva) => void
}) {
  if (carregando || !linhas) {
    return <div className="space-y-2 p-2 sm:p-4 lg:p-6">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
  }
  const datas = linhas[0]?.celulas.map((c) => c.data) ?? []

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[62rem] border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 w-56 border-b border-r border-border bg-surface px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-wide text-text-muted">
              Unidade
            </th>
            {datas.map((d) => {
              const fds = ['sex', 'sáb'].includes(diaSemana(d))
              return (
                <th
                  key={d}
                  scope="col"
                  className={cn(
                    'w-14 border-b border-border px-0 py-1.5 text-center text-[11px] font-medium',
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
                className="sticky left-0 z-20 whitespace-nowrap border-b border-r border-border bg-surface px-3 py-1.5 text-left font-normal group-hover:bg-surface-2"
              >
                <span className="flex items-center gap-1.5">
                  <span aria-hidden>{TIPO[unidade.tipo].icone}</span>
                  <span className="text-[13px] font-medium text-text">{unidade.nome}</span>
                  <span className="text-[11px] text-text-muted">· {unidade.capacidade}p</span>
                </span>
              </th>
              {celulas.map((c) => (
                <Celula
                  key={c.data}
                  celula={c}
                  unidadeId={unidade.id}
                  onCelulaVazia={onCelulaVazia}
                  onReserva={onReserva}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Celula({
  celula, unidadeId, onCelulaVazia, onReserva,
}: {
  celula: CelulaMapa
  unidadeId: number
  onCelulaVazia: (unidadeId: number, data: string) => void
  onReserva: (r: Reserva) => void
}) {
  const { data, noite, chegada, saida, rotulo } = celula
  // Só a metade da tarde manda na disponibilidade: dia com apenas uma saída
  // continua à venda para quem chega às 14h.
  const podeReservar = !noite && !chegada
  const marcada = rotulo === 'noite' ? noite : rotulo === 'chegada' ? chegada : null

  return (
    <td className={cn('relative h-10 border-b border-l border-border/50 p-0', data === hoje() && 'bg-primary/8')}>
      {podeReservar && (
        <button
          type="button"
          onClick={() => onCelulaVazia(unidadeId, data)}
          title={`Livre a partir das ${HORARIOS.entrada} de ${data} — clique para reservar`}
          className="absolute inset-0 transition-colors hover:bg-primary/16"
        >
          <span className="sr-only">Reservar em {data}</span>
        </button>
      )}

      {saida && (
        <button
          type="button"
          onClick={() => onReserva(saida)}
          title={titulo(saida, `sai às ${HORARIOS.saida}`)}
          style={{ clipPath: CORTE_SAIDA }}
          className={cn('absolute inset-0', corDaReserva(saida))}
        >
          <span className="sr-only">Saída de {saida.hospede ?? 'bloqueio'} em {data}</span>
        </button>
      )}

      {chegada && (
        <button
          type="button"
          onClick={() => onReserva(chegada)}
          title={titulo(chegada, `entra às ${HORARIOS.entrada}`)}
          style={{ clipPath: CORTE_CHEGADA }}
          className={cn('absolute inset-0', corDaReserva(chegada))}
        >
          <span className="sr-only">Chegada de {chegada.hospede ?? 'bloqueio'} em {data}</span>
        </button>
      )}

      {noite && (
        <button
          type="button"
          onClick={() => onReserva(noite)}
          title={titulo(noite, 'noite')}
          className={cn('absolute inset-0', corDaReserva(noite))}
        >
          <span className="sr-only">{noite.hospede ?? 'bloqueio'} em {data}</span>
        </button>
      )}

      {marcada && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-0 flex items-center truncate text-[11px] font-medium',
            // Na chegada o texto começa depois da diagonal, senão cai no vazio.
            rotulo === 'chegada' ? 'left-1/2 right-1' : 'left-1 right-1',
            marcada.origem === 'bloqueio' ? 'text-text-muted' : SITUACAO[marcada.situacao].barra.split(' ').find((c) => c.startsWith('text-')),
          )}
        >
          {marcada.origem === 'bloqueio' ? `🔧 ${marcada.motivo}` : marcada.hospede}
        </span>
      )}
    </td>
  )
}
