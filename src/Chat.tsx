import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation'
import { Source, Sources, SourcesContent, SourcesTrigger } from '@/components/ai-elements/sources'
import { AssistantTurn } from '@/components/assistant-turn'
import { ChatComposer } from '@/components/chat-composer'
import { ChatError } from '@/components/chat-error'
import { ConfigErrorBanner } from '@/components/config-error-banner'
import { ConversationLoadError } from '@/components/conversation-load-error'
import { EditMessageDialog } from '@/components/edit-message-dialog'
import { HiddenToolsGroup } from '@/components/hidden-tools-group'
import { ThinkingIndicator } from '@/components/thinking-indicator'
import { ToolCallGroup } from '@/components/tool-call-group'
import { ToolFiltersDialog } from '@/components/tool-filters-dialog'
import { UsageSummary } from '@/components/usage-summary'
import { WelcomeScreen } from '@/components/welcome-screen'
import { TurnActivity, TurnActivityStep } from '@/components/turn-activity'
import { ToolFiltersProvider, useToolFilters } from '@/contexts/tool-filters'
import { Chat as ChatSession, useChat } from '@ai-sdk/react'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai'
import type { UIDataTypes, UIMessage, UIMessagePart, UITools } from 'ai'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type SyntheticEvent } from 'react'

import { toast } from 'sonner'

import { useQuery } from '@tanstack/react-query'
import { useThrottle } from '@uidotdev/usehooks'
import { nanoid } from 'nanoid'
import { useConversationIdFromUrl } from './hooks/useConversationIdFromUrl'
import { Part } from './Part'
import type { ThinkingEffort } from '@/lib/generated/thinking-effort.gen'
import type { ConversationEntry } from './types'
import { readEffort, writeEffort } from '@/lib/effort'
import { fetchConfig, startupConfig } from '@/lib/config'
import { resolveSelectedModel } from '@/lib/models'
import { toolNameOfPart } from '@/lib/tool-filters'
import { COMPLETE_TOOL_STATES, groupParts, type PartRun } from '@/lib/tool-grouping'
import {
  ensureConversationEntry,
  getMessages,
  isConversationDeleted,
  saveMessages,
  saveConversation,
} from '@/lib/chat-db'
import { stripBasePath, withBasePath } from '@/lib/base-path'

// TODO: if just a single model, don't show model selector, just a label.

