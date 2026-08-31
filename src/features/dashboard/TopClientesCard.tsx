import { Link } from 'react-router-dom'
import { Avatar } from '@/shared/ui/Avatar'
import { Card, CardHeader } from '@/shared/ui/Card'
import { clientes } from '@/shared/api/mock-db'
import { money } from '@/shared/lib/format'

/**
 * Ranking de receita por cliente. A barra é proporção contra o primeiro
 * colocado — UMA cor para todas (categorias nominais não ganham rampa de
 * valor: o comprimento já diz quem é maior).
 */
export function TopClientesCard() {
  const top = [...clientes]
    .filter((c) => c.status !== 'inativo')
    .sort((a, b) => b.mrr - a.mrr || a.id - b.id)
    .slice(0, 6)

  const maior = top[0]?.mrr || 1
  const somaTop = top.reduce((acc, c) => acc + c.mrr, 0)

  return (
    <Card className="flex flex-col">
      <CardHeader
        titulo="Maiores contas"
        descricao="Por receita recorrente mensal"
        acoes={
          <Link
            to="/clientes?sortBy=mrr&sortDir=desc"
            className="whitespace-nowrap text-[13px] font-medium text-primary hover:underline"
          >
            Ver todos
          </Link>
        }
      />

      <ol className="flex-1 divide-y divide-border">
        {top.map((cliente, i) => (
          <li key={cliente.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2 sm:px-5">
            <span aria-hidden className="w-3 shrink-0 text-[12px] font-semibold tabular-nums text-text-muted">
              {i + 1}
            </span>
            <Avatar nome={cliente.nome} />

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-text">{cliente.nome}</p>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max((cliente.mrr / maior) * 100, 4)}%` }}
                />
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-[13px] font-semibold tabular-nums text-text">{money(cliente.mrr)}</p>
              <p className="text-[11px] text-text-muted">{cliente.plano}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted sm:px-5">
        As seis maiores somam <span className="font-semibold text-text-secondary">{money(somaTop)}</span> por mês.
      </p>
    </Card>
  )
}
