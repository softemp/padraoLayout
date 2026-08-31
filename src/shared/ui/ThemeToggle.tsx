import { useUi } from '@/store/ui'
import { cn } from '@/shared/lib/cn'

export function ThemeToggle({ className }: { className?: string }) {
  const resolvedTheme = useUi((s) => s.resolvedTheme)
  const toggleTheme = useUi((s) => s.toggleTheme)
  const escuro = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
      aria-label={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg text-base',
        'text-text-secondary transition-colors hover:bg-surface-2 hover:text-text',
        className,
      )}
    >
      <span aria-hidden>{escuro ? '☀️' : '🌙'}</span>
    </button>
  )
}