const ChatInner = () => {
  const { isFiltered, filters } = useToolFilters()
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false)
  const [input, setInput] = useState('')
  const [model, setModel] = useState('')
  const [effort, setEffort] = useState<ThinkingEffort>(() => readEffort())
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
        api: `${startupConfig.apiPath}chat`,
        body: () => ({ model: modelRef.current, builtinTools: enabledToolsRef.current, effort: effortRef.current }),
      }),
  )
  // The session is owned here rather than left to `useChat` for two reasons:
  // the array it stores is only readable back off the session itself, and an
  // abandoned run can only be cut loose by handing the hook a different one.
  const createSession = () =>
    new ChatSession<UIMessage>({
      transport,
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    })
  const [session, setSession] = useState(createSession)
  // Every message write goes through this, never through a session captured by
  // a render: the conversation-change effect can swap sessions and then install
  // a history from a read that lands before React has re-rendered.
  const sessionRef = useRef(session)
  sessionRef.current = session
  const { messages, sendMessage, status, regenerate, error, clearError, addToolApprovalResponse, stop } = useChat({
    chat: session,
  })
  const [conversationId, setConversationId] = useConversationIdFromUrl()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Set when a send creates a conversation, so the id change it triggers is not
  // mistaken for navigating away from one.
  const createdHereRef = useRef<string | null>(null)

  // Which conversation the mounted messages belong to — '/' for a new chat,
  // null while a stored one is still being read.
  const [loadedConversationId, setLoadedConversationId] = useState<string | null>(conversationId === '/' ? '/' : null)

  // Snapshots are tagged with the conversation the messages belong to, not with
  // `conversationId` — that runs ahead of the messages while a switch is in
  // flight, and keying the save off it wrote one conversation's history into
  // another.
  const snapshot = useMemo(() => ({ id: loadedConversationId, messages }), [loadedConversationId, messages])
  const throttled = useThrottle(snapshot, 500)

  // The array the session holds immediately after a load — read back off the
  // session, because assigning `messages` stores a copy and the UI is handed
  // that copy, not the array the load produced. The save effect fires on the
  // load's echo too, so without this, opening a conversation rewrote its whole
  // history back to IndexedDB and stamped it as activity — a thread read but
  // not replied to jumped out of "Older" to the top of the sidebar. Identity is
  // enough to tell the echo apart: every SDK write (push, replace, assign)
  // installs a new array, so the first real change breaks the match.
  const loadedMessagesRef = useRef<UIMessage[] | null>(null)

  // The conversation-change effect keys off `conversationId` alone, but has to
  // flush what is still on screen before clearing it.
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const loadedIdRef = useRef(loadedConversationId)
  loadedIdRef.current = loadedConversationId

  // Edit state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const editDraftsRef = useRef(new Map<string, string>())
  const [pendingEdit, setPendingEdit] = useState<{ messageId: string; text: string } | null>(null)
  // Deferred send: set this ref, then truncate the messages. The useEffect
  // below will fire sendMessage after that truncation has been committed.
  // The model and tools are deliberately absent: the transport reads them from
  // their refs at request time, so a copy taken when the send was queued would
  // only be a second source of truth that nobody consults.
  const pendingSendRef = useRef<{
    text: string
    /** The conversation this was queued for; '/' means "wherever we are". */
    conversationId: string
  } | null>(null)
  const [sendTrigger, setSendTrigger] = useState(0)
  // Bumped by the retry button to re-run the load effect.
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [loadFailed, setLoadFailed] = useState(false)

  const configQuery = useQuery({
    queryFn: fetchConfig,
    queryKey: ['models'],
  })

  useEffect(() => {
    // A backend with no providers configured returns an empty list; the composer
    // degrades to a disabled model select rather than the chat crashing here.
    const models = configQuery.data?.models
    // Nothing has come back yet. Leaving the selection alone matters on a failed
    // refetch, where the last good configuration is still what the backend has.
    if (!models) return
    setModel((current) => resolveSelectedModel(models, current))
  }, [configQuery.data])

  // Builtin tools are advertised per model, so a tool enabled on one model must
  // not keep riding along on a model that does not offer it — the chip that
  // would switch it off is gone from the toolbar by then.
  useEffect(() => {
    const allowed = configQuery.data?.models.find((entry) => entry.id === model)?.builtinTools ?? []
    setEnabledTools((prev) => {
      const next = prev.filter((id) => allowed.includes(id))
      return next.length === prev.length ? prev : next
    })
  }, [configQuery.data, model])

  useEffect(() => {
    // A read that is still in flight when the next navigation starts must not
    // install its result: IndexedDB reads can finish out of order, so a large
    // history left behind could land on top of the small one now on screen —
    // the previous conversation's messages under this one's title, and anything
    // typed next saved against the stale id.
    let superseded = false

    setEditingMessageId(null)
    setLoadFailed(false)
    // Nothing else leaves the `error` status: assigning `messages` touches only
    // messages, `stop` returns early unless a run is live, and this component
    // stays mounted across navigation. Left set, one failed run's card renders
    // over every conversation opened afterwards, and suppresses the welcome
    // screen on the new chat that follows it.
    sessionRef.current.clearError()

    // A deferred send belongs to one conversation. Leaving before its history
    // arrives abandons it: left in place it suppresses the welcome screen on
    // whatever empty chat comes next, and would fire the old prompt if its
    // target were ever reopened.
    if (pendingSendRef.current && pendingSendRef.current.conversationId !== conversationId) {
      pendingSendRef.current = null
    }

    // The conversation this session just created: the messages already in
    // memory are its own, and a run is streaming into it. Neither clear nor
    // stop applies.
    if (createdHereRef.current === conversationId) {
      createdHereRef.current = null
      setLoadedConversationId(conversationId)
      return
    }

    // Deleted in this session, reached by Back or a stale link. Left alone it
    // opens as an empty chat under the old id, and every message typed into it
    // is dropped by the write guard without a word.
    if (conversationId !== '/' && isConversationDeleted(conversationId)) {
      window.history.replaceState({}, '', withBasePath('/'))
      window.dispatchEvent(new Event('history-state-changed'))
      return
    }

    // Abandon any run still streaming into the conversation we are leaving.
    // Without this the SDK keeps appending its chunks, and they land in
    // whichever conversation is now on screen.
    //
    // `stop()` only fires the abort. The chunks already queued behind it still
    // drain — the stream job never consults the abort signal — and each one
    // writes into whatever list the session holds by then, which is the next
    // conversation's. Retiring the session is what makes those writes inert:
    // they go on landing in an object nothing renders, persists or sends.
    // Emptying it first also keeps its auto-send predicate from firing a
    // request of its own once the run tears down.
    let session = sessionRef.current
    if (session.status === 'streaming' || session.status === 'submitted') {
      void session.stop()
      session.messages = []
      session = createSession()
      sessionRef.current = session
      setSession(session)
    }

    // Flush before clearing. `useThrottle` cancels its pending write whenever
    // the value changes, and the clear below changes it — so leaving within
    // 500ms of the last chunk dropped that tail, taking the reply's usage
    // metadata with it.
    const leavingId = loadedIdRef.current
    const leavingMessages = messagesRef.current
    // Same rule the save effect follows: an untouched visit is not a write, and
    // flushing one here would put the conversation back at the top of the
    // sidebar for having been read.
    if (
      leavingMessages !== loadedMessagesRef.current &&
      leavingId !== null &&
      leavingId !== '/' &&
      leavingMessages.length > 0
    ) {
      saveMessages(leavingId, leavingMessages).catch((err: unknown) => {
        console.error('Failed to save messages:', err)
      })
    }

    // Clear first either way: leaving the old messages mounted while the read is
    // in flight shows the previous conversation under this one's title, and the
    // save effect would then persist them under this id.
    session.messages = []
    loadedMessagesRef.current = null
    setLoadedConversationId(conversationId === '/' ? '/' : null)

    if (conversationId !== '/') {
      getMessages(conversationId)
        .then((storedMessages) => {
          if (superseded) return
          session.messages = storedMessages ?? []
          // Read back rather than keeping the array just assigned: the setter
          // stores a copy, and the save effect's echo test compares identity
          // against the copy the UI is handed.
          loadedMessagesRef.current = session.messages
          setLoadedConversationId(conversationId)

          // Auto-send the forked message once its own conversation is loaded.
          // Navigating elsewhere before the read lands must not deliver it into
          // whichever conversation happens to finish loading next.
          if (pendingSendRef.current?.conversationId === conversationId) {
            setSendTrigger((n) => n + 1)
          }
        })
        .catch((err: unknown) => {
          if (superseded) return
          console.error('Failed to load messages:', err)
          // Deliberately left unloaded. Marking it loaded would arm the save
          // effect against an empty `messages`, so the next reply would be
          // written over the history that merely failed to *read* — a transient
          // storage error turned into permanent data loss. Unloaded, the
          // composer refuses to send and the banner offers a retry instead.
          setLoadFailed(true)
        })
    }
    textareaRef.current?.focus()

    return () => {
      superseded = true
    }
  }, [conversationId, loadAttempt])

  const handleSubmit = (e: SyntheticEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    // The send button is swapped for a stop control mid-run, but Enter in the
    // textarea still calls `requestSubmit()`. Without this guard a follow-up
    // typed while a tool call is in flight would drop the streaming assistant
    // turn below and fire a second, concurrent request.
    if (status === 'submitted' || status === 'streaming') return
    // The history is still being read: `messages` is empty, so the request
    // would go out without it and the read would then land on top of whatever
    // came back.
    if (loadedConversationId !== conversationId) return
    // The send button is disabled without a model, but Enter bypasses it. Sending
    // `model: ''` either fails the request or lets the backend pick something the
    // user did not choose.
    if (!model) {
      toast.error('No model available yet. Check that the backend is configured.')
      return
    }

    // we're starting a new conversation
    if (stripBasePath(window.location.pathname) === '/') {
      const newConversationId = `/${nanoid()}`
      createdHereRef.current = newConversationId
      // `setConversationId` pushes the URL itself; pushing again here left two
      // identical history entries, so Back appeared to do nothing.
      setConversationId(newConversationId)
      saveConversationEntry(newConversationId, input)
    } else if (messages.length === 0) {
      // An id with no history behind it: a bookmark to a conversation cleared
      // from this browser, or a mistyped URL. It opened as an empty chat and
      // accepted messages, but nothing created an entry for it — so the reply
      // was stored under an id the sidebar had never heard of and disappeared
      // as soon as it was navigated away from. Insert-only, so a conversation
      // that does exist keeps its title, pin and place in the list.
      ensureConversationEntry(conversationEntry(conversationId, input)).catch((err: unknown) => {
        console.error('Failed to create conversation:', err)
      })
    }

    // A run stopped mid tool-call leaves a tool part with no output, and
    // pydantic-ai rejects an orphaned tool call — same cleanup `handleContinue`
    // does, which the plain send path was missing.
    const lastMessage = messages.at(-1)
    if (lastMessage?.role === 'assistant' && hasIncompleteToolPart(lastMessage.parts)) {
      // An unanswered tool call cannot be left in the history, so the whole
      // trailing turn goes — including any prose above it. That is a lot to
      // remove without a word, and it is easy to trigger by typing instead of
      // answering an approval prompt.
      toast.info('Removed the unfinished tool call so your message could be sent.')
      queueSend(input, messages.length - 1)
      setInput('')
      return
    }

    sendMessage({ text: input }).catch((error: unknown) => {
      console.error('Error sending message:', error)
    })
    setInput('')
  }

  /**
   * Send `text` once `messages` has been truncated to `keep` entries.
   *
   * The order matters and is easy to get subtly wrong by hand: the ref has to be
   * set before the truncation, and the trigger bumped in a later macrotask so
   * the truncation is committed before the send effect reads it. Four call sites
   * had a copy each.
   */
  const queueSend = useCallback(
    (text: string, keep: number) => {
      pendingSendRef.current = { text, conversationId }
      sessionRef.current.messages = messagesRef.current.slice(0, keep)
      setTimeout(() => {
        setSendTrigger((n) => n + 1)
      }, 0)
    },
    [conversationId],
  )

  // Fires deferred sendMessage after the truncated messages have been committed
  useEffect(() => {
    if (!pendingSendRef.current) return
    const pending = pendingSendRef.current
    pendingSendRef.current = null
    sendMessage({ text: pending.text }).catch((error: unknown) => {
      console.error('Error sending deferred message:', error)
    })
  }, [sendTrigger])

  useEffect(() => {
    const { id, messages: pending } = throttled
    // Reading is not writing: the snapshot a load produced is byte-for-byte what
    // is already stored.
    if (pending === loadedMessagesRef.current) return
    if (id !== null && id !== '/' && pending.length > 0) {
      saveMessages(id, pending).catch((err: unknown) => {
        console.error('Failed to save messages:', err)
      })
    }
  }, [throttled])

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

    queueSend(pendingEdit.text, messageIndex)
    setPendingEdit(null)
  }, [pendingEdit, messages, queueSend])

  // Retry: re-run the last user message, discarding everything generated after
  // it (partial assistant text, in-progress tool parts, whole tool-loop turns).
  const handleRetry = useCallback(() => {
    // First, and unconditionally: with no user message to re-run there is
    // nothing to send, but leaving the error state is still what the button
    // says it does. Bailing before this left the card sitting there, the click
    // doing nothing at all.
    clearError()

    let i = messages.length - 1
    while (i >= 0 && messages[i].role !== 'user') i--
    if (i === -1) return

    const userMessage = messages[i]
    const textPart = userMessage.parts.find((p) => p.type === 'text')
    const text = textPart && 'text' in textPart ? textPart.text : ''

    // Drop the user message too; the deferred send re-adds it cleanly.
    queueSend(text, i)
  }, [messages, clearError, queueSend])

  // Continue: append a `continue` user message to a valid history. If the run
  // errored mid-tool-call, the trailing assistant message may hold a tool part
  // with no output; pydantic-ai rejects an orphaned tool call, so drop that
  // trailing assistant message first.
  const handleContinue = useCallback(() => {
    // The same lockout `handleSubmit` is under. The card is on screen while a
    // conversation's history has failed to read or is still in flight, and from
    // there this would post `continue` with no history behind it and no way to
    // persist the reply.
    if (loadedConversationId !== conversationId) return

    const lastMessage = messages.at(-1)
    if (lastMessage?.role === 'assistant' && hasIncompleteToolPart(lastMessage.parts)) {
      clearError()
      queueSend('continue', messages.length - 1)
      return
    }

    clearError()
    sendMessage({ text: 'continue' }).catch((error: unknown) => {
      console.error('Error continuing message:', error)
    })
  }, [messages, clearError, sendMessage, queueSend, loadedConversationId, conversationId])

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

    // Not `queueSend`: this one is fired by the load effect once the fork's own
    // history has been read, not by a timer here — sending before that would go
    // out without the history it was forked from.
    pendingSendRef.current = { text: pendingEdit.text, conversationId: newConversationId }

    setPendingEdit(null)
    setConversationId(newConversationId)
  }, [pendingEdit, messages, conversationId, setConversationId])

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

  const handleToggleTool = useCallback((id: string) => {
    setEnabledTools((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]))
  }, [])

  const handleSuggestion = useCallback((prompt: string) => {
    setInput(prompt)
    const textarea = textareaRef.current
    textarea?.focus()
    // Land the caret at the end so an open-ended starter ("Explain how ") can
    // just be typed into. The clamp to the old draft's length that this looks
    // like it would hit does not happen: committing the new value resets the
    // selection to the end of it, which `welcome.spec.ts` pins down.
    textarea?.setSelectionRange(prompt.length, prompt.length)
  }, [])

  const renderTurn = (message: UIMessage, messageIndex: number, isStreaming = false) =>
    renderMessageParts(
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
      isStreaming,
    )

  const loadErrorBanner = loadFailed && (
    <ConversationLoadError
      onRetry={() => {
        setLoadAttempt((n) => n + 1)
      }}
    />
  )

  const configBanner = configQuery.isError && (
    <ConfigErrorBanner
      isRetrying={configQuery.isFetching}
      onRetry={() => {
        configQuery.refetch().catch((error: unknown) => {
          console.error('Error reloading configuration:', error)
        })
      }}
    />
  )

  const renderComposer = (showHint: boolean) => (
    <ChatComposer
      canSend={loadedConversationId === conversationId}
      showHint={showHint}
      usage={<UsageSummary messages={messages} />}
      input={input}
      onInputChange={setInput}
      onSubmit={handleSubmit}
      onStop={() => {
        stop().catch((error: unknown) => {
          console.error('Error stopping generation:', error)
        })
      }}
      status={status}
      textareaRef={textareaRef}
      models={configQuery.data?.models ?? []}
      model={model}
      onModelChange={setModel}
      effort={effort}
      onEffortChange={(value) => {
        setEffort(value)
        writeEffort(value)
      }}
      availableTools={availableTools}
      enabledTools={enabledTools}
      onToggleTool={handleToggleTool}
      onOpenFilters={() => {
        setFiltersDialogOpen(true)
      }}
      hiddenToolCount={filters.length}
      isLoadingModels={configQuery.isPending}
    />
  )

  const dialogs = (
    <>
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

  // An empty chat opens as one centred column — greeting, composer, starting
  // points — rather than a blank page with the input pinned to the floor.
  // Gated on the conversation having finished loading, so reopening a stored
  // conversation does not flash the welcome screen before its messages arrive,
  // and on no send being queued: retrying, or modifying the first message,
  // empties `messages` for a frame on its way to re-sending it, which otherwise
  // threw up the greeting and remounted the composer under the caret.
  if (
    messages.length === 0 &&
    status === 'ready' &&
    loadedConversationId === conversationId &&
    pendingSendRef.current === null
  ) {
    return (
      <>
        {/* `my-auto` rather than `items-center`: a centred flex child cannot be
            scrolled back to once it overflows, which clipped the heading on
            short viewports. */}
        <div className="flex flex-1 flex-col overflow-y-auto py-8">
          <div className="my-auto w-full">
            <WelcomeScreen
              onSelect={handleSuggestion}
              composer={
                <>
                  {configBanner}
                  {renderComposer(false)}
                </>
              }
            />
          </div>
        </div>
        {dialogs}
      </>
    )
  }

  return (
    <>
      <Conversation className="h-full" aria-label="Conversation">
        <ConversationContent className="mx-auto flex w-full max-w-3xl flex-col px-4 pt-2 pb-6">
          {messages.map((message, messageIndex) => {
            if (message.role !== 'assistant') {
              return (
                <div key={message.id} className="group/user-message">
                  {renderTurn(message, messageIndex)}
                </div>
              )
            }

            const sourceParts = message.parts.filter((part) => part.type === 'source-url')
            const isLast = message.id === messages.at(-1)?.id
            const isStreaming = (status === 'streaming' || status === 'submitted') && isLast
            return (
              <AssistantTurn key={message.id} isStreaming={status === 'streaming' && isLast}>
                {sourceParts.length > 0 && (
                  <Sources className="mb-0">
                    <SourcesTrigger count={sourceParts.length} />
                    {sourceParts.map((part, i) => (
                      <SourcesContent key={`${message.id}-source-${i}`}>
                        <Source href={part.url} title={part.url} />
                      </SourcesContent>
                    ))}
                  </Sources>
                )}
                {renderTurn(message, messageIndex, isStreaming)}
              </AssistantTurn>
            )
          })}

          {/* Only when there is no assistant turn to continue. Answering an
              approval sends the run back to `submitted` with the turn still on
              screen and already showing its own live activity, so this added a
              second avatar and a second "Thinking" underneath it — for as long
              as the backend took to send the next chunk. */}
          {status === 'submitted' && messages.at(-1)?.role !== 'assistant' && (
            <AssistantTurn>
              <ThinkingIndicator />
            </AssistantTurn>
          )}

          {status === 'error' && error && (
            // Indented to the assistant column, so a failure lines up with the
            // reply it belongs to instead of starting at the page edge.
            <div className="sm:pl-10">
              <ChatError message={error.message} onRetry={handleRetry} onContinue={handleContinue} />
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton className="bg-background shadow-md" />
      </Conversation>

      {/* The fade keeps text from colliding with the composer as it scrolls
          under the sticky footer. */}
      <div className="from-background pointer-events-none sticky bottom-0 h-6 bg-gradient-to-t to-transparent" />
      {/* No horizontal padding here: the composer and the banner carry the same
          `px-4` inside their own `max-w-3xl` box that `ConversationContent` does,
          which is what puts all three on the same edges. */}
      <div className="bg-background sticky bottom-0 pt-1 pb-3">
        {loadErrorBanner}
        {configBanner}
        {renderComposer(true)}
      </div>

      {dialogs}
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
  isStreaming: boolean,
): ReactNode[] {
  const descriptors = message.parts.map((part) => {
    const toolName = toolNameOfPart(part)
    return { toolName, filtered: toolName !== null && isFiltered(toolName) }
  })

  const renderRun = (run: PartRun): ReactNode => {
    if (run.kind === 'single') {
      return renderPart(message.parts[run.index], run.index)
    }
    if (run.kind === 'hidden') {
      return (
        <HiddenToolsGroup
          key={`hidden-${message.id}-${run.indices[0]}`}
          toolNames={run.indices.map((i) => descriptors[i].toolName ?? '')}
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
  }

  // Laid out before anything renders, because a block cannot tell whether it is
  // still live until it knows what follows it.
  const items: ({ kind: 'activity'; runs: PartRun[] } | { kind: 'part'; run: PartRun })[] = []
  // Consecutive work — thinking and tool calls — collects into one foldable
  // block, so a turn reads as "what the agent did" then "what it said" rather
  // than as a stack of cards the answer has to be scrolled past.
  let activity: PartRun[] = []

  const flushActivity = () => {
    if (activity.length === 0) return
    items.push({ kind: 'activity', runs: activity })
    activity = []
  }

  for (const run of groupParts(descriptors)) {
    // Parts the message column draws nothing for still ended the current run,
    // so a tool loop split into a foldable block per invisible marker — the
    // exact shape the single block exists to collect. `step-start` marks a model
    // step boundary and sources are collected into the strip above the turn, and
    // a provider that cites its sources emits them between the calls they came
    // from.
    if (run.kind === 'single' && !isRenderedPart(message.parts[run.index], descriptors[run.index].toolName)) continue
    if (run.kind !== 'single' || isActivityPart(message.parts[run.index], descriptors[run.index].toolName)) {
      activity.push(run)
      continue
    }
    flushActivity()
    items.push({ kind: 'part', run })
  }
  flushActivity()

  return items.map((item, position) => {
    if (item.kind === 'part') return renderRun(item.run)

    const { runs } = item
    const indices = runs.flatMap((run) => (run.kind === 'single' ? [run.index] : run.indices))
    // Filtered calls are folded into the hidden-tools line inside the block, so
    // naming them on the summary line above it would hand back exactly what the
    // filter was asked to take away.
    const toolIndices = indices.filter((i) => descriptors[i].toolName !== null && !descriptors[i].filtered)

    return (
      <TurnActivity
        key={`activity-${message.id}-${indices[0]}`}
        calls={toolIndices.map((i) => ({
          name: descriptors[i].toolName ?? '',
          state: partState(message.parts[i]),
        }))}
        hasReasoning={indices.some((i) => message.parts[i].type === 'reasoning')}
        // Only the last block of a streaming reply is live. A turn that works,
        // answers, then works again renders two blocks, and handing both the
        // message's streaming flag left the first one spinning "Working" and
        // counting time it was no longer spending — anything rendered after a
        // block means the model has moved on from it.
        isStreaming={isStreaming && position === items.length - 1}
      >
        {runs.map((run) => (
          <TurnActivityStep key={`step-${message.id}-${run.kind === 'single' ? run.index : run.indices[0]}`}>
            {renderRun(run)}
          </TurnActivityStep>
        ))}
      </TurnActivity>
    )
  })
}

// Whether `Part` puts anything on screen for this part. Kept in step with the
// branches in `Part.tsx`: text, reasoning and tool calls render, and everything
// else a message can carry (`step-start`, sources, files) draws nothing here.
// `toolName` comes from the descriptor the caller already built — this runs for
// every part of every message on every streamed chunk, so re-deriving it here
// was several thousand throwaway allocations a second on a long conversation.
function isRenderedPart(part: UIMessagePart<UIDataTypes, UITools>, toolName: string | null): boolean {
  return part.type === 'text' || part.type === 'reasoning' || toolName !== null
}

// What belongs in the activity block: the model's thinking and its tool calls.
// Prose is the answer and stays out of it; sources render in their own strip
// above the turn.
function isActivityPart(part: UIMessagePart<UIDataTypes, UITools>, toolName: string | null): boolean {
  return part.type === 'reasoning' || toolName !== null
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

// Long enough to make a useful header title; the sidebar truncates its own row
// with CSS rather than relying on this.
const MAX_FIRST_MESSAGE_LENGTH = 100

function conversationEntry(
  newConversationId: string,
  firstMessage: string,
  forkOf?: ConversationEntry['forkOf'],
): ConversationEntry {
  const trimmedFirstMessage =
    firstMessage.length > MAX_FIRST_MESSAGE_LENGTH
      ? firstMessage.slice(0, MAX_FIRST_MESSAGE_LENGTH) + '...'
      : firstMessage

  const now = Date.now()
  const entry: ConversationEntry = {
    id: newConversationId,
    firstMessage: trimmedFirstMessage,
    timestamp: now,
    createdAt: now,
  }
  if (forkOf) {
    entry.forkOf = forkOf
  }
  return entry
}

function saveConversationEntry(newConversationId: string, firstMessage: string, forkOf?: ConversationEntry['forkOf']) {
  saveConversation(conversationEntry(newConversationId, firstMessage, forkOf)).catch((err: unknown) => {
    console.error('Failed to save conversation:', err)
  })
}
