import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation'
import { Loader } from '@/components/ai-elements/loader'
import {
  PromptInput,
  PromptInputButton,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input'
import { Source, Sources, SourcesContent, SourcesTrigger } from '@/components/ai-elements/sources'
import { EffortSelect } from '@/components/effort-select'
import { EditMessageDialog } from '@/components/edit-message-dialog'
import { HiddenToolsGroup } from '@/components/hidden-tools-group'
import { ToolCallGroup } from '@/components/tool-call-group'
import { ToolFiltersDialog } from '@/components/tool-filters-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Switch } from '@/components/ui/switch'
import { ToolFiltersProvider, useToolFilters } from '@/contexts/tool-filters'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai'
import type { UIDataTypes, UIMessage, UIMessagePart, UITools } from 'ai'
import { ArrowRightIcon, FilterIcon, RefreshCcwIcon, Settings2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type SyntheticEvent } from 'react'

import { useQuery } from '@tanstack/react-query'
import { useThrottle } from '@uidotdev/usehooks'
import { nanoid } from 'nanoid'
import { useConversationIdFromUrl } from './hooks/useConversationIdFromUrl'
import { Part } from './Part'
import type { ConversationEntry } from './types'
import { getToolIcon } from '@/lib/tool-icons'
import { toolNameOfPart } from '@/lib/tool-filters'
import { COMPLETE_TOOL_STATES, groupParts } from '@/lib/tool-grouping'
import { getMessages, saveMessages, saveConversation } from '@/lib/chat-db'
import { stripBasePath, withBasePath } from '@/lib/base-path'

interface ModelConfig {
  id: string
  name: string
  builtinTools: string[]
}

interface BuiltinTool {
  name: string
  id: string
}

// TODO: if just a single model, don't show model selector, just a label.
interface RemoteConfig {
  models: ModelConfig[]
  builtinTools: BuiltinTool[]
}

async function getModels() {
  const res = await fetch('/api/configure')
  return (await res.json()) as RemoteConfig
}

const ChatInner = () => {
  const { isFiltered } = useToolFilters()
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false)
  const [input, setInput] = useState('')
  const [model, setModel] = useState('')
  const [effort, setEffort] = useState<string>(() => {
    const stored = localStorage.getItem('effort')
    // Empty string was the old "Default" sentinel; migrate it to an explicit level.
    return stored && stored !== '' ? stored : 'medium'
  })
  const [enabledTools, setEnabledTools] = useState<string[]>([])
  const modelRef = useRef(model)
  modelRef.current = model
  const effortRef = useRef(effort)
  effortRef.current = effort
  const enabledToolsRef = useRef(enabledTools)
  enabledToolsRef.current = enabledTools

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        body: () => ({ model: modelRef.current, builtinTools: enabledToolsRef.current, effort: effortRef.current }),
      }),
  )
  const { messages, sendMessage, status, setMessages, regenerate, error, clearError, addToolApprovalResponse } =
    useChat({
      transport,
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    })
  const throttledMessages = useThrottle(messages, 500)
  const [conversationId, setConversationId] = useConversationIdFromUrl()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Edit state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const editDraftsRef = useRef(new Map<string, string>())
  const [pendingEdit, setPendingEdit] = useState<{ messageId: string; text: string } | null>(null)
  // Deferred send: set this ref, then call setMessages. The useEffect below
  // will fire sendMessage after the messages state has been committed.
  const pendingSendRef = useRef<{ text: string; model: string; builtinTools: string[] } | null>(null)
  const [sendTrigger, setSendTrigger] = useState(0)

  const configQuery = useQuery({
    queryFn: getModels,
    queryKey: ['models'],
  })

  useEffect(() => {
    if (configQuery.data) {
      setModel(configQuery.data.models[0].id)
    }
  }, [configQuery.data])

  useEffect(() => {
    setEditingMessageId(null)
    if (conversationId === '/') {
      setMessages([])
    } else {
      getMessages(conversationId)
        .then((storedMessages) => {
          if (storedMessages) {
            setMessages(storedMessages)

            // Auto-send pending fork message after loading forked conversation
            // Uses deferred send to ensure setMessages is committed first
            if (pendingSendRef.current) {
              setSendTrigger((n) => n + 1)
            }
          }
        })
        .catch((err: unknown) => {
          console.error('Failed to load messages:', err)
        })
    }
    textareaRef.current?.focus()
  }, [conversationId])

  const handleSubmit = (e: SyntheticEvent) => {
    e.preventDefault()
    if (input.trim()) {
      const theCurrentUrl = new URL(window.location.toString())

      // we're starting a new conversation
      if (stripBasePath(theCurrentUrl.pathname) === '/') {
        const newConversationId = `/${nanoid()}`
        setConversationId(newConversationId)

        saveConversationEntry(newConversationId, input)

        theCurrentUrl.pathname = withBasePath(newConversationId)
        window.history.pushState({}, '', theCurrentUrl.toString())
      }

      sendMessage({ text: input }).catch((error: unknown) => {
        console.error('Error sending message:', error)
      })
      setInput('')
    }
  }

  // Fires deferred sendMessage after setMessages has been committed
  useEffect(() => {
    if (!pendingSendRef.current) return
    const pending = pendingSendRef.current
    pendingSendRef.current = null
    sendMessage({ text: pending.text }).catch((error: unknown) => {
      console.error('Error sending deferred message:', error)
    })
  }, [sendTrigger])

  useEffect(() => {
    if (conversationId && conversationId !== '/' && throttledMessages.length > 0) {
      saveMessages(conversationId, throttledMessages).catch((err: unknown) => {
        console.error('Failed to save messages:', err)
      })
    }
  }, [throttledMessages, conversationId])

  const handleStartEdit = useCallback((messageId: string) => {
    setEditingMessageId(messageId)
  }, [])

  const handleCancelEdit = useCallback((messageId: string, draft: string) => {
    editDraftsRef.current.set(messageId, draft)
    setEditingMessageId(null)
  }, [])

  const handleSubmitEdit = useCallback(
    (messageId: string, newText: string) => {
      const original = messages.find((m) => m.id === messageId)
      const originalText = original?.parts.find((p) => p.type === 'text')
      const unchanged = originalText && 'text' in originalText && originalText.text === newText

      editDraftsRef.current.delete(messageId)
      setEditingMessageId(null)

      if (unchanged) return

      setPendingEdit({ messageId, text: newText })
    },
    [messages],
  )

  const handleModify = useCallback(() => {
    if (!pendingEdit) return
    const messageIndex = messages.findIndex((m) => m.id === pendingEdit.messageId)
    if (messageIndex === -1) return

    pendingSendRef.current = { text: pendingEdit.text, model, builtinTools: enabledTools }
    setMessages(messages.slice(0, messageIndex))
    setPendingEdit(null)
    // Defer to next macrotask so setMessages commits before the send effect fires
    setTimeout(() => {
      setSendTrigger((n) => n + 1)
    }, 0)
  }, [pendingEdit, messages, setMessages, model, enabledTools])

  // Retry: re-run the last user message, discarding everything generated after
  // it (partial assistant text, in-progress tool parts, whole tool-loop turns).
  const handleRetry = useCallback(() => {
    let i = messages.length - 1
    while (i >= 0 && messages[i].role !== 'user') i--
    if (i === -1) return

    const userMessage = messages[i]
    const textPart = userMessage.parts.find((p) => p.type === 'text')
    const text = textPart && 'text' in textPart ? textPart.text : ''

    clearError()
    pendingSendRef.current = { text, model, builtinTools: enabledTools }
    // Drop the user message too; the deferred send re-adds it cleanly.
    setMessages(messages.slice(0, i))
    setTimeout(() => {
      setSendTrigger((n) => n + 1)
    }, 0)
  }, [messages, clearError, setMessages, model, enabledTools])

  // Continue: append a `continue` user message to a valid history. If the run
  // errored mid-tool-call, the trailing assistant message may hold a tool part
  // with no output; pydantic-ai rejects an orphaned tool call, so drop that
  // trailing assistant message first.
  const handleContinue = useCallback(() => {
    const lastMessage = messages.at(-1)
    if (lastMessage?.role === 'assistant' && hasIncompleteToolPart(lastMessage.parts)) {
      clearError()
      pendingSendRef.current = { text: 'continue', model, builtinTools: enabledTools }
      setMessages(messages.slice(0, -1))
      setTimeout(() => {
        setSendTrigger((n) => n + 1)
      }, 0)
      return
    }

    clearError()
    sendMessage({ text: 'continue' }).catch((error: unknown) => {
      console.error('Error continuing message:', error)
    })
  }, [messages, clearError, setMessages, sendMessage, model, enabledTools])

  const handleFork = useCallback(() => {
    if (!pendingEdit) return
    if (conversationId === '/') return
    const messageIndex = messages.findIndex((m) => m.id === pendingEdit.messageId)
    if (messageIndex === -1) return

    const newConversationId = `/${nanoid()}`
    const forkedMessages = messages.slice(0, messageIndex)

    // Determine first message text for the sidebar entry
    // If editing the first user message, use the new text; otherwise use the original
    const firstUserMessage = forkedMessages.find((m) => m.role === 'user')
    const firstMessageText = firstUserMessage?.parts.find((p) => p.type === 'text')
    const originalText = firstMessageText && 'text' in firstMessageText ? firstMessageText.text : undefined
    const firstMessage = originalText ?? pendingEdit.text

    // Save fork to IndexedDB
    saveConversationEntry(newConversationId, firstMessage, { conversationId, messageIndex })
    saveMessages(newConversationId, forkedMessages).catch((err: unknown) => {
      console.error('Failed to save forked messages:', err)
    })

    // Set up pending message to auto-send after navigation
    pendingSendRef.current = { text: pendingEdit.text, model, builtinTools: enabledTools }

    setPendingEdit(null)
    setConversationId(newConversationId)
  }, [pendingEdit, messages, conversationId, model, enabledTools, setConversationId])

  const handleNavigateToFork = useCallback(
    (targetConversationId: string) => {
      setConversationId(targetConversationId)
    },
    [setConversationId],
  )

  function regen(messageId: string) {
    regenerate({ messageId }).catch((error: unknown) => {
      console.error('Error regenerating message:', error)
    })
  }

  const availableTools = useMemo(() => {
    const enabledToolIds = configQuery.data?.models.find((entry) => entry.id === model)?.builtinTools ?? []
    return configQuery.data?.builtinTools.filter((tool) => enabledToolIds.includes(tool.id)) ?? []
  }, [configQuery.data, model])

  return (
    <>
      <Conversation className="h-full">
        <ConversationContent>
          {messages.map((message, messageIndex) => (
            <div key={message.id} className={message.role === 'user' ? 'group/user-message' : undefined}>
              {message.role === 'assistant' &&
                message.parts.filter((part) => part.type === 'source-url').length > 0 && (
                  <Sources>
                    <SourcesTrigger count={message.parts.filter((part) => part.type === 'source-url').length} />
                    {message.parts
                      .filter((part) => part.type === 'source-url')
                      .map((part, i) => (
                        <SourcesContent key={`${message.id}-${i}`}>
                          <Source key={`${message.id}-${i}`} href={part.url} title={part.url} />
                        </SourcesContent>
                      ))}
                  </Sources>
                )}
              {renderMessageParts(
                message,
                (part, i) => (
                  <Part
                    key={`${message.id}-${i}`}
                    part={part}
                    message={message}
                    status={status}
                    index={i}
                    regen={regen}
                    lastMessage={message.id === messages.at(-1)?.id}
                    onApprovalResponse={addToolApprovalResponse}
                    isEditing={editingMessageId === message.id}
                    editDraft={editDraftsRef.current.get(message.id)}
                    onStartEdit={handleStartEdit}
                    onCancelEdit={handleCancelEdit}
                    onSubmitEdit={handleSubmitEdit}
                    conversationId={conversationId}
                    messageIndex={messageIndex}
                    onNavigateToFork={handleNavigateToFork}
                  />
                ),
                isFiltered,
              )}
            </div>
          ))}
          {status === 'submitted' && <Loader />}
          {status === 'error' && error && (
            <div className="px-4 py-3 mx-4 my-2 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
              <div>
                <strong>Error:</strong> {error.message}
              </div>
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={handleRetry}>
                  <RefreshCcwIcon className="size-4" />
                  Retry
                </Button>
                <Button variant="outline" size="sm" onClick={handleContinue}>
                  <ArrowRightIcon className="size-4" />
                  Continue
                </Button>
              </div>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="sticky bottom-0 p-3">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            ref={textareaRef}
            onChange={(e) => {
              setInput(e.target.value)
            }}
            value={input}
            autoFocus={true}
          />
          <PromptInputToolbar>
            <PromptInputTools>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PromptInputButton
                    variant="outline"
                    aria-label="Hidden tools"
                    onClick={() => {
                      setFiltersDialogOpen(true)
                    }}
                  >
                    <FilterIcon className="size-4" />
                  </PromptInputButton>
                </TooltipTrigger>
                <TooltipContent>Hidden tools</TooltipContent>
              </Tooltip>
              {availableTools.length > 0 && (
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <PromptInputButton variant="outline">
                          <Settings2Icon className="size-4" />
                        </PromptInputButton>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Tools</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="start">
                    {availableTools.map((tool) => (
                      <div
                        key={tool.id}
                        className="flex items-center justify-between gap-3 px-2 py-1.5 cursor-pointer hover:bg-accent rounded-sm"
                        onClick={() => {
                          setEnabledTools((prev) =>
                            prev.includes(tool.id) ? prev.filter((id) => id !== tool.id) : [...prev, tool.id],
                          )
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {getToolIcon(tool.id)}
                          <span className="text-sm">{tool.name}</span>
                        </div>
                        <Switch
                          checked={enabledTools.includes(tool.id)}
                          onCheckedChange={(checked) => {
                            setEnabledTools((prev) =>
                              checked ? [...prev, tool.id] : prev.filter((id) => id !== tool.id),
                            )
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                        />
                      </div>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {configQuery.data && model && (
                <PromptInputModelSelect
                  onValueChange={(value) => {
                    setModel(value)
                  }}
                  value={model}
                >
                  <PromptInputModelSelectTrigger>
                    <PromptInputModelSelectValue />
                  </PromptInputModelSelectTrigger>
                  <PromptInputModelSelectContent>
                    {(configQuery.data as { models: { id: string; name: string }[] }).models.map((model) => (
                      <PromptInputModelSelectItem key={model.id} value={model.id}>
                        {model.name}
                      </PromptInputModelSelectItem>
                    ))}
                  </PromptInputModelSelectContent>
                </PromptInputModelSelect>
              )}
              <EffortSelect
                value={effort}
                onValueChange={(v) => {
                  setEffort(v)
                  localStorage.setItem('effort', v)
                }}
              />
            </PromptInputTools>
            <PromptInputSubmit disabled={!input} status={status} />
          </PromptInputToolbar>
        </PromptInput>
      </div>

      <EditMessageDialog
        open={pendingEdit !== null}
        onOpenChange={(open) => {
          if (!open) setPendingEdit(null)
        }}
        onModify={handleModify}
        onFork={handleFork}
      />

      <ToolFiltersDialog open={filtersDialogOpen} onOpenChange={setFiltersDialogOpen} />
    </>
  )
}

const Chat = () => (
  // Upstream default is an empty filter list. A host (e.g. loopy) seeds its own
  // noisy tool names by passing `defaults={[...]}` here.
  <ToolFiltersProvider defaults={[]}>
    <ChatInner />
  </ToolFiltersProvider>
)

export default Chat

// Walk a message's parts and render them, collapsing two kinds of consecutive
// runs into a single element: filtered tool parts into a `HiddenToolsGroup`, and
// runs of >=2 calls to the same (non-filtered) tool into a `ToolCallGroup`.
// `renderPart` is the per-part renderer (returns a `<Part>` element); grouping
// is message-level so it lives here rather than in `Part`. Lone calls and
// non-tool parts render unchanged.
function renderMessageParts(
  message: UIMessage,
  renderPart: (part: UIMessagePart<UIDataTypes, UITools>, index: number) => ReactNode,
  isFiltered: (toolName: string) => boolean,
): ReactNode[] {
  const descriptors = message.parts.map((part) => {
    const toolName = toolNameOfPart(part)
    return { toolName, filtered: toolName !== null && isFiltered(toolName) }
  })

  return groupParts(descriptors).map((run) => {
    if (run.kind === 'single') {
      return renderPart(message.parts[run.index], run.index)
    }
    if (run.kind === 'hidden') {
      return (
        <HiddenToolsGroup
          key={`hidden-${message.id}-${run.indices[0]}`}
          toolNames={run.indices.map((i) => toolNameOfPart(message.parts[i]) ?? '')}
        >
          {run.indices.map((i) => renderPart(message.parts[i], i))}
        </HiddenToolsGroup>
      )
    }
    return (
      <ToolCallGroup
        key={`tool-group-${message.id}-${run.indices[0]}`}
        toolName={run.toolName}
        states={run.indices.map((i) => partState(message.parts[i]))}
      >
        {run.indices.map((i) => renderPart(message.parts[i], i))}
      </ToolCallGroup>
    )
  })
}

// A tool part's lifecycle state (e.g. `output-available`). Non-tool parts have
// no state; the grouping pass never asks for theirs.
function partState(part: UIMessagePart<UIDataTypes, UITools>): string {
  return 'state' in part && typeof part.state === 'string' ? part.state : ''
}

// A tool part whose state is not in `COMPLETE_TOOL_STATES` has no output (or
// denial) yet, so continuing would leave the backend with an orphaned tool call.
function hasIncompleteToolPart(parts: UIMessagePart<UIDataTypes, UITools>[]): boolean {
  return parts.some(
    (part) => (part.type === 'dynamic-tool' || 'toolCallId' in part) && !COMPLETE_TOOL_STATES.has(part.state),
  )
}

const MAX_FIRST_MESSAGE_LENGTH = 30

function saveConversationEntry(newConversationId: string, firstMessage: string, forkOf?: ConversationEntry['forkOf']) {
  const trimmedFirstMessage =
    firstMessage.length > MAX_FIRST_MESSAGE_LENGTH
      ? firstMessage.slice(0, MAX_FIRST_MESSAGE_LENGTH) + '...'
      : firstMessage

  const entry: ConversationEntry = {
    id: newConversationId,
    firstMessage: trimmedFirstMessage,
    timestamp: Date.now(),
  }
  if (forkOf) {
    entry.forkOf = forkOf
  }

  saveConversation(entry)
    .then(() => window.dispatchEvent(new Event('conversations-changed')))
    .catch((err: unknown) => {
      console.error('Failed to save conversation:', err)
    })
}
