import {
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
} from '@/components/ai-elements/prompt-input'
import { THINKING_EFFORT_LEVELS, type ThinkingEffort } from '@/lib/generated/thinking-effort.gen'

interface EffortOption {
  label: string
  selectValue: string
}

// Display labels are a UI concern and stay here; the levels come from
// pydantic-ai via the generated module. The Record is exhaustive over
// ThinkingEffort, so adding a level upstream forces a label here (or fails to
// compile) rather than silently dropping it from the dropdown.
const EFFORT_LABELS: Record<ThinkingEffort, string> = {
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'X-High',
}

const EFFORT_OPTIONS: EffortOption[] = [
  ...THINKING_EFFORT_LEVELS.map((level) => ({
    label: EFFORT_LABELS[level],
    selectValue: level,
  })),
]

interface EffortSelectProps {
  value: string
  onValueChange: (value: string) => void
}

export const EffortSelect = ({ value, onValueChange }: EffortSelectProps) => {
  return (
    <PromptInputModelSelect value={value} onValueChange={onValueChange}>
      <PromptInputModelSelectTrigger className="shrink-0">
        <PromptInputModelSelectValue />
      </PromptInputModelSelectTrigger>
      <PromptInputModelSelectContent>
        {EFFORT_OPTIONS.map((opt) => (
          <PromptInputModelSelectItem key={opt.selectValue} value={opt.selectValue}>
            {/* The prefix is dropped on narrow screens so the toolbar fits on one row. */}
            <span className="hidden sm:inline">Effort: </span>
            {opt.label}
          </PromptInputModelSelectItem>
        ))}
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  )
}
