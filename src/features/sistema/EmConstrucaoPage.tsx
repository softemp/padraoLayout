import { Link } from 'react-router-dom'
import { Card } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'

/**
 * Rota de exemplo: o menu inteiro navega, sem link morto no protótipo. Cada módulo ganha ROTA PRÓPRIA e passa o
 * título por prop — nunca `/em-construcao?t=Titulo` (Base_Frontend_URL_Limpa_Estado_De_Navegacao).
 */
export function EmConstrucaoPage({ titulo = 'Módulo' }: { titulo?: string }) {

  return (
    <div className="space-y-2 sm:space-y-4 lg:space-y-6">
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
