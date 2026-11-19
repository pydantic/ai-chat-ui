import { CheckIcon } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'

import { EffortBars } from '@/components/effort-bars'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { THINKING_EFFORT_LEVELS, type ThinkingEffort } from '@/lib/generated/thinking-effort.gen'
import { cn } from '@/lib/utils'

// Display copy is a UI concern and stays here; the levels come from pydantic-ai
// via the generated module. The Records are exhaustive over ThinkingEffort, so
// adding a level upstream forces copy here rather than silently dropping it.
const EFFORT_LABELS: Record<ThinkingEffort, string> = {
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'X-High',
  max: 'Max',
}

const EFFORT_DESCRIPTIONS: Record<ThinkingEffort, string> = {
  minimal: 'Answer straight away',
  low: 'A quick think first',
  medium: 'Balanced — the default',
  high: 'Work the problem through',
  xhigh: 'Take as long as it needs',
  max: 'The deepest thinking the model allows',
}

interface EffortMeterProps {
  value: ThinkingEffort
  onValueChange: (value: ThinkingEffort) => void
}

/**
 * How hard the agent should think, as a meter instead of a dropdown.
 *
 * Effort is an intensity, and a select box renders it as interchangeable
 * strings. The bars show where the current setting sits in the range before the
 * control is even opened, and animate when it moves.
 */
export function EffortMeter({ value, onValueChange }: EffortMeterProps) {
  const [open, setOpen] = useState(false)
  const optionsRef = useRef<(HTMLButtonElement | null)[]>([])
  const current = THINKING_EFFORT_LEVELS.indexOf(value)

  const select = (option: ThinkingEffort) => {
    onValueChange(option)
    setOpen(false)
  }

  // A radiogroup has to answer the arrow keys; declaring the role without the
  // keyboard contract would describe an interaction that does not exist.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const offsets: Record<string, number | undefined> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }
    const offset = offsets[event.key]
    if (offset === undefined) return
    event.preventDefault()
    const next = (current + offset + THINKING_EFFORT_LEVELS.length) % THINKING_EFFORT_LEVELS.length
    onValueChange(THINKING_EFFORT_LEVELS[next])
    optionsRef.current[next]?.focus()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`Thinking effort: ${EFFORT_LABELS[value]}`}
        className="text-muted-foreground hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground group flex h-8 shrink-0 items-center gap-2 rounded-lg px-2.5 text-sm font-medium transition-colors"
      >
        <EffortBars level={current} className="group-hover:opacity-90" />
        {/* On a narrow screen the bars carry the meaning on their own; the
            accessible name still spells the level out. */}
        <span className="hidden sm:inline">{EFFORT_LABELS[value]}</span>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 p-1.5">
        <p className="text-muted-foreground px-2 py-1.5 text-xs font-medium">Thinking effort</p>
        <div role="radiogroup" aria-label="Thinking effort" onKeyDown={onKeyDown}>
          {THINKING_EFFORT_LEVELS.map((option, index) => {
            const selected = option === value
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                // Roving tabindex: the group is one tab stop, arrows move within it.
                tabIndex={selected ? 0 : -1}
                ref={(element) => {
                  optionsRef.current[index] = element
                }}
                onClick={() => {
                  select(option)
                }}
                className={cn(
                  'hover:bg-accent focus-visible:ring-ring flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
                  selected && 'bg-accent',
                )}
              >
                <EffortBars level={index} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">{EFFORT_LABELS[option]}</span>
                  <span className="text-muted-foreground block text-xs">{EFFORT_DESCRIPTIONS[option]}</span>
                </span>
                {selected && <CheckIcon className="text-primary size-3.5 shrink-0" />}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
