import { Message, MessageContent } from '@/components/ai-elements/message'

import { Actions, Action } from '@/components/ai-elements/actions'
import { Response } from '@/components/ai-elements/response'
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  RefreshCcwIcon,
  XIcon,
} from 'lucide-react'
import type { UIDataTypes, UIMessagePart, UITools, UIMessage } from 'ai'
import { useEffect, useState } from 'react'
import { useForkSiblings } from '@/hooks/useForkSiblings'
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai-elements/reasoning'
import { Tool, ToolHeader, ToolInput, ToolOutput, ToolContent } from '@/components/ai-elements/tool'
import { CodeBlock } from '@/components/ai-elements/code-block'

interface PartProps {
  part: UIMessagePart<UIDataTypes, UITools>
  message: UIMessage
  status: string
  regen: (id: string) => void
  index: number
  lastMessage: boolean
  isEditing?: boolean
  editDraft?: string
  onStartEdit?: (messageId: string) => void
  onCancelEdit?: (messageId: string, draft: string) => void
  onSubmitEdit?: (messageId: string, newText: string) => void
  conversationId?: string
  messageIndex?: number
  onNavigateToFork?: (conversationId: string) => void
}

export function Part({
  part,
  message,
  status,
  regen,
  index,
  lastMessage,
  isEditing,
  editDraft,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  conversationId,
  messageIndex,
  onNavigateToFork,
}: PartProps) {
  const [editText, setEditText] = useState('')

  // Intentionally deps on [isEditing] only — we want to initialize editText
  // from draft/part.text only when entering edit mode, not on subsequent changes
  useEffect(() => {
    if (isEditing && part.type === 'text') {
      setEditText(editDraft ?? part.text)
    }
  }, [isEditing])

  function copy(text: string) {
    navigator.clipboard.writeText(text).catch((error: unknown) => {
      console.error('Error copying text:', error)
    })
  }

  if (part.type === 'text') {
    if (message.role === 'user' && isEditing) {
      return (
        <div className="py-4">
          <Message from="user">
            <MessageContent>
              <textarea
                className="w-full bg-transparent resize-none outline-none text-sm min-h-[60px]"
                value={editText}
                onChange={(e) => {
                  setEditText(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    onSubmitEdit?.(message.id, editText)
                  } else if (e.key === 'Escape') {
                    onCancelEdit?.(message.id, editText)
                  }
                }}
                autoFocus
              />
            </MessageContent>
          </Message>
          <Actions className="mt-1 justify-end">
            <Action
              onClick={() => {
                onSubmitEdit?.(message.id, editText)
              }}
              label="Submit edit"
              className="text-green-600 hover:text-green-700 dark:text-green-500 dark:hover:text-green-400"
            >
              <CheckIcon className="size-3" />
            </Action>
            <Action
              onClick={() => {
                onCancelEdit?.(message.id, editText)
              }}
              label="Cancel edit"
              className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
            >
              <XIcon className="size-3" />
            </Action>
          </Actions>
        </div>
      )
    }

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
        {message.role === 'user' && index === message.parts.length - 1 && (
          <div className="flex items-center gap-2 mt-1 justify-end">
            {status !== 'submitted' && status !== 'streaming' && (
              <Actions className="opacity-0 group-hover/user-message:opacity-100 transition-opacity">
                <Action
                  onClick={() => {
                    onStartEdit?.(message.id)
                  }}
                  label="Edit message"
                >
                  <PencilIcon className="size-3" />
                </Action>
              </Actions>
            )}
            {conversationId && messageIndex !== undefined && onNavigateToFork && (
              <ForkNavigation
                conversationId={conversationId}
                messageIndex={messageIndex}
                onNavigate={onNavigateToFork}
              />
            )}
          </div>
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
    return <>Dynamic Tool, TODO {JSON.stringify(part)}</>
  } else if ('toolCallId' in part) {
    // return <div>{JSON.stringify(part)}</div>
    return (
      <Tool>
        <ToolHeader type={part.type} state={part.state} />
        <ToolContent>
          <ToolInput input={part.input} />
          {(part.state === 'output-available' || part.state === 'output-error') && (
            <ToolOutput
              errorText={part.errorText}
              output={<CodeBlock code={JSON.stringify(part.output, null, 2)} language="json" />}
            />
          )}
        </ToolContent>
      </Tool>
    )
  }
}

function ForkNavigation({
  conversationId,
  messageIndex,
  onNavigate,
}: {
  conversationId: string
  messageIndex: number
  onNavigate: (conversationId: string) => void
}) {
  const { siblings, currentIndex, total } = useForkSiblings(conversationId, messageIndex)

  if (total <= 1) return null

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
        disabled={currentIndex === 0}
        onClick={() => {
          onNavigate(siblings[currentIndex - 1].id)
        }}
        aria-label="Previous fork"
      >
        <ChevronLeftIcon className="size-3.5" />
      </button>
      <span className="text-xs text-muted-foreground tabular-nums">
        {currentIndex + 1}/{total}
      </span>
      <button
        type="button"
        className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
        disabled={currentIndex === total - 1}
        onClick={() => {
          onNavigate(siblings[currentIndex + 1].id)
        }}
        aria-label="Next fork"
      >
        <ChevronRightIcon className="size-3.5" />
      </button>
    </div>
  )
}
