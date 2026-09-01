/** Formatação pt-BR centralizada — nenhuma tela chama Intl na mão. */

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const int = new Intl.NumberFormat('pt-BR')
const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 })
const dateShort = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

export const money = (v: number) => brl.format(v)
export const moneyCompact = (v: number) => brlCompact.format(v)
export const number = (v: number) => int.format(v)
export const numberCompact = (v: number) => compact.format(v)
export const percent = (v: number) => pct.format(v)
export const date = (v: string | Date) => dateShort.format(new Date(v))
export const datetime = (v: string | Date) => dateTime.format(new Date(v))

/** "há 3 min" — usado na lista de notificações. */
export function timeAgo(value: string | Date) {
  const diff = Date.now() - new Date(value).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'ontem' : `há ${d} dias`
}

export const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')

/** Máscaras de exibição — o "banco" guarda só dígitos. */
export const mascaraCnpj = (d: string) =>
  d.replace(/\D/g, '').slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5')

export const mascaraCep = (d: string) =>
  d.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')

export const mascaraTelefoneBr = (d: string) => {
  const n = d.replace(/\D/g, '').slice(0, 11)
  return n.length > 10
    ? n.replace(/^(\d{2})(\d{5})(\d)/, '($1) $2-$3')
    : n.replace(/^(\d{2})(\d{4})(\d)/, '($1) $2-$3')
}
