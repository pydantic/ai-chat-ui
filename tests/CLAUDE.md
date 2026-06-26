# Testing Standards

## Paradigm: server-driven, no `page.route` mocks

All deterministic tests drive the real FastAPI server at `tests/server/server.py`, which uses pydantic-ai's `FunctionModel` to return predictable streams. The named entries in `models` (`text`, `tool`, `multi-tool`, `error`, `approval`) are the test fixtures — a spec picks one via `sendMessage(page, '<name>', '<message>')`.

When you need new behavior, add a `FunctionModel` to the server's `models` dict and select it from the spec. **Do not** introduce `page.route` mocks — they duplicated the SSE wire format and drifted on the SDK v5→v6 bump, which is why we switched.

## Selectors

- Prefer accessible selectors: `getByRole`, `getByPlaceholder`, `getByText`, `getByLabel`
- Use `data-testid` (or `data-tool-name` on `Tool`) only when no semantic selector exists
- Never use CSS selectors or XPath

## Test isolation

- Each test gets a fresh browser context (Playwright default)
- Tests must not depend on each other or share state
- The server is shared across tests; specs must be idempotent against shared server state

## Assertions

- Use web-first assertions (`expect(locator).toBeVisible()`) — they auto-retry
- Never use `page.waitForTimeout()` — use `expect` with auto-retry, `page.waitForFunction`, or the `waitForPersisted` helper in `e2e/conversation.ts` (polls IndexedDB)
- Assert on user-visible outcomes, not implementation details

## File layout

- `tests/server/` — the FastAPI test server (Python, owned by `uv`)
- `tests/e2e/deterministic/*.spec.ts` — Playwright specs against `FunctionModel` fixtures (run on every PR)
- `tests/e2e/llm/*.spec.ts` — live-provider Playwright specs (gated on `workflow_dispatch`)
- `tests/e2e/{conversation,sidebar,tools}.ts` — shared spec helpers
- `tests/headless/*.test.ts` — Vitest tests that exercise the wire protocol directly via `TestChat` (no browser)
- `tests/chat-client.ts`, `tests/global-setup.ts` — Vitest server-spawn helpers

## Naming

- Playwright spec files: `*.spec.ts`
- Vitest headless files: `*.test.ts`
- Describe blocks: feature area (`chat`, `sidebar`, `tool approval`)
- Test names: describe user behavior, not implementation (`approve runs the tool and shows the result`)

## When to add tests

- Every new user-facing feature needs at least one deterministic E2E spec
- Bug fixes should include a regression test when feasible
- New tool-shape behavior (approval, streaming, errors) should be exercised by a headless test in `tests/headless/` first, then a deterministic Playwright spec
