import { useId } from 'react'
import { useChartTokens } from '@/shared/charts/tokens'

/**
 * Sparkline de 12 pontos em SVG puro (nenhuma lib para 12 pontos).
 * Série em cinza de contexto; o trecho corrente na cor de destaque.
 */
export function Sparkline({ pontos, positivo = true, className }: { pontos: number[]; positivo?: boolean; className?: string }) {
  const t = useChartTokens()
  const id = useId()
  const w = 120
  const h = 34
  const min = Math.min(...pontos)
  const max = Math.max(...pontos)
  const amplitude = max - min || 1

  const coords = pontos.map((p, i) => ({
    x: (i / (pontos.length - 1)) * w,
    y: h - ((p - min) / amplitude) * (h - 6) - 3,
  }))
  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const dFinal = coords.slice(-3).map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const fim = coords[coords.length - 1]
  const cor = positivo ? t.good : t.critical

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} role="img" aria-hidden focusable="false" preserveAspectRatio="none">
      <title id={id}>Tendência dos últimos 12 períodos</title>
      <path d={d} fill="none" stroke={t.serieMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
      <path d={dFinal} fill="none" stroke={cor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Anel de 2px na cor da superfície: o ponto continua legível ao cruzar a linha. */}
      <circle cx={fim.x} cy={fim.y} r={3.4} fill={cor} stroke={t.superficie} strokeWidth={2} />
    </svg>
  )
}
