# Testing Standards

## Selectors
- Prefer accessible selectors: `getByRole`, `getByPlaceholder`, `getByText`, `getByLabel`
- Use `data-testid` only when no semantic selector exists
- Never use CSS selectors or XPath

## Test isolation
- Each test gets a fresh browser context (Playwright default)
- Tests must not depend on each other or share state
- Clean up IndexedDB between tests if persistence bleeds

## Mocking
- All API calls are mocked via `page.route()` in `tests/e2e/mocks.ts`
- Mock responses must match the real API shape — update mocks when API changes
- Never call real LLM APIs in tests

## Assertions
- Use web-first assertions (`expect(locator).toBeVisible()`) — they auto-retry
- Never use `page.waitForTimeout()` — use `expect` with auto-retry or `page.waitForSelector`
- Assert on user-visible outcomes, not implementation details

## Naming
- Test files: `*.test.ts` in `tests/e2e/`
- Describe blocks: feature area (e.g., "chat", "sidebar", "persistence")
- Test names: describe user behavior, not implementation ("sends a message and sees response")

## When to add tests
- Every new user-facing feature needs at least one E2E test
- Bug fixes should include a regression test when feasible
