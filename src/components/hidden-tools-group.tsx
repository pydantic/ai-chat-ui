import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'

interface HiddenToolsGroupProps {
  toolNames: string[]
  children: ReactNode
}

/**
 * Collapse a run of consecutive filtered tool parts into a single muted line.
 * Collapsed, it shows "N tools hidden" with a show toggle; expanded, it reveals
 * the real tool cards (`children`) inline plus a hide toggle.
 */
export function HiddenToolsGroup({ toolNames, children }: HiddenToolsGroupProps) {
  const [expanded, setExpanded] = useState(false)
  const count = toolNames.length
  const label = `${count} tool${count === 1 ? '' : 's'} hidden`

  if (!expanded) {
    return (
      <button
        type="button"
        data-slot="hidden-tools-group"
        title={toolNames.join(', ')}
        onClick={() => {
          setExpanded(true)
        }}
        className="my-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <EyeOffIcon className="size-3.5" />
        <span>{label}</span>
        <span className="underline underline-offset-2">show</span>
      </button>
    )
  }

  return (
    <div data-slot="hidden-tools-group" className="my-2">
      <button
        type="button"
        onClick={() => {
          setExpanded(false)
        }}
        className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <EyeIcon className="size-3.5" />
        <span>{label}</span>
        <span className="underline underline-offset-2">hide</span>
      </button>
      {children}
    </div>
  )
}
