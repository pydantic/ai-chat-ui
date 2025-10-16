import { CirclePlus, MessageCircle, Trash } from 'lucide-react'
import type React from 'react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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

function doLocalNavigation(e: React.MouseEvent) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey) {
    return
  }
  const path = new URL((e.currentTarget as HTMLAnchorElement).href).pathname
  window.history.pushState({}, '', path)
  // custom event to notify other components of the URL change
  window.dispatchEvent(new Event('history-state-changed'))
  e.preventDefault()
}

function deleteConversation(conversationId: string) {
  // Remove from conversationIds list
  const stored = window.localStorage.getItem('conversationIds')
  if (stored) {
    const conversations = JSON.parse(stored) as ConversationEntry[]
    const updated = conversations.filter((conv) => conv.id !== conversationId)
    window.localStorage.setItem('conversationIds', JSON.stringify(updated))
    // Dispatch event to notify other components
    window.dispatchEvent(new Event('local-storage-change'))
  }

  // Remove the conversation's messages
  window.localStorage.removeItem(conversationId)

  // If the deleted conversation was active, navigate to home
  const currentPath = window.location.pathname
  if (currentPath === conversationId) {
    window.history.pushState({}, '', '/')
    window.dispatchEvent(new Event('history-state-changed'))
  }
}

export function AppSidebar() {
  const conversations = useConversations()
  const [conversationId] = useConversationIdFromUrl()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<ConversationEntry | null>(null)

  const handleDeleteClick = (e: React.MouseEvent, conversation: ConversationEntry) => {
    e.preventDefault()
    e.stopPropagation()
    setConversationToDelete(conversation)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (conversationToDelete) {
      deleteConversation(conversationToDelete.id)
      setDeleteDialogOpen(false)
      setConversationToDelete(null)
      toast.success('Chat deleted successfully')
    }
  }

  return (
    <TooltipProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarTrigger className="ml-auto" />
          <div className="ml-2 flex items-center">
            <h1 className="text-l font-medium text-balance truncate whitespace-nowrap">
              <img src="/logo.svg" className="inline h-4 mr-2 mb-1" />
              <span className="group-data-[state=collapsed]:invisible">Pydantic AI Web UI</span>
            </h1>
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
                  <SidebarMenuItem key={index} className="group/sidebar-menu-item">
                    <div className="flex items-center gap-1 h-auto">
                      <SidebarMenuButton asChild tooltip={conversation.firstMessage} className="flex-1">
                        <a
                          href={conversation.id}
                          onClick={doLocalNavigation}
                          className={cn('h-auto flex items-start gap-2', {
                            'bg-accent pointer-events-none': conversation.id === conversationId,
                          })}
                        >
                          <MessageCircle className="size-3 mt-1" />
                          <span className="flex flex-col items-start">
                            <span className="truncate max-w-44">{conversation.firstMessage}</span>
                            <span className="text-xs opacity-30">
                              {new Date(conversation.timestamp).toLocaleString()}
                            </span>
                          </span>
                        </a>
                      </SidebarMenuButton>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-1.5 opacity-0 group-hover/sidebar-menu-item:opacity-100 transition-opacity group-data-[state=collapsed]:hidden absolute right-0 self-start"
                            onClick={(e) => {
                              handleDeleteClick(e, conversation)
                            }}
                          >
                            <Trash className="size-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete conversation</TooltipContent>
                      </Tooltip>
                    </div>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <ModeToggle />
        </SidebarFooter>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleConfirmDelete()
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>Delete conversation?</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this chat? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false)
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleConfirmDelete} autoFocus>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Sidebar>
    </TooltipProvider>
  )
}
