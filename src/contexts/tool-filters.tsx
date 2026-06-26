import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { isToolFiltered, loadFilters, saveFilters } from '@/lib/tool-filters'

interface ToolFiltersValue {
  filters: string[]
  addFilter: (filter: string) => void
  removeFilter: (filter: string) => void
  isFiltered: (toolName: string) => boolean
}

const ToolFiltersContext = createContext<ToolFiltersValue | null>(null)

interface ToolFiltersProviderProps {
  children: ReactNode
  /**
   * Tool-name filters (exact names or globs like `set_*`) seeded on first load,
   * before the user has saved any list of their own. Empty upstream; a host
   * (e.g. loopy) passes its noisy tool names here to hide them by default.
   */
  defaults?: string[]
}

export function ToolFiltersProvider({ children, defaults = [] }: ToolFiltersProviderProps) {
  const [filters, setFilters] = useState<string[]>(() => loadFilters(defaults))

  const persist = useCallback((next: string[]) => {
    setFilters(next)
    saveFilters(next)
  }, [])

  const addFilter = useCallback(
    (filter: string) => {
      const trimmed = filter.trim()
      if (trimmed === '' || filters.includes(trimmed)) return
      persist([...filters, trimmed])
    },
    [filters, persist],
  )

  const removeFilter = useCallback(
    (filter: string) => {
      persist(filters.filter((entry) => entry !== filter))
    },
    [filters, persist],
  )

  const isFiltered = useCallback((toolName: string) => isToolFiltered(toolName, filters), [filters])

  const value = useMemo<ToolFiltersValue>(
    () => ({ filters, addFilter, removeFilter, isFiltered }),
    [filters, addFilter, removeFilter, isFiltered],
  )

  return <ToolFiltersContext.Provider value={value}>{children}</ToolFiltersContext.Provider>
}

export function useToolFilters(): ToolFiltersValue {
  const value = useContext(ToolFiltersContext)
  if (value === null) {
    throw new Error('useToolFilters must be used within a ToolFiltersProvider')
  }
  return value
}
