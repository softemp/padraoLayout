/**
 * O que a área de acesso oferece NESTE produto.
 *
 * É configuração, não código de tela: um projeto aceita só e-mail, outro
 * aceita CPF e telefone; um exige 2FA, outro não. As telas leem daqui —
 * ligar um canal não deveria exigir editar JSX.
 */
export type TipoIdentificador = 'email' | 'telefone' | 'cpf'
export type CanalRecuperacao = 'email' | 'whatsapp' | 'sms'

export type ConfigAcesso = {
  /** Formas aceitas no campo de identificação do login. */
  identificadores: TipoIdentificador[]
  /** Segundo fator exigido depois da senha. */
  segundoFator: boolean
  /** Canais oferecidos na recuperação de senha, na ordem de exibição. */
  canaisRecuperacao: CanalRecuperacao[]
  /** Auto-cadastro na landing (define o link "Criar conta" no login). */
  autoCadastro: boolean
}

export const configAcesso: ConfigAcesso = {
  identificadores: ['email', 'telefone', 'cpf'],
  segundoFator: true,
  canaisRecuperacao: ['email', 'whatsapp', 'sms'],
  autoCadastro: true,
}

export const rotuloIdentificador: Record<TipoIdentificador, string> = {
  email: 'E-mail',
  telefone: 'Telefone',
  cpf: 'CPF',
}

export const canais: Record<CanalRecuperacao, { rotulo: string; icone: string; descricao: string }> = {
  email: { rotulo: 'E-mail', icone: '✉️', descricao: 'Enviamos o link para o e-mail cadastrado' },
  whatsapp: { rotulo: 'WhatsApp', icone: '💬', descricao: 'O link chega em uma mensagem do nosso número oficial' },
  sms: { rotulo: 'SMS', icone: '📱', descricao: 'Mensagem de texto para o celular cadastrado' },
}
