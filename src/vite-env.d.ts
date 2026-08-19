/// <reference types="vite/client" />

interface Window {
  PYDANTIC_AI_CHAT_CONFIG?: import('./lib/config').StartupConfig
}
