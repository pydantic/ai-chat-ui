# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A React-based chat interface for Pydantic AI that uses Vercel AI SDK and Elements. The project consists of a frontend (Vite + React + TypeScript) and a Python backend (FastAPI + Pydantic AI).

## Development Commands

**Frontend:**

```bash
npm install
npm run dev              # Start dev server (proxies /api to localhost:8000)
npm run build            # Build for production (CDN deployment via jsdelivr)
npm run typecheck        # Type check without emitting
npm run lint             # Run ESLint
npm run lint-fix         # Fix ESLint issues
npm run format           # Format with Prettier
```

**Backend:**

```bash
cd agent
uv run uvicorn chatbot.server:app  # Start backend on port 8000
```

Note: Stop any logfire platform instances to avoid port 8000 conflicts.

## Architecture

### Frontend Structure

- **src/Chat.tsx**: Main chat component handling conversation state, message sending, and local storage persistence
- **src/Part.tsx**: Renders individual message parts (text, reasoning, tools, etc.)
- **src/App.tsx**: Root component with theme provider, sidebar, and React Query setup
- **src/components/ai-elements/**: Vercel AI Elements wrappers (conversation, prompt-input, message, tool, reasoning, sources, etc.)
- **src/components/ui/**: Radix UI and shadcn/ui components

### Key Frontend Concepts

**Conversation Management:**

- Conversations stored in localStorage by ID (nanoid)
- URL-based routing: `/` for new chat, `/{nanoid}` for existing
- Messages persisted via `useChat` hook and localStorage sync (throttled 500ms)
- Conversation list stored in localStorage key `conversationIds`

**Model & Tool Selection:**

- Dynamic model/tool configuration fetched from `/api/configure`
- Models and available builtin tools configured per-model
- Tools toggled via checkboxes in prompt toolbar

**Message Parts:**

- Messages contain multiple parts: text, reasoning, tool calls, sources
- Part rendering delegated to `Part.tsx` component
- Tool calls show input/output with collapsible UI

### Backend Structure

- **agent/chatbot/server.py**: FastAPI app with Vercel AI adapter, model/tool configuration
- **agent/chatbot/agent.py**: Pydantic AI agent with documentation search tools
- **agent/chatbot/db.py**: LanceDB vector store for documentation
- **agent/chatbot/data.py**: Documentation loading and processing

### Backend Integration

**Endpoints:**

- `GET /api/configure`: Returns available models and builtin tools (camelCase)
- `POST /api/chat`: Handles chat messages via `VercelAIAdapter`
  - Accepts `model` and `builtinTools` in request body extra data
  - Streams responses using SSE

**Builtin Tools:**

- `web_search`, `code_execution`, `image_generation`
- Enabled per-model in AI_MODELS configuration
- Selected tools passed to agent via `VercelAIAdapter.dispatch_request`

## Frontend code structure

### One component per file

Non-trivial React components live in their own file. Trivial means: pure JSX, no state/effects, used in exactly one place, ~10 lines or fewer — those can be inline functions in the parent file. Everything else gets its own file.

File names are kebab-case (`tool-approval-prompt.tsx`); exported component names are PascalCase (`ToolApprovalPrompt`). Place files under:

- `src/components/{name}.tsx` — domain-specific compositions (`edit-message-dialog.tsx`, `tool-approval-prompt.tsx`)
- `src/components/ai-elements/{name}.tsx` — wrappers around `@ai-sdk` UI elements (`confirmation.tsx`, `tool.tsx`)
- `src/components/ui/{name}.tsx` — pure shadcn/ui primitives (`button.tsx`, `alert.tsx`)

`src/Chat.tsx` and `src/Part.tsx` are top-level composition orchestrators; the pieces they render belong in their own files.

### Vendored components are read-only

`src/components/ui/` (shadcn) and `src/components/ai-elements/` (Vercel AI Elements) are vendored from upstream registries. Treat them as read-only: never modify in place. To customize behavior, wrap the primitive in a new file under `src/components/`. To upgrade, re-run `npx shadcn@latest add <name>` (or `@ai-elements/<name>`) and review the diff.

A small number of pre-existing local modifications survive in these folders (e.g. the Dialog-based error display in `ai-elements/tool.tsx` from #11). Each is tagged with a `// local modification:` comment. Leave those as they are, but don't add new ones — extract a wrapper instead.

## Configuration

- **TypeScript paths**: `@/*` maps to `./src/*`
- **Vite base URL**: CDN path for production (`jsdelivr.net/npm/@pydantic/pydantic-ai-chat/dist/`)
- **Dev proxy**: `/api` proxied to `localhost:8000`
- **Package**: Published as `@pydantic/pydantic-ai-chat` (public npm package)

## Tech Stack

- React 19, TypeScript, Vite, Tailwind CSS 4
- Vercel AI SDK (`@ai-sdk/react`, `ai`)
- Radix UI primitives
- FastAPI, Pydantic AI, LanceDB
- ESLint (neostandard), Prettier
