import { useEffect, useState } from 'react'
import Chat from './Chat.tsx'
import { AppSidebar } from './components/app-sidebar.tsx'
import { ThemeProvider } from './components/theme-provider.tsx'
import { SidebarProvider } from './components/ui/sidebar.tsx'
import { Toaster } from './components/ui/sonner.tsx'
import { cn } from './lib/utils.ts'
import { migrateFromLocalStorage } from './lib/chat-db.ts'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    migrateFromLocalStorage()
      .then((migrated) => {
        if (migrated) {
          window.dispatchEvent(new Event('conversations-changed'))
        }
      })
      .catch((err: unknown) => {
        console.error('Migration failed:', err)
      })
      .finally(() => {
        setReady(true)
      })
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="pydantic-chat-ui-theme">
        <SidebarProvider defaultOpen>
          <AppSidebar />

          <div className="flex flex-col justify-center flex-1 h-screen overflow-hidden">
            <div
              className={cn(
                'flex flex-col max-w-4xl mx-auto relative w-full basis-[100vh] overflow-hidden',
                'has-[.stick-to-bottom:empty]:overflow-visible has-[.stick-to-bottom:empty]:basis-[0px] transition-[flex-basis] duration-200',
              )}
            >
              {ready && <Chat />}
            </div>
          </div>
        </SidebarProvider>
      </ThemeProvider>
      <Toaster richColors />
    </QueryClientProvider>
  )
}
