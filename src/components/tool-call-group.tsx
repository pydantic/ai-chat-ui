import { splitStates } from '@/lib/tool-grouping'
import { getToolIcon } from '@/lib/tool-icons'
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'

interface ToolCallGroupProps {
  toolName: string
  states: string[]
  children: ReactNode
}

/**
 * Collapse a run of consecutive calls to the same tool into a single line.
 * Collapsed, it shows the tool icon, name, an `xN` count, and -- while any call
 * is still running -- a "D done / R running" progress affordance. Expanded, it
 * reveals the individual tool cards (`children`) inline. Mirrors the look of
 * `HiddenToolsGroup`.
 *
 * The group defaults to expanded while any call is still running (incl.
 * `approval-requested`) so live output and approval prompts stay visible, then
 * collapses once every call is done. The user can override either way via the
 * toggle.
 */
export function ToolCallGroup({ toolName, states, children }: ToolCallGroupProps) {
  const [override, setOverride] = useState<boolean | null>(null)
  const count = states.length
  const { done, running } = splitStates(states)
  const expanded = override ?? running > 0

  const progress = running > 0 ? `${done} done / ${running} running` : 'done'

  const toggle = (
    <button
      type="button"
      onClick={() => {
        setOverride(!expanded)
      }}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {expanded ? <ChevronDownIcon className="size-3.5" /> : <ChevronRightIcon className="size-3.5" />}
      {getToolIcon(toolName, 'size-3.5')}
      <span className="font-medium">{toolName}</span>
      <span className="tabular-nums">x{count}</span>
      <span className="text-muted-foreground/70">{progress}</span>
      <span className="underline underline-offset-2">{expanded ? 'collapse' : 'show'}</span>
    </button>
  )

  if (!expanded) {
    return (
      <div data-slot="tool-call-group" className="my-2">
        {toggle}
      </div>
    )
  }

  return (
    <div data-slot="tool-call-group" className="my-2">
      <div className="mb-1">{toggle}</div>
      {children}
    </div>
  )
}
