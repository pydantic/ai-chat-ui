import {
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
} from '@/components/ai-elements/prompt-input'

interface EffortOption {
  value: string
  label: string
  selectValue: string
}

const EFFORT_OPTIONS: EffortOption[] = [
  { value: '', label: 'Effort: Default', selectValue: 'default' },
  { value: 'minimal', label: 'Effort: Minimal', selectValue: 'minimal' },
  { value: 'low', label: 'Effort: Low', selectValue: 'low' },
  { value: 'medium', label: 'Effort: Medium', selectValue: 'medium' },
  { value: 'high', label: 'Effort: High', selectValue: 'high' },
  { value: 'xhigh', label: 'Effort: X-High', selectValue: 'xhigh' },
]

interface EffortSelectProps {
  value: string
  onValueChange: (value: string) => void
}

export const EffortSelect = ({ value, onValueChange }: EffortSelectProps) => {
  const selectValue = value === '' ? 'default' : value

  return (
    <PromptInputModelSelect
      value={selectValue}
      onValueChange={(v) => {
        onValueChange(v === 'default' ? '' : v)
      }}
    >
      <PromptInputModelSelectTrigger>
        <PromptInputModelSelectValue />
      </PromptInputModelSelectTrigger>
      <PromptInputModelSelectContent>
        {EFFORT_OPTIONS.map((opt) => (
          <PromptInputModelSelectItem key={opt.selectValue} value={opt.selectValue}>
            {opt.label}
          </PromptInputModelSelectItem>
        ))}
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  )
}
