import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variantes: Record<Variant, string> = {
  primary: 'bg-primary text-text-inverse hover:bg-primary-hover shadow-card',
  secondary: 'bg-surface text-text border border-border hover:bg-surface-2',
  ghost: 'text-text-secondary hover:bg-surface-2 hover:text-text',
  danger: 'bg-critical text-white hover:brightness-95',
}
const tamanhos: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-[15px] gap-2',
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
  block?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, block, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      // Anti-duplo-submit: enquanto carrega, o botão não aceita novo clique.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-lg font-medium',
        'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55',
        variantes[variant],
        tamanhos[size],
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {children}
    </button>
  )
})
