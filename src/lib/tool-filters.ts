const STORAGE_KEY = 'toolFilters'

/**
 * The minimal shape needed to identify a tool part and read its name. A real
 * `UIMessagePart` satisfies this; typing it structurally keeps the function
 * usable with test fixtures without widening to `any`.
 */
interface PartLike {
  type: string
  toolName?: string
  toolCallId?: string
}

/**
 * Return the tool name if `part` is a tool part, else `null`.
 *
 * Mirrors the tool-part detection in `Part.tsx` and the name extraction in
 * `tool-part.tsx`: a part is a tool part iff it is a `dynamic-tool` part or
 * carries a `toolCallId`. A static tool part's `type` is `tool-<name>`.
 */
export function toolNameOfPart(part: PartLike): string | null {
  if (part.type === 'dynamic-tool') return part.toolName ?? null
  if ('toolCallId' in part) return part.type.split('-').slice(1).join('-')
  return null
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')
  return new RegExp(`^${escaped}$`)
}

/**
 * Match `toolName` against a single `filter`. A filter containing `*` is a glob
 * (case-sensitive, anchored); otherwise it is an exact string match. A blank
 * filter matches nothing.
 */
export function filterMatches(toolName: string, filter: string): boolean {
  if (filter === '') return false
  if (filter.includes('*')) return globToRegExp(filter).test(toolName)
  return toolName === filter
}

/** True if any filter in `filters` matches `toolName`. */
export function isToolFiltered(toolName: string, filters: string[]): boolean {
  return filters.some((filter) => filterMatches(toolName, filter))
}

/**
 * Load filters from localStorage. Returns the stored list if a value exists
 * (even an empty list, so a user who cleared their filters keeps an empty list),
 * else `defaults`. Defaults therefore seed only on first load.
 */
export function loadFilters(defaults: string[]): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return defaults
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string')) {
      return parsed
    }
    return defaults
  } catch {
    return defaults
  }
}

/** Persist `filters` to localStorage as a JSON string array. */
export function saveFilters(filters: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
  } catch {
    // Ignore write failures (e.g. storage disabled); filters stay in memory.
  }
}
