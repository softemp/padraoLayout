import { useEffect, useState } from 'react'
import { useUi } from '@/store/ui'

/**
 * Os gráficos leem as MESMAS variáveis CSS do resto da UI — nenhum hex vive
 * dentro de um gráfico. Ao trocar o tema, as cores são relidas.
 *
 * Ordem das séries é FIXA: cor segue a entidade, nunca a posição no ranking
 * (filtrar uma série não pode repintar as sobreviventes).
 */
export type ChartTokens = {
  serie: string[]
  serieMuted: string
  grid: string
  texto: string
  textoMuted: string
  superficie: string
  primary: string
  good: string
  critical: string
}

const varCss = (nome: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim()
  return v ? `rgb(${v})` : 'rgb(120 120 120)'
}

function lerTokens(): ChartTokens {
  return {
    serie: [1, 2, 3, 4, 5, 6].map((i) => varCss(`--series-${i}`)),
    serieMuted: varCss('--series-muted'),
    grid: varCss('--grid'),
    texto: varCss('--text-primary'),
    textoMuted: varCss('--text-muted'),
    superficie: varCss('--surface-1'),
    primary: varCss('--primary'),
    good: varCss('--good'),
    critical: varCss('--critical'),
  }
}

export function useChartTokens(): ChartTokens {
  const tema = useUi((s) => s.resolvedTheme)
  const [tokens, setTokens] = useState<ChartTokens>(() => lerTokens())
  useEffect(() => setTokens(lerTokens()), [tema])
  return tokens
}

/** Eixos e grade: hairline sólido, um passo fora da superfície. Nunca tracejado. */
export const eixoBase = (cor: string) => ({
  tick: { fill: cor, fontSize: 12 },
  tickLine: false as const,
  axisLine: false as const,
})
