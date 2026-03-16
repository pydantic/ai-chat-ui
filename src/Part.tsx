import { Message, MessageContent } from '@/components/ai-elements/message'
import { Actions, Action } from '@/components/ai-elements/actions'
import { Response } from '@/components/ai-elements/response'
import { CopyIcon, RefreshCcwIcon } from 'lucide-react'
import {
  Confirmation,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationAccepted,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from '@/components/ai-elements/confirmation'
import type { ChatAddToolApproveResponseFunction, UIDataTypes, UIMessagePart, UITools, UIMessage } from 'ai'
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai-elements/reasoning'
import { Tool, ToolHeader, ToolInput, ToolOutput, ToolContent } from '@/components/ai-elements/tool'
import { getToolIcon } from '@/lib/tool-icons'

interface PartProps {
  part: UIMessagePart<UIDataTypes, UITools>
  message: UIMessage
  status: string
  regen: (id: string) => void
  index: number
  lastMessage: boolean
  onApprovalResponse: ChatAddToolApproveResponseFunction
}

export function Part({ part, message, status, regen, index, lastMessage, onApprovalResponse }: PartProps) {
  function copy(text: string) {
    navigator.clipboard.writeText(text).catch((error: unknown) => {
      console.error('Error copying text:', error)
    })
  }

  if (part.type === 'text') {
    return (
      <div className="py-4">
        <Message from={message.role}>
          <MessageContent>
            <Response>{part.text}</Response>
          </MessageContent>
        </Message>
        {message.role === 'assistant' && index === message.parts.length - 1 && (
          <Actions className="mt-1">
            <Action
              onClick={() => {
                regen(message.id)
              }}
              label="Retry"
            >
              <RefreshCcwIcon className="size-3" />
            </Action>
            <Action
              onClick={() => {
                copy(part.text)
              }}
              label="Copy"
            >
              <CopyIcon className="size-3" />
            </Action>
          </Actions>
        )}
      </div>
    )
  } else if (part.type === 'reasoning') {
    return (
      <Reasoning
        className="w-full"
        isStreaming={status === 'streaming' && index === message.parts.length - 1 && lastMessage}
      >
        <ReasoningTrigger />
        <ReasoningContent>{part.text}</ReasoningContent>
      </Reasoning>
    )
  } else if (part.type === 'dynamic-tool') {
    return (
      <Tool data-tool-name={part.toolName}>
        <ToolHeader
          type={part.type}
          state={part.state}
          toolName={part.toolName}
          icon={getToolIcon(part.toolName, 'size-4 text-muted-foreground')}
        />
        <ToolContent>
          <ToolInput input={part.input} />
          <ToolOutput errorText={part.errorText} output={part.output} />
        </ToolContent>
      </Tool>
    )
  } else if ('toolCallId' in part) {
    const toolId = part.type.split('-').slice(1).join('-')
    return (
      <Tool data-tool-name={toolId} defaultOpen={part.state === 'approval-requested'}>
        <ToolHeader type={part.type} state={part.state} icon={getToolIcon(toolId, 'size-4 text-muted-foreground')} />
        <ToolContent>
          <ToolInput input={part.input} />
          {'approval' in part && (
            <Confirmation approval={part.approval as { id: string }} state={part.state}>
              <ConfirmationRequest>
                <ConfirmationTitle>This tool requires your approval to run</ConfirmationTitle>
                <ConfirmationActions>
                  <ConfirmationAction
                    onClick={() => {
                      void onApprovalResponse({ id: (part.approval as { id: string }).id, approved: true })
                    }}
                  >
                    Approve
                  </ConfirmationAction>
                  <ConfirmationAction
                    variant="destructive"
                    onClick={() => {
                      void onApprovalResponse({ id: (part.approval as { id: string }).id, approved: false })
                    }}
                  >
                    Deny
                  </ConfirmationAction>
                </ConfirmationActions>
              </ConfirmationRequest>
              <ConfirmationAccepted>Approved. Executing tool.</ConfirmationAccepted>
              <ConfirmationRejected>Denied. Tool will not run.</ConfirmationRejected>
            </Confirmation>
          )}
          <ToolOutput errorText={part.errorText} output={part.output} />
        </ToolContent>
      </Tool>
    )
  }
}
