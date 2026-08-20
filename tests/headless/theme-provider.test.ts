import { describe, expect, it } from 'vitest'

import { resolveStoredTheme } from '../../src/components/theme-provider'

describe('resolveStoredTheme', () => {
  it('keeps a valid stored theme', () => {
    expect(resolveStoredTheme('dark', 'system')).toBe('dark')
  })

  it('falls back for invalid stored themes', () => {
    expect(resolveStoredTheme('midnight', 'light')).toBe('light')
    expect(resolveStoredTheme('', 'dark')).toBe('dark')
    expect(resolveStoredTheme(null, 'system')).toBe('system')
  })
})
