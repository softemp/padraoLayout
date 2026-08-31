import type { ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

/**
 * Confirmação para ação irreversível. Regras que valem sempre:
 *  - o botão diz O QUE vai acontecer ("Excluir em definitivo"), nunca "OK";
 *  - o texto nomeia o alvo, para ninguém apagar a linha errada;
 *  - cancelar é o caminho fácil (Esc, clique fora, botão à esquerda).
 */
export function ConfirmarAcao({
  aberto, titulo, mensagem, rotuloConfirmar, tom = 'danger', carregando, onConfirmar, onCancelar,
}: {
  aberto: boolean
  titulo: string
  mensagem: ReactNode
  rotuloConfirmar: string
  tom?: 'danger' | 'primary'
  carregando?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}) {
  return (
    <Modal
      aberto={aberto}
      titulo={titulo}
      onFechar={carregando ? () => {} : onCancelar}
      largura="max-w-md"
      rodape={
        <>
          <Button variant="ghost" onClick={onCancelar} disabled={carregando}>Cancelar</Button>
          <Button variant={tom} onClick={onConfirmar} loading={carregando} data-foco-inicial>
            {rotuloConfirmar}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-text-secondary">{mensagem}</div>
    </Modal>
  )
}
