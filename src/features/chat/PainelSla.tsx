import { relogios } from '@/shared/api/chat'
import type { Conversa } from '@/shared/api/types'
import { cn } from '@/shared/lib/cn'
import { dur } from './comum'

/**
 * Três relógios, não um. No chamado bastam dois (primeira resposta e resolução);
 * no chat o cliente sente também a ESPERA NA FILA — que é justamente a que não
 * aparece no painel de quem já está atendendo.
 *
 * A barra mostra o consumido contra a META, e o rótulo diz de quem é o tempo:
 * "espera do cliente" é diferente de "tempo da equipe".
 */
function Barra({ rotulo, valor, meta, ajuda, correndo }: {
  rotulo: string; valor: number; meta: number; ajuda: string; correndo?: boolean
}) {
  const razao = meta > 0 ? valor / meta : 0
  const estourou = razao > 1
  const perto = !estourou && razao > 0.75

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-medium text-text-secondary">
          {rotulo}
          {correndo && <span className="ml-1 text-[11px] font-normal text-text-muted">correndo</span>}
        </span>
        <span className={cn('text-[13px] font-semibold tabular-nums', estourou ? 'text-critical' : perto ? 'text-serious' : 'text-text')}>
          {dur(valor)} <span className="font-normal text-text-muted">/ {dur(meta)}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          role="progressbar"
          aria-label={rotulo}
          aria-valuenow={Math.round(razao * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ width: `${Math.min(razao, 1) * 100}%` }}
          className={cn('h-full rounded-full transition-[width] duration-500', estourou ? 'bg-critical' : perto ? 'bg-serious' : 'bg-primary')}
        />
      </div>
      <p className="text-[11px] leading-snug text-text-muted">{ajuda}</p>
    </div>
  )
}

export function PainelSla({ conversa }: { conversa: Conversa }) {
  const r = relogios(conversa)
  const naFila = conversa.situacao === 'na_fila'
  const pausado = conversa.situacao === 'aguardando_cliente'

  return (
    <div className="space-y-4">
      <Barra
        rotulo="Espera na fila"
        valor={r.fila}
        meta={r.metaFila}
        correndo={naFila}
        ajuda={naFila ? 'Ninguém assumiu ainda — este é o tempo que o cliente está olhando para a tela.' : 'Do "olá" até alguém assumir.'}
      />
      <Barra
        rotulo="Primeira resposta"
        valor={r.primeiraResposta}
        meta={r.metaResposta}
        correndo={!conversa.primeiraRespostaEm && conversa.situacao !== 'encerrada'}
        ajuda="Assumir não é responder: o relógio só para quando o cliente lê alguma coisa."
      />
      {r.aguardando > 0 && (
        <Barra
          rotulo="Sem resposta agora"
          valor={r.aguardando}
          meta={r.metaResposta}
          correndo
          ajuda="O cliente mandou a última mensagem e está esperando."
        />
      )}

      {pausado && (
        <p className="rounded-lg bg-surface-2 p-2 text-[12px] leading-relaxed text-text-secondary sm:p-4">
          <span aria-hidden>⏸️ </span>
          Relógio <strong className="text-text">pausado</strong>: a bola está com o cliente. Medir
          tempo que a equipe não controla é meta que ninguém respeita.
        </p>
      )}

      {conversa.transferencias > 0 && (
        <p className="rounded-lg border border-border bg-surface-2 p-2 text-[12px] leading-relaxed text-text-secondary sm:p-4">
          Passou por <strong className="text-text">{conversa.transferencias}</strong>{' '}
          {conversa.transferencias === 1 ? 'transferência' : 'transferências'} — e o relógio acima{' '}
          <strong className="text-text">não</strong> foi zerado por nenhuma delas.
        </p>
      )}
    </div>
  )
}
