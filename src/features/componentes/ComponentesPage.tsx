import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { Checkbox, Input, Select } from '@/shared/ui/Field'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Meter } from '@/shared/ui/Meter'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { StatTile } from '@/shared/ui/StatTile'
import { BotaoExportar } from '@/shared/ui/BotaoExportar'
import { categorias, kpis } from '@/shared/api/mock-db'
import { money } from '@/shared/lib/format'

const TOKENS_SUPERFICIE = [
  { nome: 'bg', classe: 'bg-bg' },
  { nome: 'surface', classe: 'bg-surface' },
  { nome: 'surface-2', classe: 'bg-surface-2' },
  { nome: 'surface-3', classe: 'bg-surface-3' },
  { nome: 'border', classe: 'bg-border' },
  { nome: 'primary', classe: 'bg-primary' },
]
const TOKENS_STATUS = [
  { nome: 'good', classe: 'bg-good' },
  { nome: 'warning', classe: 'bg-warning' },
  { nome: 'serious', classe: 'bg-serious' },
  { nome: 'critical', classe: 'bg-critical' },
]
const SERIES = [1, 2, 3, 4, 5, 6]

/** Configuração de exportação usada nas demonstrações abaixo. */
const exportacaoDemo = {
  nomeArquivo: 'receita-por-linha',
  titulo: 'Receita por linha de produto',
  subtitulo: 'Mês corrente',
  rodape: 'Exemplo do kit de componentes',
  colunas: [
    { chave: 'categoria', cabecalho: 'Linha de produto', peso: 2, valor: (l: (typeof categorias)[number]) => l.categoria },
    {
      chave: 'valor',
      cabecalho: 'Receita',
      peso: 1,
      alinhamento: 'direita' as const,
      valor: (l: (typeof categorias)[number]) => money(l.valor),
      valorCsv: (l: (typeof categorias)[number]) => l.valor,
    },
  ],
  buscarLinhas: () => categorias,
}

function Secao({ titulo, descricao, children }: { titulo: string; descricao: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader titulo={titulo} descricao={descricao} />
      <CardBody className="flex flex-wrap items-end gap-3">{children}</CardBody>
    </Card>
  )
}

