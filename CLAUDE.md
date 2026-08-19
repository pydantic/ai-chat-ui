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
npm run build:offline    # Build offline/index.html, one self-contained file for air-gapped hosting
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

**Testing:**

```bash
pnpm test                # Headless (vitest) + deterministic E2E (playwright)
pnpm test:headless       # Vitest unit/integration against the FastAPI test server
pnpm test:e2e            # Deterministic Playwright E2E (no API keys needed)
pnpm test:e2e:llm        # Live-LLM Playwright E2E (requires provider API keys)
pnpm test:e2e:ui         # Playwright in UI mode for debugging
pnpm test:e2e:offline    # Build the offline artifact and assert it renders with the network blocked
pnpm test:server         # Just the FastAPI test server (port 38787), for iterating manually
```

Set `E2E_VIDEO=1` to record screen videos with `slowMo`. Set `E2E_TEST_DIR=<path>` to override which directory Playwright walks (defaults to `tests/e2e`; `pnpm test:e2e` narrows it to `tests/e2e/deterministic`). The offline suite ignores `E2E_TEST_DIR` — it runs off its own `playwright.offline.config.ts`, which serves the built artifact with `vite preview` instead of the dev server.

Test infrastructure lives entirely in `tests/`:

- `tests/server/server.py` — deterministic FastAPI server wired to pydantic-ai's `FunctionModel`. Its `models` mapping is the authoritative fixture registry; specs select entries via `sendMessage(page, '<name>', '...')`.
- `tests/chat-client.ts`, `tests/global-setup.ts` — Vitest helpers that spawn an ephemeral test server on an OS-assigned port.
- `tests/e2e/deterministic/*.spec.ts` — Playwright specs run on every PR against `FunctionModel`-backed fixtures.
- `tests/e2e/offline/*.spec.ts` — Playwright specs against the built `offline/index.html` with every non-loopback request aborted, so an asset that stops being inlined fails the run instead of being quietly served by the real CDN.
- `tests/e2e/llm/llm.spec.ts` — live-provider smoke tests, gated on `workflow_dispatch` in CI.
- `tests/headless/*.test.ts` — Vitest tests exercising the wire protocol directly via `TestChat` (no browser).

## Architecture

### Frontend Structure

- **src/Chat.tsx**: Main chat component handling conversation state, message sending, and persistence coordination
- **src/Part.tsx**: Renders individual message parts (text, reasoning, tools, etc.)
- **src/App.tsx**: Root component with theme provider, sidebar, and React Query setup
- **src/components/ai-elements/**: Vercel AI Elements wrappers (conversation, prompt-input, message, tool, reasoning, sources, etc.)
- **src/components/ui/**: Radix UI and shadcn/ui components

The shell is composed as sidebar → `AppHeader` → conversation → `ChatComposer`:

- **app-header.tsx**: sidebar toggle, conversation title (also the tab title), new chat, theme toggle
- **welcome-screen.tsx**: empty-conversation state with suggested prompts
- **assistant-turn.tsx** / **user-bubble.tsx**: per-role message layout. An assistant turn is one avatar-gutter column holding that turn's reasoning, tool cards and prose
- **chat-composer.tsx**: message box plus the per-run settings (model, effort, builtin tools) and the stop control
- **tool-part-header.tsx**: collapsed tool-card row, including the one-line argument preview from `lib/tool-summary.ts`

### Key Frontend Concepts

**Conversation Management:**

- Conversations and messages are stored by ID in the `chat-storage` IndexedDB database
- URL-based routing: `/` for new chat, `/{nanoid}` for existing
- Messages are persisted from the active SDK chat session on a 500ms throttle
- Access persistence through `src/lib/chat-db.ts`
- Include both stores in message-write and deletion transactions to serialize them across tabs
- `App` migrates legacy `localStorage` conversations once on startup

**Model & Tool Selection:**

- Dynamic model/tool configuration fetched from the configured API path (`/api/configure` by default)
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

**Default endpoints:**

- `GET /api/configure`: Returns available models and builtin tools (camelCase)
- `POST /api/chat`: Handles chat messages via `VercelAIAdapter`
  - Accepts `model` and `builtinTools` in request body extra data
  - Streams responses using SSE

Set `window.PYDANTIC_AI_CHAT_CONFIG` before the UI module executes to override paths at runtime.

- Use `basePath` to control conversation navigation.
- Use `apiPath` as the complete same-origin directory containing `configure` and `chat`.
- Keep `apiPath` independent of `basePath`; its default is `/api/`.

**Token usage:**

The UI shows per-reply and per-conversation token counts, read from `UIMessage.metadata.usage` on assistant messages:

```json
{ "usage": { "inputTokens": 120, "outputTokens": 30, "totalTokens": 150, "requests": 1, "toolCalls": 0 } }
```

`snake_case` keys are accepted too. A backend puts them there by writing `ModelResponse.metadata` before the adapter emits its `message-metadata` chunk — see `UsageEventStream` in `tests/server/server.py` for a working ~20-line implementation. The figures are per-message, not per-run: when the trailing message a run receives is already an assistant message (an approval continuation), the client keeps that message and deep-merges the new metadata into it, so a backend must add its run's usage to what that message already carries rather than assign it. `Agent.to_web()` does not report usage today (it hardcodes `VercelAIAdapter` with no seam), so agents served that way fall back to a locally-derived estimate, which the UI labels with `~`.

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

Two normalizations are part of vendoring itself, not local modifications: files are formatted with the repo's Prettier config, and Radix imports use the granular `@radix-ui/react-<name>` package instead of the `radix-ui` umbrella the current shadcn generator emits — the umbrella pins its own copies of internal primitives (react-dismissable-layer, react-focus-scope, react-primitive), which made the single-file offline artifact ship two of each. Apply both when re-vendoring; a diff that consists only of these is not a modification.

## Configuration

- **TypeScript paths**: `@/*` maps to `./src/*`
- **Vite base URL**: CDN path for production (`jsdelivr.net/npm/@pydantic/pydantic-ai-chat/dist/`)
- **Runtime paths**: `window.PYDANTIC_AI_CHAT_CONFIG` supplies independent `basePath` and `apiPath` values
- **Dev proxy**: `/api` proxied to `localhost:38001`
- **Package**: Published as `@pydantic/pydantic-ai-chat` (public npm package)

## Tech Stack

- React 19, TypeScript, Vite, Tailwind CSS 4
- Vercel AI SDK (`@ai-sdk/react`, `ai`)
- Radix UI primitives
- FastAPI, Pydantic AI, LanceDB
- ESLint (neostandard), Prettier
