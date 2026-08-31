import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { verificarSegundoFator } from '@/shared/api/api'
import { Button } from '@/shared/ui/Button'
import { cn } from '@/shared/lib/cn'
import { AuthCard } from './AuthLayout'

const TAMANHO = 6
const ESPERA_REENVIO = 30

/**
 * Segundo fator. Seis casas separadas em vez de um campo só porque o código
 * chega em pedaços na cabeça de quem lê ("482 917") — e porque colar o código
 * inteiro precisa funcionar, o que aqui é tratado no onPaste.
 */
export function VerificacaoPage() {
  const navigate = useNavigate()
  const [digitos, setDigitos] = useState<string[]>(Array(TAMANHO).fill(''))
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [espera, setEspera] = useState(ESPERA_REENVIO)
  const campos = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { campos.current[0]?.focus() }, [])

  useEffect(() => {
    if (espera <= 0) return
    const t = setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [espera])

  const codigo = digitos.join('')

  const enviar = async (valor = codigo) => {
    if (valor.length !== TAMANHO) return
    setErro(null)
    setEnviando(true)
    try {
      await verificarSegundoFator(valor)
      navigate('/')
    } catch {
      setErro('Código inválido ou expirado. Peça um novo e tente de novo.')
      setDigitos(Array(TAMANHO).fill(''))
      campos.current[0]?.focus()
    } finally {
      setEnviando(false)
    }
  }

  const escrever = (indice: number, valor: string) => {
    const limpo = valor.replace(/\D/g, '')
    if (!limpo) return
    const novos = [...digitos]
    // Colar o código inteiro preenche tudo de uma vez.
    limpo.split('').forEach((d, i) => { if (indice + i < TAMANHO) novos[indice + i] = d })
    setDigitos(novos)
    const proximo = Math.min(indice + limpo.length, TAMANHO - 1)
    campos.current[proximo]?.focus()
    if (novos.every(Boolean)) void enviar(novos.join(''))
  }

  const apagar = (indice: number) => {
    const novos = [...digitos]
    if (novos[indice]) novos[indice] = ''
    else if (indice > 0) { novos[indice - 1] = ''; campos.current[indice - 1]?.focus() }
    setDigitos(novos)
  }

  return (
    <AuthCard
      titulo="Verificação em duas etapas"
      descricao="Digite o código de 6 dígitos do seu aplicativo autenticador."
      rodape={<Link to="/login" className="font-medium text-primary hover:underline">← Voltar para o login</Link>}
    >
      <div className="space-y-4">
        {erro && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-critical/30 bg-critical/10 px-3 py-2.5 text-[13px] text-critical">
            <span aria-hidden>⚠️</span>{erro}
          </p>
        )}

        <div className="flex justify-between gap-2" onPaste={(e) => { e.preventDefault(); escrever(0, e.clipboardData.getData('text')) }}>
          {digitos.map((digito, i) => (
            <input
              key={i}
              ref={(el) => { campos.current[i] = el }}
              value={digito}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              aria-label={`Dígito ${i + 1} de ${TAMANHO}`}
              onChange={(e) => escrever(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace') { e.preventDefault(); apagar(i) }
                if (e.key === 'ArrowLeft') campos.current[i - 1]?.focus()
                if (e.key === 'ArrowRight') campos.current[i + 1]?.focus()
              }}
              className={cn(
                'h-14 w-full rounded-lg border bg-surface text-center text-xl font-semibold tabular-nums text-text',
                'transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25',
                erro ? 'border-critical' : 'border-border',
              )}
            />
          ))}
        </div>

        <Button block size="lg" loading={enviando} disabled={codigo.length !== TAMANHO} onClick={() => void enviar()}>
          Confirmar
        </Button>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
          <button
            type="button"
            disabled={espera > 0}
            onClick={() => setEspera(ESPERA_REENVIO)}
            className="font-medium text-primary hover:underline disabled:text-text-muted disabled:no-underline"
          >
            {espera > 0 ? `Reenviar em ${espera}s` : 'Reenviar código'}
          </button>
          <button type="button" className="font-medium text-text-secondary hover:text-text hover:underline">
            Usar um código de recuperação
          </button>
        </div>

        <p className="text-center text-[12px] text-text-muted">Demonstração: qualquer código serve, menos 000000.</p>
      </div>
    </AuthCard>
  )
}