export function ComponentesPage() {
  return (
    <div className="space-y-2 sm:space-y-4 lg:space-y-6">
      <PageHeader
        titulo="Componentes"
        descricao="O inventário do kit: o que existe, como se chama e como se comporta nos dois temas."
      />

      <Secao titulo="Botões" descricao="Quatro variantes, três tamanhos, estado de carregando com anti-duplo-submit.">
        <Button>Primário</Button>
        <Button variant="secondary">Secundário</Button>
        <Button variant="ghost">Fantasma</Button>
        <Button variant="danger">Destrutivo</Button>
        <Button loading>Salvando</Button>
        <Button disabled>Desabilitado</Button>
        <Button size="sm">Pequeno</Button>
        <Button size="lg">Grande</Button>
      </Secao>

      <Secao titulo="Selos de status" descricao="Cor NUNCA sozinha: todo selo carrega ícone e rótulo.">
        <Badge tom="good">Ativo</Badge>
        <Badge tom="warning">Pendente</Badge>
        <Badge tom="serious">Em risco</Badge>
        <Badge tom="critical">Inadimplente</Badge>
        <Badge tom="info">Novo</Badge>
        <Badge>Inativo</Badge>
      </Secao>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4 lg:gap-6">
        <Card>
          <CardHeader titulo="Campos de formulário" descricao="Rótulo, dica, erro com papel de alerta e foco visível." />
          <CardBody className="space-y-4">
            <Input label="Nome" placeholder="Como devemos chamar você" />
            <Input label="E-mail" type="email" hint="Usamos só para avisos do sistema." placeholder="voce@empresa.com.br" />
            <Input label="Senha" type="password" error="Mínimo de 8 caracteres" defaultValue="123" />
            <Select label="Plano">
              <option>Starter</option>
              <option>Pro</option>
              <option>Enterprise</option>
            </Select>
            <Checkbox label="Manter conectado neste dispositivo" defaultChecked />
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader titulo="Medidor" descricao="Razão contra um limite — nunca uma pizza de duas fatias." />
            <CardBody className="space-y-4">
              <Meter rotulo="Receita do mês" valor={464812} total={455000} formatar={money} />
              <Meter rotulo="Armazenamento" valor={38} total={100} formatar={(n) => `${n} GB`} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader titulo="Carregando e vazio" descricao="Os dois estados que somem do protótipo e aparecem em produção." />
            <CardBody className="space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
              <div className="rounded-lg border border-dashed border-border">
                <EmptyState titulo="Nada por aqui" descricao="Quando não há resultado, a tela diz o que fazer a seguir." />
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader
          titulo="Exportação"
          descricao="Um componente, três saídas — e cada formato liga ou desliga por prop."
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <BotaoExportar {...exportacaoDemo} />
            <span className="text-[13px] text-text-muted">
              <code className="font-mono text-[12px]">formatos</code> ausente — os três ligados
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <BotaoExportar {...exportacaoDemo} formatos={{ csv: true }} rotulo="Baixar CSV" />
            <span className="text-[13px] text-text-muted">
              <code className="font-mono text-[12px]">{'{ csv: true }'}</code> — formato único vira botão direto, sem menu
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <BotaoExportar {...exportacaoDemo} formatos={{ pdf: true, imprimir: true }} variante="primary" />
            <span className="text-[13px] text-text-muted">
              <code className="font-mono text-[12px]">{'{ pdf: true, imprimir: true }'}</code> — sem planilha
            </span>
          </div>

          <ul className="space-y-1.5 border-t border-border pt-4 text-[13px] text-text-secondary">
            <li><strong className="text-text">CSV</strong> — separador <code className="font-mono text-[12px]">;</code> e BOM UTF-8 (Excel pt-BR abre certo); número vai cru, então a coluna soma.</li>
            <li><strong className="text-text">PDF</strong> — cabeçalho repetido em toda folha, linha nunca partida ao meio, “Página X de Y” no rodapé. Texto pesquisável, não imagem da tela.</li>
            <li><strong className="text-text">Imprimir</strong> — só o documento vai ao papel; sidebar, filtros e paginação somem. Mesmas regras de quebra, pela folha de impressão.</li>
            <li>Os três exportam a lista <strong className="text-text">inteira</strong> com os filtros aplicados — nunca só a página visível.</li>
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader titulo="Indicadores" descricao="Rótulo · valor · variação contra período nomeado · minigráfico." />
        <CardBody className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-4 lg:gap-6">
          {kpis.map((kpi) => <StatTile key={kpi.id} kpi={kpi} />)}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          titulo="Tokens de cor"
          descricao="Toda cor do projeto sai daqui. Zero hex nas telas — trocar o tema é trocar estas variáveis."
        />
        <CardBody className="space-y-6">
          <div>
            <p className="mb-2 text-[13px] font-medium text-text-secondary">Superfícies e marca</p>
            <div className="flex flex-wrap gap-3">
              {TOKENS_SUPERFICIE.map((t) => (
                <div key={t.nome} className="w-24">
                  <div className={`h-12 rounded-lg border border-border ${t.classe}`} />
                  <p className="mt-1.5 truncate font-mono text-[11px] text-text-muted">{t.nome}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-medium text-text-secondary">Status (fixos, nunca tematizados)</p>
            <div className="flex flex-wrap gap-3">
              {TOKENS_STATUS.map((t) => (
                <div key={t.nome} className="w-24">
                  <div className={`h-12 rounded-lg ${t.classe}`} />
                  <p className="mt-1.5 truncate font-mono text-[11px] text-text-muted">{t.nome}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-medium text-text-secondary">
              Séries de gráfico — ordem fixa, validada para daltonismo nos dois temas
            </p>
            <div className="flex flex-wrap gap-3">
              {SERIES.map((i) => (
                <div key={i} className="w-24">
                  <div className="h-12 rounded-lg" style={{ background: `rgb(var(--series-${i}))` }} />
                  <p className="mt-1.5 truncate font-mono text-[11px] text-text-muted">series-{i}</p>
                </div>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader titulo="Régua de espaçamento" descricao="Uma escala só: 2 → 4 → 6, em todos os eixos." />
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[12px] uppercase tracking-wide text-text-muted">
                  <th className="py-2 pr-4 font-semibold">Uso</th>
                  <th className="py-2 pr-4 font-semibold">Classe</th>
                  <th className="py-2 font-semibold">Regra</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                <tr className="border-b border-border/60">
                  <td className="py-2 pr-4 font-medium text-text">Padding de página</td>
                  <td className="py-2 pr-4 font-mono text-[12px]">px-2 sm:px-4 lg:px-6</td>
                  <td className="py-2">Sem <code className="font-mono">max-w</code>: o painel ocupa a tela inteira</td>
                </tr>
                <tr className="border-b border-border/60">
                  <td className="py-2 pr-4 font-medium text-text">Seções</td>
                  <td className="py-2 pr-4 font-mono text-[12px]">space-y-2 sm:space-y-4 lg:space-y-6</td>
                  <td className="py-2">Mesma escala do padding</td>
                </tr>
                <tr className="border-b border-border/60">
                  <td className="py-2 pr-4 font-medium text-text">Grades</td>
                  <td className="py-2 pr-4 font-mono text-[12px]">gap-2 sm:gap-4 lg:gap-6</td>
                  <td className="py-2">Cresce monotonicamente por breakpoint</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-text">Texto corrido</td>
                  <td className="py-2 pr-4 font-mono text-[12px]">max-w-prose</td>
                  <td className="py-2">Única largura máxima que existe no projeto</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
