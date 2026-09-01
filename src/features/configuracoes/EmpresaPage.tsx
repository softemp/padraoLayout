import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { buscarCep, instalarCertificado, listarUnidades, obterEmpresa, salvarEmpresa } from '@/shared/api/empresa'
import type { Empresa } from '@/shared/api/types'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { Input, Select } from '@/shared/ui/Field'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { date, mascaraCep, mascaraCnpj, mascaraTelefoneBr } from '@/shared/lib/format'

const ABAS = [
  { id: 'dados', rotulo: 'Dados da empresa', icone: '🏢' },
  { id: 'endereco', rotulo: 'Endereço', icone: '📍' },
  { id: 'identidade', rotulo: 'Identidade visual', icone: '🎨' },
  { id: 'fiscal', rotulo: 'Fiscal', icone: '🧾' },
  { id: 'unidades', rotulo: 'Unidades', icone: '🏬' },
] as const
type AbaId = (typeof ABAS)[number]['id']

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

const schema = z.object({
  razaoSocial: z.string().min(3, 'Informe a razão social'),
  nomeFantasia: z.string().min(2, 'Informe o nome fantasia'),
  // Guardamos dígitos; a máscara é só o que a pessoa vê.
  cnpj: z.string().transform((v) => v.replace(/\D/g, '')).refine((v) => v.length === 14, 'CNPJ incompleto'),
  inscricaoEstadual: z.string().optional().default(''),
  inscricaoMunicipal: z.string().optional().default(''),
  abertura: z.string().optional().default(''),
  telefone: z.string().transform((v) => v.replace(/\D/g, '')).refine((v) => v.length >= 10, 'Telefone incompleto'),
  email: z.string().email('E-mail inválido'),
  site: z.string().optional().default(''),
  cep: z.string().transform((v) => v.replace(/\D/g, '')).refine((v) => v.length === 8, 'CEP incompleto'),
  logradouro: z.string().min(3, 'Informe o logradouro'),
  numero: z.string().min(1, 'Informe o número'),
  complemento: z.string().optional().default(''),
  bairro: z.string().min(2, 'Informe o bairro'),
  cidade: z.string().min(2, 'Informe a cidade'),
  uf: z.string().length(2, 'UF'),
  corPrimaria: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use #rrggbb'),
  regime: z.enum(['simples', 'presumido', 'real', 'mei']),
  cnae: z.string().optional().default(''),
  serieNota: z.string().optional().default(''),
  proximaNota: z.coerce.number().int().min(1, 'Deve ser maior que zero'),
})
type Formulario = z.infer<typeof schema>

