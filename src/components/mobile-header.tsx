import { SidebarTrigger } from '@/components/ui/sidebar'

import logoSvg from '../assets/logo.svg'

export function MobileHeader() {
  return (
    <header className="flex shrink-0 items-center gap-2 border-b p-2 md:hidden">
      <SidebarTrigger />
      <h1 className="text-l font-medium">
        <img src={logoSvg} className="inline h-4 mr-2 mb-1" />
        Pydantic AI
      </h1>
    </header>
  )
}
