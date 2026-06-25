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
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Switch } from '@/components/ui/switch'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai'
import { Settings2Icon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react'

import { useQuery } from '@tanstack/react-query'
import { useThrottle } from '@uidotdev/usehooks'
import { nanoid } from 'nanoid'
import { useConversationIdFromUrl } from './hooks/useConversationIdFromUrl'
import { Part } from './Part'
import type { ConversationEntry } from './types'
import { getToolIcon } from '@/lib/tool-icons'
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

const Chat = () => {
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
  const { messages, sendMessage, status, setMessages, regenerate, error, addToolApprovalResponse } = useChat({
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
              {message.parts.map((part, i) => (
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
              ))}
            </div>
          ))}
          {status === 'submitted' && <Loader />}
          {status === 'error' && error && (
            <div className="px-4 py-3 mx-4 my-2 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
              <strong>Error:</strong> {error.message}
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
    </>
  )
}

export default Chat

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
