import { cn } from '@/shared/lib/cn'
import { initials } from '@/shared/lib/format'

export function Avatar({ nome, size = 'md', className }: { nome: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const tamanhos = { sm: 'h-7 w-7 text-[11px]', md: 'h-8 w-8 text-xs', lg: 'h-12 w-12 text-sm' }
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'bg-primary/12 font-semibold text-primary ring-1 ring-inset ring-primary/20',
        tamanhos[size],
        className,
      )}
    >
      {initials(nome)}
    </span>
  )
}
