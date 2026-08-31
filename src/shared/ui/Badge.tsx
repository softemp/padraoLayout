import { cn } from '@/shared/lib/cn'
import type { ReactNode } from 'react'

type Tom = 'neutro' | 'good' | 'warning' | 'serious' | 'critical' | 'info'

/**
 * Status NUNCA por cor sozinha: o componente exige rótulo e desenha um ícone.
 * (Duas das cores de status ficam abaixo de 3:1 no tema claro — ícone + texto
 * é a compensação prescrita.)
 */
const tons: Record<Tom, { classe: string; icone: string }> = {
  neutro: { classe: 'bg-surface-3 text-text-secondary ring-border', icone: '•' },
  good: { classe: 'bg-good/12 text-good ring-good/30', icone: '✔' },
  warning: { classe: 'bg-warning/16 text-[rgb(146,98,0)] ring-warning/40 dark:text-warning', icone: '⏳' },
  serious: { classe: 'bg-serious/16 text-[rgb(166,72,32)] ring-serious/40 dark:text-serious', icone: '▲' },
  critical: { classe: 'bg-critical/12 text-critical ring-critical/30', icone: '✕' },
  info: { classe: 'bg-primary/12 text-primary ring-primary/30', icone: 'ℹ' },
}

export function Badge({ tom = 'neutro', children, className }: { tom?: Tom; children: ReactNode; className?: string }) {
  const { classe, icone } = tons[tom]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5',
        'text-[12px] font-medium leading-5 ring-1 ring-inset',
        classe,
        className,
      )}
    >
      <span aria-hidden className="text-[10px] leading-none">{icone}</span>
      {children}
    </span>
  )
}
