import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listarIntegracoes } from '@/shared/api/operacao'
import type { Integracao } from '@/shared/api/types'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { timeAgo } from '@/shared/lib/format'

const situacaoInfo: Record<Integracao['situacao'], { tom: 'good' | 'neutro' | 'critical'; rotulo: string }> = {
  conectada: { tom: 'good', rotulo: 'Conectada' },
  nao_configurada: { tom: 'neutro', rotulo: 'Não configurada' },
  falha: { tom: 'critical', rotulo: 'Falha na verificação' },
}

export function IntegracoesPage() {
  const { data, isLoading } = useQuery({ queryKey: ['integracoes'], queryFn: listarIntegracoes })
  const [testando, setTestando] = useState<string | null>(null)

  const testar = async (id: string) => {
    setTestando(id)
    await new Promise((r) => setTimeout(r, 900))
    setTestando(null)
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        titulo="Integrações"
        descricao="Os sistemas de fora com que este painel conversa — e a última vez que cada um respondeu."
        acoes={<Button><span aria-hidden>＋</span> Nova integração</Button>}
      />

      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardBody><Skeleton className="h-28 w-full" /></CardBody></Card>
          ))}

        {data?.map((integracao) => {
          const info = situacaoInfo[integracao.situacao]
          return (
            <Card key={integracao.id} className="flex flex-col">
              <CardBody className="flex-1 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-lg">
                      {integracao.icone}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-semibold text-text">{integracao.nome}</h3>
                      <p className="truncate text-[12px] text-text-muted">{integracao.categoria}</p>
                    </div>
                  </div>
                  <Badge tom={info.tom}>{info.rotulo}</Badge>
                </div>

                <p className="text-[13px] leading-relaxed text-text-secondary">{integracao.descricao}</p>

                <p className="text-[12px] text-text-muted">
                  {integracao.ultimaVerificacao
                    ? <>Última verificação {timeAgo(integracao.ultimaVerificacao)}</>
                    : <>Nunca verificada</>}
                </p>
              </CardBody>

              <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
                <Button size="sm" variant="secondary">
                  {integracao.situacao === 'nao_configurada' ? 'Configurar' : 'Editar credenciais'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={testando === integracao.id}
                  onClick={() => void testar(integracao.id)}
                  disabled={integracao.situacao === 'nao_configurada'}
                >
                  Testar
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader titulo="Credencial de integração segue a mesma regra de toda credencial" />
        <CardBody className="space-y-2 text-[13px] leading-relaxed text-text-secondary">
          <p>
            O segredo nunca volta do servidor — a leitura traz só os últimos dígitos — e campo vazio na
            edição significa <strong className="text-text">manter a chave atual</strong>. Toda integração
            tem botão de testar, porque credencial errada é indistinguível de credencial certa até
            alguém tentar usar.
          </p>
          <p>
            Os canais de comunicação têm tela própria, com o formulário de cada provedor:{' '}
            <Link to="/configuracoes/comunicacao" className="font-medium text-primary hover:underline">
              Configurações → Comunicação
            </Link>.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
