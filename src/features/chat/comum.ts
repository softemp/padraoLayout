import type { CanalChat, SituacaoConversa, StatusAtendente } from '@/shared/api/types'

export const dur = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`)

export const CANAL: Record<CanalChat, { icone: string; rotulo: string }> = {
  whatsapp: { icone: '💬', rotulo: 'WhatsApp' },
  site: { icone: '🌐', rotulo: 'Site' },
  email: { icone: '✉️', rotulo: 'E-mail' },
  telefone: { icone: '📞', rotulo: 'Telefone' },
}

export const SITUACAO: Record<SituacaoConversa, { rotulo: string; tom: 'neutro' | 'info' | 'good' | 'warning' }> = {
  na_fila: { rotulo: 'Na fila', tom: 'warning' },
  em_atendimento: { rotulo: 'Em atendimento', tom: 'info' },
  aguardando_cliente: { rotulo: 'Aguardando cliente', tom: 'neutro' },
  encerrada: { rotulo: 'Encerrada', tom: 'good' },
}

export const STATUS: Record<StatusAtendente, { rotulo: string; cor: string }> = {
  disponivel: { rotulo: 'Disponível', cor: 'bg-good' },
  ocupado: { rotulo: 'Ocupado', cor: 'bg-warning' },
  ausente: { rotulo: 'Ausente', cor: 'bg-serious' },
  offline: { rotulo: 'Offline', cor: 'bg-border-strong' },
}
