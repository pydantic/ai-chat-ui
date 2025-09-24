import { useState, useEffect } from 'react'

export function useConversationIdFromUrl(): [string, (id: string) => void] {
  const [conversationId, setConversationId] = useState(() => {
    return window.location.pathname
  })

  useEffect(() => {
    const handlePopState = () => {
      const newId = window.location.pathname
      console.log('popstate event detected', window.location.pathname)
      setConversationId(newId)
    }

    window.addEventListener('popstate', handlePopState)
    // local event to handle same-tab updates
    window.addEventListener('history-state-changed', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('history-state-changed', handlePopState)
    }
  }, [])

  const setConversationIdAndUrl = (id: string) => {
    setConversationId(id)
    const url = new URL(window.location.toString())
    url.pathname = id || '/'
    window.history.pushState({}, '', url.toString())
  }

  return [conversationId, setConversationIdAndUrl]
}
