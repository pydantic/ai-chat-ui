import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from '@/components/ai-elements/tool'
import { ToolApprovalPrompt } from '@/components/tool-approval-prompt'
import { ToolOutputCode } from '@/components/tool-output-code'
import { RunCodeInput } from '@/components/run-code-input'
import { isRunCodeOutput, RunCodeOutput } from '@/components/run-code-output'
import type { ChatAddToolApproveResponseFunction, DynamicToolUIPart, ToolUIPart } from 'ai'
import { useEffect, useState } from 'react'

interface ToolPartProps {
  part: ToolUIPart | DynamicToolUIPart
  onApprovalResponse: ChatAddToolApproveResponseFunction
}

export function ToolPart({ part, onApprovalResponse }: ToolPartProps) {
  const approval = 'approval' in part ? part.approval : undefined
  const [open, setOpen] = useState(() => part.state === 'approval-requested' || Boolean(approval))

  // Auto-open the card whenever an approval is requested — `defaultOpen` only
  // runs at mount, but the transition into `approval-requested` happens after
  // mount, so the Confirmation prompt would otherwise stay collapsed.
  useEffect(() => {
    if (part.state === 'approval-requested') setOpen(true)
  }, [part.state])

  const toolName = part.type === 'dynamic-tool' ? part.toolName : part.type.split('-').slice(1).join('-')
  const isRunCode = toolName === 'run_code'

  return (
    <Tool data-tool-name={toolName} open={open} onOpenChange={setOpen}>
      {part.type === 'dynamic-tool' ? (
        <ToolHeader type={part.type} state={part.state} toolName={part.toolName} />
      ) : (
        <ToolHeader type={part.type} state={part.state} />
      )}
      <ToolContent>
        {open && (
          <>
            {isRunCode ? <RunCodeInput input={part.input} /> : <ToolInput input={part.input} />}
            {approval && (
              <ToolApprovalPrompt approval={approval} state={part.state} onApprovalResponse={onApprovalResponse} />
            )}
            {(part.state === 'output-available' || part.state === 'output-error') &&
              (isRunCode && !part.errorText && isRunCodeOutput(part.output) ? (
                <RunCodeOutput output={part.output} />
              ) : (
                <ToolOutput errorText={part.errorText} output={<ToolOutputCode output={part.output} />} />
              ))}
          </>
        )}
      </ToolContent>
    </Tool>
  )
}
