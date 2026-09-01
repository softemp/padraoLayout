import type { CanalReserva, Comodidade, SituacaoReserva, TipoUnidade } from '@/shared/api/types'

export const TIPO: Record<TipoUnidade, { rotulo: string; icone: string }> = {
  quarto: { rotulo: 'Quarto', icone: '🛏️' },
  suite: { rotulo: 'Suíte', icone: '🛎️' },
  chale: { rotulo: 'Chalé', icone: '🏡' },
  cabana: { rotulo: 'Cabana', icone: '🌲' },
}

export const COMODIDADE: Record<Comodidade, { rotulo: string; icone: string }> = {
  ar_condicionado: { rotulo: 'Ar-condicionado', icone: '❄️' },
  wifi: { rotulo: 'Wi-Fi', icone: '📶' },
  tv: { rotulo: 'TV', icone: '📺' },
  frigobar: { rotulo: 'Frigobar', icone: '🧊' },
  cozinha: { rotulo: 'Cozinha', icone: '🍳' },
  hidro: { rotulo: 'Hidromassagem', icone: '🛁' },
  lareira: { rotulo: 'Lareira', icone: '🔥' },
  varanda: { rotulo: 'Varanda', icone: '🪟' },
  vista_mar: { rotulo: 'Vista para o mar', icone: '🌊' },
  churrasqueira: { rotulo: 'Churrasqueira', icone: '🍖' },
  aceita_pet: { rotulo: 'Aceita pet', icone: '🐾' },
  acessivel: { rotulo: 'Acessível', icone: '♿' },
  estacionamento: { rotulo: 'Estacionamento', icone: '🅿️' },
}

export const SITUACAO: Record<SituacaoReserva, { rotulo: string; tom: 'neutro' | 'info' | 'good' | 'warning' | 'critical'; barra: string }> = {
  pre_reserva: { rotulo: 'Pré-reserva', tom: 'warning', barra: 'bg-warning/70 text-text' },
  confirmada: { rotulo: 'Confirmada', tom: 'info', barra: 'bg-primary text-text-inverse' },
  hospedado: { rotulo: 'Hospedado', tom: 'good', barra: 'bg-good text-text-inverse' },
  finalizada: { rotulo: 'Finalizada', tom: 'neutro', barra: 'bg-border-strong text-text' },
  cancelada: { rotulo: 'Cancelada', tom: 'critical', barra: 'bg-critical/60 text-text-inverse' },
  no_show: { rotulo: 'No-show', tom: 'critical', barra: 'bg-critical text-text-inverse' },
}

export const CANAL: Record<CanalReserva, string> = {
  direto: 'Direto', telefone: 'Telefone', site: 'Site', ota: 'OTA (Booking/Airbnb)', balcao: 'Balcão',
}

export const diaSemana = (data: string) =>
  ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(`${data}T12:00:00`).getDay()]
export const diaMes = (data: string) => data.slice(8, 10)
