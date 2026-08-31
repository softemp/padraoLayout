import { cn } from '@/shared/lib/cn'

/** Padrão do sistema: 10 linhas por página. Options ajustável por tela. */
export const DEFAULT_PAGE_SIZE = 10

export function PageSizeSelect({
  value, onChange, options = [10, 25, 50, 100], className,
}: { value: number; onChange: (n: number) => void; options?: number[]; className?: string }) {
  return (
    <label className={cn('flex items-center gap-2 text-[13px] text-text-muted', className)}>
      <span className="hidden sm:inline">Linhas</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 cursor-pointer rounded-lg border border-border bg-surface px-2 text-[13px] text-text hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  )
}
