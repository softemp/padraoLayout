import type { TipoIdentificador } from '@/app/auth-config'

/**
 * Login por e-mail, telefone OU CPF em um campo só.
 *
 * Três campos separados (ou um seletor "entrar com…") obrigam a pessoa a
 * declarar o que ela já digitou. O tipo é DETECTADO pelo formato — e o que a
 * tela detecta é dica visual: o servidor decide de novo, sempre.
 */
export function detectarTipo(valor: string): TipoIdentificador | null {
  const limpo = valor.trim()
  if (!limpo) return null
  if (limpo.includes('@')) return 'email'

  const digitos = limpo.replace(/\D/g, '')
  if (!digitos) return null
  // 11 dígitos é ambíguo no Brasil (celular com DDD e CPF). O 9 na terceira
  // casa é o que separa: todo celular tem, CPF só por coincidência — e aí o
  // servidor resolve, tentando os dois.
  if (digitos.length === 11) return digitos[2] === '9' ? 'telefone' : 'cpf'
  if (digitos.length === 10) return 'telefone'
  if (digitos.length > 11) return 'telefone'
  return 'cpf'
}

/** Máscara de exibição — o valor enviado vai sempre só com dígitos. */
export function formatarIdentificador(valor: string): string {
  const tipo = detectarTipo(valor)
  if (tipo === 'email' || tipo === null) return valor
  const d = valor.replace(/\D/g, '').slice(0, 11)

  if (tipo === 'cpf') {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
  }
  return d
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/^\((\d{2})\) (\d{5})(\d)/, '($1) $2-$3')
    .replace(/^\((\d{2})\) (\d{4})(\d)/, '($1) $2-$3')
}

/** Destino ofuscado: confirma o canal sem revelar o dado de quem não é dono. */
export const mascararEmail = (email: string) => {
  const [usuario, dominio = ''] = email.split('@')
  const visivel = usuario.slice(0, 2)
  return `${visivel}${'•'.repeat(Math.max(usuario.length - 2, 3))}@${dominio}`
}

export const mascararTelefone = (telefone: string) => {
  const d = telefone.replace(/\D/g, '')
  return `(${d.slice(0, 2)}) •••••-${d.slice(-4)}`
}