export function EmpresaPage() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const aba = (params.get('aba') ?? 'dados') as AbaId

  const [salvo, setSalvo] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [erroCep, setErroCep] = useState<string | null>(null)

  const { data: empresa, isLoading } = useQuery({ queryKey: ['empresa'], queryFn: obterEmpresa })
  const { data: unidades } = useQuery({ queryKey: ['empresa-unidades'], queryFn: listarUnidades })

  const { register, handleSubmit, formState, reset, setValue, watch, getValues } = useForm<Formulario>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (empresa) {
      reset({
        ...empresa,
        cnpj: mascaraCnpj(empresa.cnpj),
        telefone: mascaraTelefoneBr(empresa.telefone),
        cep: mascaraCep(empresa.cep),
      } as unknown as Formulario)
    }
  }, [empresa, reset])

  const salvar = useMutation({
    mutationFn: (dados: Formulario) => salvarEmpresa(dados as Partial<Empresa>),
    onSuccess: (nova) => {
      void qc.invalidateQueries({ queryKey: ['empresa'] })
      reset({ ...nova, cnpj: mascaraCnpj(nova.cnpj), telefone: mascaraTelefoneBr(nova.telefone), cep: mascaraCep(nova.cep) } as unknown as Formulario)
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2600)
    },
  })

  const certificado = useMutation({
    mutationFn: instalarCertificado,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['empresa'] }),
  })

  /**
   * CEP preenche o endereço, mas NÃO trava: o serviço externo falha, e o
   * operador precisa poder digitar à mão quando isso acontecer.
   */
  const preencherPeloCep = async () => {
    setErroCep(null)
    setBuscandoCep(true)
    try {
      const endereco = await buscarCep(getValues('cep'))
      setValue('logradouro', endereco.logradouro, { shouldDirty: true })
      setValue('bairro', endereco.bairro, { shouldDirty: true })
      setValue('cidade', endereco.cidade, { shouldDirty: true })
      setValue('uf', endereco.uf, { shouldDirty: true })
    } catch (e) {
      setErroCep((e as Error).message + ' Preencha o endereço manualmente.')
    } finally {
      setBuscandoCep(false)
    }
  }

  const cor = watch('corPrimaria') || '#2a78d6'
  const validadeCert = empresa?.certificado ? new Date(empresa.certificado.validade) : null
  const diasParaVencer = validadeCert ? Math.round((+validadeCert - Date.now()) / 86400000) : null

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit((dados) => salvar.mutate(dados))} noValidate className="space-y-4 sm:space-y-5">
      <PageHeader
        titulo="Configurações da empresa"
        descricao="Os dados que saem em documento, nota e comunicação — uma fonte só para o sistema inteiro."
      />

      <div role="tablist" aria-label="Seções da empresa" className="flex flex-wrap items-center gap-1 border-b border-border">
        {ABAS.map((item) => {
          const ativa = aba === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => setParams({ aba: item.id }, { replace: true })}
              className={cn(
                '-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors',
                ativa ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:border-border-strong hover:text-text',
              )}
            >
              <span aria-hidden>{item.icone}</span>
              {item.rotulo}
            </button>
          )
        })}
      </div>

      {aba === 'dados' && (
        <Card>
          <CardHeader titulo="Dados cadastrais" descricao="Aparecem em nota fiscal, contrato e rodapé de e-mail" />
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Razão social" className="sm:col-span-2" error={formState.errors.razaoSocial?.message} {...register('razaoSocial')} />
            <Input label="Nome fantasia" error={formState.errors.nomeFantasia?.message} {...register('nomeFantasia')} />
            <Input
              label="CNPJ"
              inputMode="numeric"
              error={formState.errors.cnpj?.message}
              {...register('cnpj', { onChange: (e) => setValue('cnpj', mascaraCnpj(e.target.value), { shouldDirty: true }) })}
            />
            <Input label="Inscrição estadual" {...register('inscricaoEstadual')} />
            <Input label="Inscrição municipal" {...register('inscricaoMunicipal')} />
            <Input label="Data de abertura" type="date" {...register('abertura')} />
            <Input
              label="Telefone"
              inputMode="numeric"
              error={formState.errors.telefone?.message}
              {...register('telefone', { onChange: (e) => setValue('telefone', mascaraTelefoneBr(e.target.value), { shouldDirty: true }) })}
            />
            <Input label="E-mail" type="email" error={formState.errors.email?.message} {...register('email')} />
            <Input label="Site" placeholder="https://" {...register('site')} />
          </CardBody>
        </Card>
      )}

      {aba === 'endereco' && (
        <Card>
          <CardHeader titulo="Endereço" descricao="Usado na nota fiscal e na correspondência" />
          <CardBody className="space-y-4">
            {erroCep && (
              <p role="alert" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-[13px] text-text-secondary">
                <span aria-hidden>⚠️</span>{erroCep}
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
              <div className="sm:col-span-2">
                <Input
                  label="CEP"
                  inputMode="numeric"
                  error={formState.errors.cep?.message}
                  {...register('cep', { onChange: (e) => setValue('cep', mascaraCep(e.target.value), { shouldDirty: true }) })}
                />
              </div>
              <div className="flex items-end sm:col-span-2">
                <Button type="button" variant="secondary" loading={buscandoCep} onClick={() => void preencherPeloCep()}>
                  Buscar endereço
                </Button>
              </div>

              <Input label="Logradouro" className="sm:col-span-4" error={formState.errors.logradouro?.message} {...register('logradouro')} />
              <Input label="Número" className="sm:col-span-1" error={formState.errors.numero?.message} {...register('numero')} />
              <Input label="Complemento" className="sm:col-span-1" {...register('complemento')} />
              <Input label="Bairro" className="sm:col-span-2" error={formState.errors.bairro?.message} {...register('bairro')} />
              <Input label="Cidade" className="sm:col-span-3" error={formState.errors.cidade?.message} {...register('cidade')} />
              <Select label="UF" className="sm:col-span-1" error={formState.errors.uf?.message} {...register('uf')}>
                {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </Select>
            </div>
          </CardBody>
        </Card>
      )}

      {aba === 'identidade' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader titulo="Marca" descricao="Logo e cor que aparecem no painel, no PDF e no e-mail" />
            <CardBody className="space-y-5">
              <div className="flex flex-wrap items-center gap-4">
                <span aria-hidden className="grid h-16 w-16 shrink-0 place-items-center rounded-xl text-lg font-bold text-white" style={{ background: cor }}>
                  SE
                </span>
                <div className="space-y-2">
                  <Button type="button" variant="secondary" size="sm">Enviar logo</Button>
                  <p className="text-[12px] text-text-muted">PNG ou SVG, fundo transparente, no mínimo 512 px.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Cor principal" placeholder="#2a78d6" error={formState.errors.corPrimaria?.message} {...register('corPrimaria')} />
                <div className="flex items-end">
                  <div className="flex h-10 w-full items-center gap-2 rounded-lg border border-border px-3">
                    <span aria-hidden className="h-5 w-5 rounded" style={{ background: cor }} />
                    <span className="text-[13px] text-text-muted">Prévia da cor</span>
                  </div>
                </div>
              </div>

              {/* A cor da marca não substitui os tokens do tema: ela pinta a
                  marca, não a interface inteira — texto sobre cor arbitrária
                  quebra contraste em metade das telas. */}
              <p className="rounded-lg bg-surface-2 px-3.5 py-3 text-[12px] text-text-secondary">
                A cor da marca é usada na logo, no cabeçalho dos documentos e nos e-mails. A interface
                continua seguindo os tokens de tema — repintar o painel inteiro com uma cor livre quebra
                o contraste no tema escuro.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader titulo="Onde aparece" />
            <CardBody>
              <ul className="space-y-2 text-[13px] text-text-secondary">
                <li>• Cabeçalho do PDF exportado</li>
                <li>• Folha de impressão das listagens</li>
                <li>• Assinatura dos e-mails transacionais</li>
                <li>• Tela de login e favicon</li>
              </ul>
            </CardBody>
          </Card>
        </div>
      )}

      {aba === 'fiscal' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader titulo="Regime e numeração" descricao="Base do cálculo de imposto e da emissão" />
            <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select label="Regime tributário" {...register('regime')}>
                <option value="simples">Simples Nacional</option>
                <option value="presumido">Lucro Presumido</option>
                <option value="real">Lucro Real</option>
                <option value="mei">MEI</option>
              </Select>
              <Input label="CNAE principal" {...register('cnae')} />
              <Input label="Série da nota" {...register('serieNota')} />
              <Input
                label="Próximo número"
                type="number"
                min={1}
                hint="Alterar reinicia a sequência — confira com a contabilidade."
                error={formState.errors.proximaNota?.message}
                {...register('proximaNota')}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader titulo="Certificado digital" descricao="A1, usado para assinar a emissão" />
            <CardBody className="space-y-3">
              {empresa?.certificado ? (
                <>
                  <div className="rounded-lg border border-border bg-surface-2 p-3.5">
                    <p className="truncate font-mono text-[12px] text-text">{empresa.certificado.nome}</p>
                    <p className="mt-1.5 text-[13px] text-text-secondary">
                      Válido até <strong className="text-text">{date(empresa.certificado.validade)}</strong>
                    </p>
                    <p className="mt-0.5 text-[12px] text-text-muted">
                      Instalado em {date(empresa.certificado.instaladoEm)}
                    </p>
                  </div>

                  {/* Certificado vencido para a emissão inteira, e o aviso
                      precisa vir ANTES do vencimento — descobrir no dia é
                      descobrir com a nota travada. */}
                  {diasParaVencer !== null && (
                    <Badge tom={diasParaVencer < 0 ? 'critical' : diasParaVencer < 30 ? 'warning' : 'good'}>
                      {diasParaVencer < 0
                        ? `Vencido há ${Math.abs(diasParaVencer)} dias`
                        : diasParaVencer < 30
                          ? `Vence em ${diasParaVencer} dias`
                          : 'Dentro da validade'}
                    </Badge>
                  )}
                </>
              ) : (
                <p className="text-[13px] text-text-muted">Nenhum certificado instalado.</p>
              )}

              <Button
                type="button"
                variant="secondary"
                block
                loading={certificado.isPending}
                onClick={() => certificado.mutate('softemp_a1_novo.pfx')}
              >
                Trocar certificado
              </Button>

              <p className="text-[12px] text-text-muted">
                O arquivo e a senha não voltam do servidor: a tela mostra nome e validade. Trocar exige
                enviar o arquivo de novo.
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      {aba === 'unidades' && (
        <Card>
          <CardHeader
            titulo="Unidades"
            descricao="Matriz e filiais — cada uma com o próprio CNPJ"
            acoes={<Button type="button" size="sm">＋ Nova unidade</Button>}
          />
          <ul className="divide-y divide-border">
            {unidades?.map((unidade) => (
              <li key={unidade.id} className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5">
                <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-base">
                  {unidade.tipo === 'matriz' ? '🏢' : '🏬'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-text">{unidade.nome}</p>
                  <p className="truncate text-[12px] text-text-muted">
                    {mascaraCnpj(unidade.cnpj)} · {unidade.cidade}/{unidade.uf}
                  </p>
                </div>
                <Badge tom={unidade.tipo === 'matriz' ? 'info' : 'neutro'}>
                  {unidade.tipo === 'matriz' ? 'Matriz' : 'Filial'}
                </Badge>
                <Badge tom={unidade.ativa ? 'good' : 'neutro'}>{unidade.ativa ? 'Ativa' : 'Inativa'}</Badge>
                <Button type="button" size="sm" variant="ghost">Editar</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Barra de gravação: só aparece com alteração pendente, e acompanha a
          rolagem — formulário longo com o botão salvar lá no fim é como a
          alteração se perde. */}
      {(formState.isDirty || salvo) && (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-surface px-4 py-3 shadow-pop">
          <p className="text-[13px] text-text-secondary">
            {salvo ? (
              <span className="flex items-center gap-1.5 font-medium text-good"><span aria-hidden>✔</span> Alterações salvas</span>
            ) : (
              'Há alterações não salvas nesta tela.'
            )}
          </p>
          {!salvo && (
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => reset()} disabled={salvar.isPending}>Descartar</Button>
              <Button type="submit" loading={salvar.isPending}>Salvar alterações</Button>
            </div>
          )}
        </div>
      )}
    </form>
  )
}
