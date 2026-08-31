import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

const baseControle =
  'w-full rounded-lg border border-border bg-surface px-3 text-sm text-text ' +
  'placeholder:text-text-muted transition-colors ' +
  'hover:border-border-strong focus:border-primary focus:outline-none ' +
  'focus:ring-2 focus:ring-primary/25 disabled:bg-surface-2 disabled:text-text-muted'

type CampoProps = {
  label?: string
  hint?: string
  error?: string
  acao?: ReactNode          // ex.: link "Esqueci minha senha" ao lado do label
  className?: string
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & CampoProps>(
  function Input({ label, hint, error, acao, className, id, ...props }, ref) {
    const gerado = useId()
    const inputId = id || gerado
    return (
      <div className={cn('space-y-1.5', className)}>
        {(label || acao) && (
          <div className="flex items-baseline justify-between gap-3">
            {label && (
              <label htmlFor={inputId} className="text-[13px] font-medium text-text-secondary">
                {label}
              </label>
            )}
            {acao}
          </div>
        )}
        <input
          id={inputId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-erro` : hint ? `${inputId}-hint` : undefined}
          className={cn(baseControle, 'h-10', error && 'border-critical focus:border-critical focus:ring-critical/25')}
          {...props}
        />
        {error ? (
          <p id={`${inputId}-erro`} role="alert" className="flex items-center gap-1.5 text-[13px] text-critical">
            <span aria-hidden>⚠️</span>
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="text-[13px] text-text-muted">{hint}</p>
        ) : null}
      </div>
    )
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & CampoProps>(
  function Select({ label, hint, error, className, id, children, ...props }, ref) {
    const gerado = useId()
    const selectId = id || gerado
    return (
      <div className={cn('space-y-1.5', className)}>
        {label && (
          <label htmlFor={selectId} className="block text-[13px] font-medium text-text-secondary">
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={cn(baseControle, 'h-10 cursor-pointer appearance-none pr-8', error && 'border-critical')}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='%23888' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")",
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
          }}
          {...props}
        >
          {children}
        </select>
        {error ? (
          <p role="alert" className="text-[13px] text-critical">{error}</p>
        ) : hint ? (
          <p className="text-[13px] text-text-muted">{hint}</p>
        ) : null}
      </div>
    )
  },
)

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }>(
  function Checkbox({ label, className, id, ...props }, ref) {
    const gerado = useId()
    const cbId = id || gerado
    return (
      <label htmlFor={cbId} className={cn('flex cursor-pointer select-none items-center gap-2.5 text-sm text-text-secondary', className)}>
        <input
          id={cbId}
          ref={ref}
          type="checkbox"
          className="h-4 w-4 cursor-pointer rounded border-border-strong bg-surface text-primary accent-[rgb(var(--primary))]"
          {...props}
        />
        {label}
      </label>
    )
  },
)
