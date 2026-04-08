import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { GitForkIcon, PenLineIcon } from 'lucide-react'

interface EditMessageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onModify: () => void
  onFork: () => void
}

export function EditMessageDialog({ open, onOpenChange, onModify, onFork }: EditMessageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Edit message</DialogTitle>
          <DialogDescription>What would you like to do with your edited message?</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Button variant="outline" className="justify-start gap-3 h-auto py-3 px-4" onClick={onModify}>
            <PenLineIcon className="size-4 shrink-0" />
            <div className="flex flex-col items-start text-left">
              <span className="font-medium">Update conversation</span>
              <span className="text-xs text-muted-foreground">Replace this message and get a new response</span>
            </div>
          </Button>
          <Button variant="outline" className="justify-start gap-3 h-auto py-3 px-4" onClick={onFork}>
            <GitForkIcon className="size-4 shrink-0" />
            <div className="flex flex-col items-start text-left">
              <span className="font-medium">Fork conversation</span>
              <span className="text-xs text-muted-foreground">Create a new conversation from this point</span>
            </div>
          </Button>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false)
            }}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
