import { CodeBlock, CodeBlockCopyButton } from '@/components/ai-elements/code-block'
import { Badge } from '@/components/ui/badge'
import type { ToolPart } from '@/components/ai-elements/tool'
import { parseRunCodeInput } from '@/lib/run-code-payload'
import { memo } from 'react'

// Memoize to avoid re-running highlighters on unchanged code.
const CodeBlockMemo = memo(CodeBlock, (prev, next) => prev.code === next.code)

interface RunCodeInputProps {
  input: ToolPart['input']
}

export function RunCodeInput({ input }: RunCodeInputProps) {
  const { code, restart } = parseRunCodeInput(input)

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
        <CodeBlockMemo code={code} language="python" showLineNumbers>
          <CodeBlockCopyButton />
        </CodeBlockMemo>
      </div>
    </div>
  )
}
