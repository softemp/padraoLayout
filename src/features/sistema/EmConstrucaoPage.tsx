import { Link, useSearchParams } from 'react-router-dom'
import { Card } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'

/** Rota de exemplo: o menu inteiro navega, sem link morto no protótipo. */
export function EmConstrucaoPage() {
  const [params] = useSearchParams()
  const titulo = params.get('t') ?? 'Módulo'

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader titulo={titulo} descricao="Rota de exemplo do modelo de layout." />
      <Card>
        <EmptyState
          icone="🚧"
          titulo={`${titulo} ainda não faz parte do modelo`}
          descricao="Este projeto entrega a moldura, os componentes e as telas do piso. Os módulos de negócio nascem depois, dentro do produto real."
          acao={
            <Button variant="secondary" size="sm">
              <Link to="/">Voltar ao dashboard</Link>
            </Button>
          }
        />
      </Card>
    </div>
  )
}
