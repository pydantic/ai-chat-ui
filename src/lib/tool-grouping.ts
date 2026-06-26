/**
 * The per-part info the grouping pass needs: a part's tool name (or `null` for a
 * non-tool part) and whether that tool is filtered. Typed structurally so the
 * pass is unit-testable with plain descriptors, not real `UIMessagePart`s.
 */
export interface PartDescriptor {
  toolName: string | null
  filtered: boolean
}

// A tool call is done once it has a terminal result (output, error, or denial).
// Anything earlier -- streaming input, `input-available`, `approval-requested`
// -- is still running. Shared by `ToolCallGroup` (default-expand while running)
// and `hasIncompleteToolPart` in `Chat.tsx`, which must agree on what "done"
// means so they cannot drift.
export const COMPLETE_TOOL_STATES = new Set(['output-available', 'output-error', 'output-denied'])

/**
 * Split a run's per-call states into done vs. still-running counts. A call is
 * `done` only at a terminal state in `COMPLETE_TOOL_STATES`; `approval-requested`
 * counts as running so the group stays expanded while approval is pending.
 */
export function splitStates(states: string[]): { done: number; running: number } {
  const done = states.filter((state) => COMPLETE_TOOL_STATES.has(state)).length
  return { done, running: states.length - done }
}

/**
 * A run of consecutive parts to render together.
 *
 * - `hidden`: a run of consecutive filtered tool parts -> one `HiddenToolsGroup`.
 * - `tool`: a run of >=2 consecutive non-filtered calls to the same tool name ->
 *   one `ToolCallGroup`.
 * - `single`: any other part (a non-tool part, or a lone tool call) -> rendered
 *   on its own.
 *
 * `indices` are the original positions in `message.parts`, so the caller keeps
 * the existing `${message.id}-${i}` key scheme and can read per-call state.
 */
export type PartRun =
  | { kind: 'hidden'; indices: number[] }
  | { kind: 'tool'; toolName: string; indices: number[] }
  | { kind: 'single'; index: number }

/**
 * Collapse a message's parts into runs. Two independent collapses happen in one
 * left-to-right pass:
 *
 * - Consecutive filtered tool parts accumulate into a `hidden` run.
 * - Consecutive non-filtered calls to the same tool name accumulate into a
 *   same-tool run; it breaks when the next part is not a tool part, is filtered,
 *   or names a different tool. A same-tool run of length 1 emits a `single`.
 *
 * Any non-tool part flushes the open run and emits a `single`.
 */
export function groupParts(parts: PartDescriptor[]): PartRun[] {
  const runs: PartRun[] = []
  let hidden: number[] = []
  let tool: { toolName: string; indices: number[] } | null = null

  const flushHidden = () => {
    if (hidden.length === 0) return
    runs.push({ kind: 'hidden', indices: hidden })
    hidden = []
  }

  const flushTool = () => {
    if (tool === null) return
    if (tool.indices.length >= 2) {
      runs.push({ kind: 'tool', toolName: tool.toolName, indices: tool.indices })
    } else {
      runs.push({ kind: 'single', index: tool.indices[0] })
    }
    tool = null
  }

  parts.forEach((part, i) => {
    if (part.toolName !== null && part.filtered) {
      flushTool()
      hidden.push(i)
      return
    }
    if (part.toolName !== null) {
      flushHidden()
      if (tool !== null && tool.toolName === part.toolName) {
        tool.indices.push(i)
      } else {
        flushTool()
        tool = { toolName: part.toolName, indices: [i] }
      }
      return
    }
    flushHidden()
    flushTool()
    runs.push({ kind: 'single', index: i })
  })

  flushHidden()
  flushTool()

  return runs
}
