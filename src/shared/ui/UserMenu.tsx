import { useNavigate } from 'react-router-dom'
import { Avatar } from './Avatar'
import { Dropdown, DropdownItem } from './Dropdown'
import { cn } from '@/shared/lib/cn'

const usuario = { nome: 'Paulo Roberto', email: 'paulo@softemp.com.br', papel: 'Administrador' }

/**
 * Dropdown do usuário — mora na NAVBAR (não no rodapé da sidebar, que some
 * quando a sidebar está recolhida ou fechada no mobile: justo quando se
 * procura "Sair").
 */
export function UserMenu() {
  const navigate = useNavigate()

  return (
    <Dropdown
      rotuloGatilho={`Menu do usuário — ${usuario.nome}`}
      gatilho={(aberto) => (
        <span
          className={cn(
            'flex items-center gap-2 rounded-lg py-1 pl-1 pr-1 transition-colors sm:pr-2',
            'hover:bg-surface-2',
            aberto && 'bg-surface-2',
          )}
        >
          <Avatar nome={usuario.nome} />
          <span className="hidden min-w-0 text-left sm:block">
            <span className="block truncate text-[13px] font-semibold leading-4 text-text">{usuario.nome}</span>
            <span className="block truncate text-[11px] leading-4 text-text-muted">{usuario.papel}</span>
          </span>
          <span aria-hidden className="hidden text-[10px] text-text-muted sm:block">▾</span>
        </span>
      )}
    >
      {(fechar) => (
        <div>
          <div className="flex items-center gap-3 border-b border-border px-3.5 py-3">
            <Avatar nome={usuario.nome} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text">{usuario.nome}</p>
              <p className="truncate text-[13px] text-text-muted">{usuario.email}</p>
            </div>
          </div>
          <div className="py-1.5">
            <DropdownItem icone="👤" onClick={() => { fechar(); navigate('/perfil') }}>Perfil</DropdownItem>
            <DropdownItem icone="⚙️" onClick={() => { fechar(); navigate('/perfil?aba=preferencias') }}>Preferências</DropdownItem>
            <DropdownItem icone="❓" onClick={fechar}>Ajuda e suporte</DropdownItem>
          </div>
          <div className="border-t border-border py-1.5">
            <DropdownItem icone="🚪" tom="critico" onClick={() => { fechar(); navigate('/login') }}>Sair</DropdownItem>
          </div>
        </div>
      )}
    </Dropdown>
  )
}
