import { CodeBlock, CodeBlockCopyButton } from '@/components/ai-elements/code-block'
import { Badge } from '@/components/ui/badge'
import type { ToolPart } from '@/components/ai-elements/tool'

interface RunCodeInputProps {
  input: ToolPart['input']
}

interface RunCodeFields {
  code?: unknown
  restart?: unknown
}

export function RunCodeInput({ input }: RunCodeInputProps) {
  const fields = (input ?? {}) as RunCodeFields
  const code = typeof fields.code === 'string' ? fields.code : ''
  const restart = fields.restart === true

  return (
    <div className="space-y-2 overflow-hidden p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Code</h4>
        {restart && (
          <Badge variant="outline" className="text-xs">
            restart
          </Badge>
        )}
      </div>
      <div className="rounded-md bg-muted/50">
        <CodeBlock code={code} language="python" showLineNumbers>
          <CodeBlockCopyButton />
        </CodeBlock>
      </div>
    </div>
  )
}
