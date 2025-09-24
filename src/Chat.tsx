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
import { useChat } from '@ai-sdk/react'
import { GlobeIcon } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'

import { useQuery } from '@tanstack/react-query'
import { useThrottle } from '@uidotdev/usehooks'
import { nanoid } from 'nanoid'
import { useConversationIdFromUrl } from './hooks/useConversationIdFromUrl'
import { Part } from './Part'
import type { ConversationEntry } from './types'

async function getModels() {
  const res = await fetch('/api/configure')
  return (await res.json()) as {
    models: { id: string; name: string }[]
  }
}

const Chat = () => {
  const [input, setInput] = useState('')
  const [model, setModel] = useState<string>('')
  const [webSearch, setWebSearch] = useState(false)
  const { messages, sendMessage, status, setMessages, regenerate } = useChat()
  const throttledMessages = useThrottle(messages, 500)
  const [conversationId, setConversationId] = useConversationIdFromUrl()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const query = useQuery({
    queryFn: getModels,
    queryKey: ['models'],
  })

  useEffect(() => {
    if (query.data) {
      setModel(query.data.models[0].id)
    }
  }, [query.data])

  useLayoutEffect(() => {
    if (conversationId === '/') {
      setMessages([])
    } else {
      const localStorageMessages = window.localStorage.getItem(conversationId)
      if (localStorageMessages) {
        setMessages(JSON.parse(localStorageMessages) as typeof messages)
      }
    }
    textareaRef.current?.focus()
  }, [conversationId])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      const theCurrentUrl = new URL(window.location.toString())

      // we're starting a new conversation
      if (theCurrentUrl.pathname === '/') {
        const newConversationId = `/${nanoid()}`
        setConversationId(newConversationId)

        saveConversationEntryInLocalStorage(newConversationId, input)

        theCurrentUrl.pathname = newConversationId
        window.history.pushState({}, '', theCurrentUrl.toString())
      }

      sendMessage(
        { text: input },
        {
          body: { model, webSearch },
        },
      ).catch((error: unknown) => {
        console.error('Error sending message:', error)
      })
      setInput('')
    }
  }

  useEffect(() => {
    if (conversationId && throttledMessages.length > 0) {
      window.localStorage.setItem(conversationId, JSON.stringify(throttledMessages))
    }
  }, [throttledMessages, conversationId])

  function regen(messageId: string) {
    regenerate({ messageId }).catch((error: unknown) => {
      console.error('Error regenerating message:', error)
    })
  }

  if (conversationId !== '/' && messages.length === 0) {
    return null
  }

  return (
    <>
      <Conversation className="h-full">
        <ConversationContent>
          {messages.map((message) => (
            <div key={message.id}>
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
                />
              ))}
            </div>
          ))}
          {status === 'submitted' && <Loader />}
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
              <PromptInputButton
                variant={webSearch ? 'default' : 'ghost'}
                onClick={() => {
                  setWebSearch(!webSearch)
                }}
              >
                <GlobeIcon size={16} />
                <span>Search</span>
              </PromptInputButton>
              {query.data && model && (
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
                    {(query.data as { models: { id: string; name: string }[] }).models.map((model) => (
                      <PromptInputModelSelectItem key={model.id} value={model.id}>
                        {model.name}
                      </PromptInputModelSelectItem>
                    ))}
                  </PromptInputModelSelectContent>
                </PromptInputModelSelect>
              )}
            </PromptInputTools>
            <PromptInputSubmit disabled={!input} status={status} />
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </>
  )
}

export default Chat

const MAX_FIRST_MESSAGE_LENGTH = 30

function saveConversationEntryInLocalStorage(newConversationId: string, firstMessage: string) {
  const currentConversations = window.localStorage.getItem('conversationIds') ?? '[]'
  const conversationIds = JSON.parse(currentConversations) as ConversationEntry[]
  const trimmedFirstMessage =
    firstMessage.length > MAX_FIRST_MESSAGE_LENGTH
      ? firstMessage.slice(0, MAX_FIRST_MESSAGE_LENGTH) + '...'
      : firstMessage
  conversationIds.unshift({
    id: newConversationId,
    firstMessage: trimmedFirstMessage,
    timestamp: Date.now(),
  })
  window.localStorage.setItem('conversationIds', JSON.stringify(conversationIds))
  // dispatch a custom event so that the sidebar can update
  window.dispatchEvent(new Event('local-storage-change'))
}
