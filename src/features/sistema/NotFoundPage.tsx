import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <p className="text-5xl font-semibold tracking-tight text-text">404</p>
      <p className="max-w-prose text-text-muted">
        A página que você procurou não existe — ou mudou de endereço.
      </p>
      <Link
        to="/"
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-text-inverse transition-colors hover:bg-primary-hover"
      >
        Voltar ao dashboard
      </Link>
    </div>
  )
}
