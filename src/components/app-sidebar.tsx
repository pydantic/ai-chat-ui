import { CirclePlus, MessageCircle } from 'lucide-react'
import { type MouseEvent, useEffect, useState } from 'react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { useConversationIdFromUrl } from '@/hooks/useConversationIdFromUrl'
import { cn } from '@/lib/utils'
import type { ConversationEntry } from '@/types'
import { ModeToggle } from './mode-toggle'

function useConversations(): ConversationEntry[] {
  const [conversations, setConversations] = useState<ConversationEntry[]>(() => {
    const stored = window.localStorage.getItem('conversationIds')
    return stored ? (JSON.parse(stored) as ConversationEntry[]) : []
  })

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'conversationIds' && e.newValue) {
        setConversations(JSON.parse(e.newValue) as ConversationEntry[])
      }
    }

    const handleCustomStorageChange = () => {
      const stored = window.localStorage.getItem('conversationIds')
      setConversations(stored ? (JSON.parse(stored) as ConversationEntry[]) : [])
    }

    window.addEventListener('storage', handleStorageChange)
    // a custom event to handle same-tab updates
    window.addEventListener('local-storage-change', handleCustomStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('local-storage-change', handleCustomStorageChange)
    }
  }, [])

  return conversations
}

function doLocalNavigation(e: MouseEvent) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey) {
    return
  }
  const path = new URL((e.currentTarget as HTMLAnchorElement).href).pathname
  window.history.pushState({}, '', path)
  // custom event to notify other components of the URL change
  window.dispatchEvent(new Event('history-state-changed'))
  e.preventDefault()
}

export function AppSidebar() {
  const conversations = useConversations()
  const [conversationId] = useConversationIdFromUrl()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="mt-4 ml-4 flex items-center">
          <h1 className="text-l font-medium text-balance group-data-[state=collapsed]:invisible truncate whitespace-nowrap">
            Pydantic AI Chat
          </h1>

          <SidebarTrigger className="ml-auto mr-2 group-data-[state=collapsed]:-translate-x-3" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className="mb-2">
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Start a new conversation">
                <a href="/" onClick={doLocalNavigation}>
                  <CirclePlus />
                  <span>New conversation</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>

          <SidebarGroupContent>
            <SidebarMenu>
              {conversations.map((conversation, index) => (
                <SidebarMenuItem key={index}>
                  <SidebarMenuButton asChild tooltip={conversation.firstMessage}>
                    <a
                      href={conversation.id}
                      onClick={doLocalNavigation}
                      className={cn('h-auto flex items-start gap-2', {
                        'bg-accent pointer-events-none': conversation.id === conversationId,
                      })}
                    >
                      <MessageCircle className="size-3 mt-1" />
                      <span className="flex flex-col items-start">
                        <span className="truncate max-w-[150px]">{conversation.firstMessage}</span>
                        <span className="text-xs opacity-30">{new Date(conversation.timestamp).toLocaleString()}</span>
                      </span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <ModeToggle />
      </SidebarFooter>
    </Sidebar>
  )
}
