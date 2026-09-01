import { useState } from 'react'
import { destinosTransferencia } from '@/shared/api/chat'
import type { Conversa } from '@/shared/api/types'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'
import { cn } from '@/shared/lib/cn'
import { STATUS } from './comum'

/**
 * O destino é ESCOLHIDO de uma lista, nunca digitado — e a lista mostra por que
 * cada pessoa indisponível está indisponível. Esconder quem não pode receber faz
 * o atendente procurar a pessoa que "sumiu"; mostrar com o impedimento resolve a
 * dúvida antes de ela virar pergunta no grupo.
 */
export function TransferirModal({
  conversa, aberto, onFechar, onTransferir, carregando, erro,
}: {
  conversa: Conversa
  aberto: boolean
  onFechar: () => void
  onTransferir: (para: string, motivo: string) => void
  carregando: boolean
  erro: string | null
}) {
  const [para, setPara] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const destinos = destinosTransferencia(conversa.id)
  const curto = motivo.trim().length < 10

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Transferir atendimento"
      descricao={`${conversa.protocolo} · ${conversa.cliente}`}
      largura="max-w-xl"
      rodape={
        <>
          <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
          <Button
            disabled={!para || curto}
            loading={carregando}
            onClick={() => para && onTransferir(para, motivo)}
          >
            Pedir transferência
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-lg bg-surface-2 p-2 text-[12px] leading-relaxed text-text-secondary sm:p-4">
          O relógio do cliente <strong className="text-text">continua correndo</strong>: transferir
          não zera o SLA. A conversa só muda de mão quando a outra pessoa aceitar — até lá segue
          com você.
        </p>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-[13px] font-medium text-text-secondary">Para quem</legend>
          {destinos.map((a) => {
            const bloqueado = a.impedimento !== null
            const escolhido = para === a.nome
            return (
              <button
                key={a.nome}
                type="button"
                disabled={bloqueado}
                aria-pressed={escolhido}
                onClick={() => setPara(a.nome)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors sm:p-4',
                  bloqueado && 'cursor-not-allowed opacity-55',
                  escolhido ? 'border-primary bg-primary/8' : 'border-border hover:border-border-strong hover:bg-surface-2',
                )}
              >
                <span className="relative shrink-0">
                  <Avatar nome={a.nome} size="sm" />
                  <span
                    aria-hidden
                    className={cn('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface', STATUS[a.status].cor)}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-text">{a.nome}</span>
                  <span className="block truncate text-[12px] text-text-muted">
                    {a.equipe} · {STATUS[a.status].rotulo} · {a.emAtendimento}/{a.capacidade} conversas
                  </span>
                </span>
                {bloqueado && (
                  <span className="shrink-0 text-[12px] font-medium text-serious">{a.impedimento}</span>
                )}
              </button>
            )
          })}
        </fieldset>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-text-secondary">
            Motivo e contexto <span className="text-critical">*</span>
          </span>
          <textarea
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="O que já foi feito e por que precisa de outra pessoa"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
          <span className={cn('mt-1 block text-[12px]', curto ? 'text-text-muted' : 'text-good')}>
            {curto
              ? 'Sem contexto, o cliente repete tudo de novo para o próximo atendente.'
              : 'Contexto suficiente — quem receber já entra sabendo.'}
          </span>
        </label>

        {conversa.transferencias >= 2 && (
          <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-text-secondary">
            <span aria-hidden>⚠️ </span>
            Esta conversa já mudou de mão {conversa.transferencias}×. Passar de novo costuma ser
            problema de <strong className="text-text">roteamento</strong>, não de atendente — vale
            revisar para onde esse assunto entra.
          </p>
        )}

        {erro && (
          <p role="alert" className="rounded-lg border border-critical/40 bg-critical/10 px-4 py-3 text-[13px] text-text-secondary">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}
