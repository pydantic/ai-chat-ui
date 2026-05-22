import { CodeBlock } from '@/components/ai-elements/code-block'
import { useMemo } from 'react'

const LARGE_TOOL_OUTPUT_LENGTH = 20_000

function stringifyToolOutput(output: unknown): string {
  try {
    const stringified = JSON.stringify(output, null, 2) as string | undefined
    return stringified ?? String(output)
  } catch {
    return String(output)
  }
}

export function ToolOutputCode({ output }: { output: unknown }) {
  const code = useMemo(() => stringifyToolOutput(output), [output])

  if (code.length > LARGE_TOOL_OUTPUT_LENGTH) {
    return <pre className="max-h-96 overflow-auto p-4 font-mono text-xs whitespace-pre-wrap break-words">{code}</pre>
  }

  return <CodeBlock code={code} language="json" />
}
