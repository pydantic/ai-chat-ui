import { getToolIcon } from '@/lib/tool-icons'
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'

interface ToolCallGroupProps {
  toolName: string
  states: string[]
  children: ReactNode
}

// A call is done once it has a terminal result (output, error, or denial);
// anything earlier (streaming input, awaiting approval) is still running.
const DONE_STATES = new Set(['output-available', 'output-error', 'output-denied'])

/**
 * Collapse a run of consecutive calls to the same tool into a single line.
 * Collapsed, it shows the tool icon, name, an `xN` count, and -- while any call
 * is still running -- a "D done / R running" progress affordance. Expanded, it
 * reveals the individual tool cards (`children`) inline. Mirrors the look of
 * `HiddenToolsGroup`.
 */
export function ToolCallGroup({ toolName, states, children }: ToolCallGroupProps) {
  const [expanded, setExpanded] = useState(false)
  const count = states.length
  const done = states.filter((state) => DONE_STATES.has(state)).length
  const running = count - done

  const progress = running > 0 ? `${done} done / ${running} running` : 'done'

  const toggle = (
    <button
      type="button"
      onClick={() => {
        setExpanded((prev) => !prev)
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
