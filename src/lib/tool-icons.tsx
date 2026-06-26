import { CodeIcon, DownloadIcon, GlobeIcon, ImagePlusIcon, TerminalIcon, WrenchIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function getToolIcon(toolId: string, className = 'size-4') {
  const iconMap: Record<string, ReactNode> = {
    web_search: <GlobeIcon className={className} />,
    web_fetch: <DownloadIcon className={className} />,
    code_execution: <CodeIcon className={className} />,
    image_generation: <ImagePlusIcon className={className} />,
    run_code: <TerminalIcon className={className} />,
  }
  return iconMap[toolId] ?? <WrenchIcon className={className} />
}
