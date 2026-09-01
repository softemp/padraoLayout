import { useQuery } from '@tanstack/react-query'
import { listarUnidades } from '@/shared/api/reservas'
import type { UnidadeHospedagem } from '@/shared/api/types'
import { Badge } from '@/shared/ui/Badge'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { Skeleton } from '@/shared/ui/Skeleton'
import { money, number } from '@/shared/lib/format'
import { COMODIDADE, TIPO } from './comum'

/**
 * O cadastro da unidade guarda DUAS listas que costumam virar uma só — e aí não
 * serve para nenhuma das duas finalidades:
 *
 *   COMODIDADE  → característica que VENDE (lareira, hidro, aceita pet).
 *                 Entra na busca, no filtro e no anúncio.
 *   INVENTÁRIO  → item que se CONFERE (4 toalhas, 1 secador, 2 taças).
 *                 Entra na vistoria de saída, com valor de reposição.
 *
 * "Frigobar" é comodidade; "frigobar com 6 latas" é inventário. Misturar dá uma
 * lista longa demais para vender e curta demais para conferir.
 */
export function UnidadesPainel() {
  const { data: unidades, isLoading } = useQuery({ queryKey: ['reservas-unidades'], queryFn: listarUnidades })

  if (isLoading) {
    return <div className="grid grid-cols-1 gap-2 sm:gap-4 lg:grid-cols-2 lg:gap-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}</div>
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:gap-4 lg:grid-cols-2 lg:gap-6">
      {unidades?.map((u: UnidadeHospedagem) => {
        const conferir = u.inventario.filter((i) => i.conferirNaSaida)
        const exposicao = conferir.reduce((s, i) => s + i.quantidade * i.valorReposicao, 0)
        return (
          <Card key={u.id}>
            <CardHeader
              titulo={<><span aria-hidden>{TIPO[u.tipo].icone} </span>{u.nome}</>}
              descricao={`${TIPO[u.tipo].rotulo} · ${u.camas} · até ${u.capacidade} pessoas`}
              acoes={<Badge tom={u.ativa ? 'good' : 'neutro'}>{u.ativa ? 'Em operação' : 'Fora de operação'}</Badge>}
            />
            <CardBody className="space-y-4">
              <div className="flex items-baseline justify-between gap-3 rounded-lg bg-surface-2 p-2 sm:p-4">
                <span className="text-[13px] text-text-secondary">Tarifa de referência</span>
                <span className="text-[15px] font-semibold tabular-nums text-text">{money(u.tarifaBase)}<span className="text-[12px] font-normal text-text-muted">/noite</span></span>
              </div>
              <p className="-mt-2 text-[11px] leading-snug text-text-muted">
                É referência: a diária de cada noite (fim de semana, temporada) é <strong className="text-text-secondary">copiada</strong> na
                reserva. Mudar aqui não reescreve reserva feita.
              </p>

              <div>
                <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
                  Comodidades <span className="font-normal normal-case">— o que vende</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {u.comodidades.map((c) => (
                    <span key={c} className="rounded-md bg-surface-3 px-2 py-0.5 text-[12px] text-text-secondary">
                      <span aria-hidden>{COMODIDADE[c].icone} </span>{COMODIDADE[c].rotulo}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
                  Inventário <span className="font-normal normal-case">— o que se confere na saída</span>
                </p>
                <table className="w-full text-[13px]">
                  <tbody>
                    {u.inventario.map((i) => (
                      <tr key={i.id} className="border-b border-border/60 last:border-0">
                        <td className="py-1 text-text-secondary">
                          {i.nome}
                          {!i.conferirNaSaida && <span className="ml-1.5 text-[11px] text-text-muted">(não se confere)</span>}
                        </td>
                        <td className="py-1 text-right tabular-nums text-text-muted">{number(i.quantidade)}×</td>
                        <td className="py-1 pl-3 text-right tabular-nums text-text-secondary">{money(i.valorReposicao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[12px] text-text-muted">
                  Exposição por estadia: <strong className="text-text-secondary">{money(exposicao)}</strong> em{' '}
                  {conferir.length} itens conferidos.
                </p>
              </div>

              {u.observacao && <p className="text-[12px] text-text-muted">📌 {u.observacao}</p>}
            </CardBody>
          </Card>
        )
      })}
    </div>
  )
}
