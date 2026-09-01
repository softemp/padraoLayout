import type { Empresa, EnderecoCep, Unidade } from './types'

/** Configurações da empresa — dados fictícios, mesmas regras do resto do modelo. */
const latencia = (ms = 380) => new Promise((r) => setTimeout(r, ms + Math.random() * 200))

const empresa: Empresa = {
  razaoSocial: 'SoftEmp Tecnologia e Sistemas Ltda',
  nomeFantasia: 'SoftEmp',
  cnpj: '19284736000158',
  inscricaoEstadual: '254.881.907',
  inscricaoMunicipal: '1.998.472-3',
  abertura: '2018-03-14',
  telefone: '4833334455',
  email: 'contato@softemp.com.br',
  site: 'https://softemp.com.br',
  cep: '88010100',
  logradouro: 'Rua Felipe Schmidt',
  numero: '515',
  complemento: 'Sala 902',
  bairro: 'Centro',
  cidade: 'Florianópolis',
  uf: 'SC',
  corPrimaria: '#2a78d6',
  logoUrl: null,
  regime: 'presumido',
  cnae: '6201-5/01',
  serieNota: '1',
  proximaNota: 4127,
  certificado: { nome: 'softemp_a1_2026.pfx', validade: '2027-02-18', instaladoEm: '2026-02-19' },
}

const unidades: Unidade[] = [
  { id: 1, nome: 'Matriz — Florianópolis', tipo: 'matriz', cnpj: '19284736000158', cidade: 'Florianópolis', uf: 'SC', ativa: true },
  { id: 2, nome: 'Filial São José', tipo: 'filial', cnpj: '19284736000239', cidade: 'São José', uf: 'SC', ativa: true },
  { id: 3, nome: 'Filial Curitiba', tipo: 'filial', cnpj: '19284736000310', cidade: 'Curitiba', uf: 'PR', ativa: false },
]

export async function obterEmpresa(): Promise<Empresa> {
  await latencia(300)
  return { ...empresa }
}

export async function salvarEmpresa(dados: Partial<Empresa>): Promise<Empresa> {
  await latencia(700)
  Object.assign(empresa, dados)
  return { ...empresa }
}

/**
 * Busca de endereço por CEP (aqui, mocada). No projeto real é uma chamada a
 * serviço externo — e ela FALHA: a tela precisa continuar aceitando o endereço
 * digitado à mão quando o serviço não responde.
 */
export async function buscarCep(cep: string): Promise<EnderecoCep> {
  await latencia(520)
  const digitos = cep.replace(/\D/g, '')
  if (digitos.length !== 8) throw new Error('CEP incompleto.')
  if (digitos.startsWith('00')) throw new Error('CEP não encontrado.')

  const catalogo: Record<string, EnderecoCep> = {
    '88010100': { logradouro: 'Rua Felipe Schmidt', bairro: 'Centro', cidade: 'Florianópolis', uf: 'SC' },
    '01310200': { logradouro: 'Avenida Paulista', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP' },
    '80010010': { logradouro: 'Rua XV de Novembro', bairro: 'Centro', cidade: 'Curitiba', uf: 'PR' },
  }
  return catalogo[digitos] ?? { logradouro: 'Rua Exemplo', bairro: 'Centro', cidade: 'Cidade Exemplo', uf: 'SC' }
}

export async function listarUnidades(): Promise<Unidade[]> {
  await latencia(280)
  return unidades.map((u) => ({ ...u }))
}

/**
 * Troca do certificado digital: recebe arquivo e senha, devolve só metadados.
 * O arquivo e a senha NUNCA voltam do servidor — a tela mostra nome e validade.
 */
export async function instalarCertificado(nomeArquivo: string): Promise<Empresa['certificado']> {
  await latencia(900)
  const validade = new Date()
  validade.setFullYear(validade.getFullYear() + 1)
  empresa.certificado = {
    nome: nomeArquivo,
    validade: validade.toISOString().slice(0, 10),
    instaladoEm: new Date().toISOString().slice(0, 10),
  }
  return empresa.certificado
}
