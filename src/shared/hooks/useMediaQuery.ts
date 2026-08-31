import { useEffect, useState } from 'react'

/**
 * Breakpoint em JS para o que o CSS não resolve sozinho — ex.: a sidebar
 * recolhida é um estado de DESKTOP e não pode vazar para o drawer do celular.
 */
export function useMediaQuery(query: string) {
  const [combina, setCombina] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const aoMudar = (e: MediaQueryListEvent) => setCombina(e.matches)
    setCombina(mql.matches)
    mql.addEventListener('change', aoMudar)
    return () => mql.removeEventListener('change', aoMudar)
  }, [query])

  return combina
}

/** md: do Tailwind — a fronteira entre drawer (mobile) e sidebar (desktop). */
export const useEhDesktop = () => useMediaQuery('(min-width: 768px)')
