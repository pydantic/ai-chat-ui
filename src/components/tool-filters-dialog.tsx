import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useToolFilters } from '@/contexts/tool-filters'
import { XIcon } from 'lucide-react'
import { useState, type SyntheticEvent } from 'react'

interface ToolFiltersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ToolFiltersDialog({ open, onOpenChange }: ToolFiltersDialogProps) {
  const { filters, addFilter, removeFilter } = useToolFilters()
  const [draft, setDraft] = useState('')

  const submit = (e: SyntheticEvent) => {
    e.preventDefault()
    addFilter(draft)
    setDraft('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hidden tools</DialogTitle>
          <DialogDescription>Hide tool-call cards by name or glob, e.g. set_* or run_code</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {filters.length === 0 ? (
            <p className="text-sm text-muted-foreground">No filters yet. Add a tool name or glob below.</p>
          ) : (
            filters.map((filter) => (
              <div key={filter} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5">
                <span className="font-mono text-sm">{filter}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label={`Remove ${filter}`}
                  onClick={() => {
                    removeFilter(filter)
                  }}
                >
                  <XIcon className="size-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        <form className="flex items-center gap-2" onSubmit={submit}>
          <Input
            value={draft}
            placeholder="Tool name or glob (e.g. set_*)"
            onChange={(e) => {
              setDraft(e.target.value)
            }}
          />
          <Button type="submit" disabled={draft.trim() === ''}>
            Add
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
