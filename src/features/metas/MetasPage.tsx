import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  atingimento, esperadoAteAgora, farol, listarIndicadores, PERSPECTIVAS, projecaoFimDoPeriodo,
  ritmo, rotuloDirecao, type Farol,
} from '@/shared/api/indicadores'
import type { Indicador, Perspectiva } from '@/shared/api/types'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { formatarMinutos } from '@/shared/api/chamados'
import { money, moneyCompact, number, percent } from '@/shared/lib/format'

export const formatarValor = (i: Indicador, v: number) =>
  i.formato === 'moeda' ? (v >= 100_000 ? moneyCompact(v) : money(v))
    : i.formato === 'percentual' ? percent(v)
    : i.formato === 'minutos' ? formatarMinutos(Math.round(v))
    : number(Math.round(v))

const corFarol: Record<Farol, { barra: string; texto: string; rotulo: string }> = {
  verde: { barra: 'bg-good', texto: 'text-good', rotulo: 'No ritmo' },
  amarelo: { barra: 'bg-warning', texto: 'text-warning', rotulo: 'Atenção' },
  vermelho: { barra: 'bg-critical', texto: 'text-critical', rotulo: 'Fora do ritmo' },
}

/** Minigráfico de 6 pontos, sem lib — a série é curta. */
function Serie({ pontos, cor }: { pontos: { valor: number }[]; cor: string }) {
  const valores = pontos.map((p) => p.valor)
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const amp = max - min || 1
  const d = valores
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (valores.length - 1)) * 100},${28 - ((v - min) / amp) * 24 - 2}`)
    .join(' ')
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-7 w-full" role="img" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={cor} opacity={0.7} />
    </svg>
  )
}

function CartaoIndicador({ indicador }: { indicador: Indicador }) {
  const f = farol(indicador)
  const cores = corFarol[f]
  const r = ritmo(indicador)
  const esperado = esperadoAteAgora(indicador)
  const projecao = projecaoFimDoPeriodo(indicador)
  const maiorMelhor = indicador.direcao === 'maior_melhor'

  return (
    <Link
      to={`/metas/${indicador.id}`}
      className="block rounded-xl border border-border bg-surface p-4 shadow-card transition-shadow hover:shadow-pop"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-text">{indicador.nome}</p>
          <p className="truncate text-[11px] text-text-muted">{indicador.periodo} · {indicador.responsavel}</p>
        </div>
        <Badge tom={f === 'verde' ? 'good' : f === 'amarelo' ? 'warning' : 'critical'}>{cores.rotulo}</Badge>
      </div>

      <div className="mt-2.5 flex items-end justify-between gap-3">
        <div>
          <p className={cn('text-2xl font-semibold tabular-nums', cores.texto)}>{formatarValor(indicador, indicador.atual)}</p>
          <p className="text-[12px] text-text-muted">
            meta {formatarValor(indicador, indicador.meta)} · {rotuloDirecao(indicador.direcao)}
          </p>
        </div>
        <div className="w-24 shrink-0">
          <Serie pontos={indicador.serie} cor={cores.texto} />
        </div>
      </div>

      {/* A barra mostra o realizado; o traço marca o ESPERADO até hoje. */}
      <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-3">
        <span
          className={cn('block h-full rounded-full', cores.barra)}
          style={{ width: `${Math.min(atingimento(indicador), 1) * 100}%` }}
        />
        {maiorMelhor && indicador.decorrido < 1 && (
          <span
            aria-hidden
            title="esperado até hoje"
            className="absolute top-0 h-full w-0.5 bg-text"
            style={{ left: `${Math.min(indicador.decorrido, 1) * 100}%` }}
          />
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
        <span>
          {maiorMelhor && indicador.decorrido < 1
            ? <>esperado até hoje {formatarValor(indicador, esperado)} · ritmo {percent(r)}</>
            : <>atingimento {percent(atingimento(indicador))}</>}
        </span>
        {maiorMelhor && indicador.decorrido < 1 && (
          <span className={cn(projecao >= indicador.meta ? 'text-good' : 'text-warning')}>
            projeção {formatarValor(indicador, projecao)}
          </span>
        )}
      </div>
    </Link>
  )
}

export function MetasPage() {
  const [params, setParams] = useSearchParams()
  const perspectiva = (params.get('p') ?? 'todas') as Perspectiva | 'todas'
  const [soRisco, setSoRisco] = useState(false)

  const { data, isLoading } = useQuery({ queryKey: ['indicadores'], queryFn: listarIndicadores, refetchInterval: 120_000 })

  const filtrados = (data ?? [])
    .filter((i) => perspectiva === 'todas' || i.perspectiva === perspectiva)
    .filter((i) => !soRisco || farol(i) !== 'verde')

  const foraDoRitmo = (data ?? []).filter((i) => farol(i) === 'vermelho').length

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        titulo="Metas e indicadores"
        descricao="Cada número sai de um módulo do sistema — nenhum é digitado à mão."
        acoes={
          <>
            <Button variant={soRisco ? 'secondary' : 'ghost'} onClick={() => setSoRisco((v) => !v)}>
              <span aria-hidden>🚩</span> {soRisco ? 'Mostrando só fora do ritmo' : 'Só o que precisa de atenção'}
            </Button>
            <Button><span aria-hidden>＋</span> Novo indicador</Button>
          </>
        }
      />

      <div role="tablist" aria-label="Perspectiva" className="flex flex-wrap items-center gap-1 border-b border-border">
        {[{ id: 'todas' as const, rotulo: 'Todas', icone: '📌' }, ...PERSPECTIVAS].map((item) => {
          const ativa = perspectiva === item.id
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={ativa}
              onClick={() => setParams(item.id === 'todas' ? {} : { p: item.id }, { replace: true })}
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

      {foraDoRitmo > 0 && !soRisco && (
        <Card className="border-critical/40">
          <CardHeader
            titulo={`${number(foraDoRitmo)} indicadores fora do ritmo`}
            descricao="Fora do ritmo é diferente de abaixo da meta: metade do caminho no dia 5 é ótimo, no dia 28 é desastre. O farol olha o ritmo."
            acoes={<Button size="sm" variant="secondary" onClick={() => setSoRisco(true)}>Ver só esses</Button>}
          />
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {filtrados.map((i) => <CartaoIndicador key={i.id} indicador={i} />)}
        </div>
      )}

      <Card>
        <CardHeader titulo="Por que estes números são confiáveis" />
        <CardBody className="space-y-2 text-[13px] leading-relaxed text-text-secondary">
          <p>
            <strong className="text-text">Nenhum indicador é digitado.</strong> Cada um declara a fonte e leva à tela
            de origem: receita vem de Vendas, caixa de Contas a pagar e receber, SLA de Chamados, ruptura do Estoque.
            Indicador alimentado à mão fica verde por três meses porque o responsável esqueceu de atualizar — e quando
            alguém percebe, ninguém mais confia no painel.
          </p>
          <p>
            <strong className="text-text">Indicador que pode ser jogado tem contrapeso.</strong> Receita anda com
            margem; tempo de primeira resposta anda com reabertura. A pergunta que gera o par é sempre a mesma:
            <em> como eu melhoraria este número agindo mal?</em>
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
