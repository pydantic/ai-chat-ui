import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { ToolUIPart } from 'ai'
import { CheckCircleIcon, ChevronDownIcon, CircleIcon, ClockIcon, CopyIcon, XCircleIcon } from 'lucide-react'
import { useState, type ComponentProps, type ReactNode } from 'react'
import { CodeBlock } from './code-block'
import { getToolIcon } from '@/lib/tool-icons'

export type ToolProps = ComponentProps<typeof Collapsible>

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible className={cn('not-prose mb-4 w-full rounded-md border', className)} {...props} />
)

export interface ToolHeaderProps {
  type: ToolUIPart['type']
  state: ToolUIPart['state']
  className?: string
}

const getStatusBadge = (status: ToolUIPart['state']) => {
  const labels = {
    'input-streaming': 'Pending',
    'input-available': 'Running',
    'output-available': 'Completed',
    'output-error': 'Error',
  } as const

  const icons = {
    'input-streaming': <CircleIcon className="size-4" />,
    'input-available': <ClockIcon className="size-4 animate-pulse" />,
    'output-available': <CheckCircleIcon className="size-4 text-green-600" />,
    'output-error': <XCircleIcon className="size-4 text-red-600" />,
  } as const

  return (
    <Badge className="gap-1.5 rounded-full text-xs" variant="secondary">
      {icons[status]}
      {labels[status]}
    </Badge>
  )
}

export const ToolHeader = ({ className, type, state, ...props }: ToolHeaderProps) => {
  const toolId = type.slice(5) // Remove 'tool-' prefix
  const toolIcon = getToolIcon(toolId, 'size-4 text-muted-foreground')

  return (
    <CollapsibleTrigger className={cn('flex w-full items-center justify-between gap-4 p-3', className)} {...props}>
      <div className="flex items-center gap-2">
        {toolIcon}
        <span className="font-medium text-sm">{toolId}</span>
        {getStatusBadge(state)}
      </div>
      <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
    </CollapsibleTrigger>
  )
}

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      'data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in',
      className,
    )}
    {...props}
  />
)

export type ToolInputProps = ComponentProps<'div'> & {
  input: ToolUIPart['input']
}

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => (
  <div className={cn('space-y-2 overflow-hidden p-4', className)} {...props}>
    <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Parameters</h4>
    <div className="rounded-md bg-muted/50">
      <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
    </div>
  </div>
)

export type ToolOutputProps = ComponentProps<'div'> & {
  output: ReactNode
  errorText: ToolUIPart['errorText']
}

export const ToolOutput = ({ className, output, errorText, ...props }: ToolOutputProps) => {
  const [copied, setCopied] = useState(false)

  if (!(output || errorText)) {
    return null
  }

  const copyError = () => {
    if (errorText) {
      navigator.clipboard.writeText(errorText).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  return (
    <div className={cn('space-y-2 p-4', className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {errorText ? 'Error' : 'Result'}
      </h4>
      {errorText && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <XCircleIcon className="mr-1.5 size-4" />
              View Error
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-destructive">Tool Error</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="max-h-96 overflow-auto rounded-md bg-destructive/10 p-4 text-destructive text-sm">
                <pre className="whitespace-pre-wrap break-words">{errorText}</pre>
              </div>
              <Button variant="outline" size="sm" onClick={copyError}>
                <CopyIcon className="mr-1.5 size-4" />
                {copied ? 'Copied!' : 'Copy Error'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {output && !errorText && (
        <div className="overflow-x-auto rounded-md bg-muted/50 text-foreground text-xs [&_table]:w-full">
          <div>{output}</div>
        </div>
      )}
    </div>
  )
}
