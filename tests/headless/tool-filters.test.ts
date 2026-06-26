import { describe, it, expect } from 'vitest'
import { filterMatches, isToolFiltered, toolNameOfPart } from '../../src/lib/tool-filters'

describe('filterMatches', () => {
  it('matches exact names', () => {
    expect(filterMatches('get_weather', 'get_weather')).toBe(true)
    expect(filterMatches('get_weather', 'calculate')).toBe(false)
  })

  it('does not partial-match without a glob', () => {
    expect(filterMatches('get_weather', 'weather')).toBe(false)
    expect(filterMatches('get_weather', 'get_')).toBe(false)
  })

  it('glob set_* matches set_goal but not goal_set', () => {
    expect(filterMatches('set_goal', 'set_*')).toBe(true)
    expect(filterMatches('set_status', 'set_*')).toBe(true)
    expect(filterMatches('goal_set', 'set_*')).toBe(false)
  })

  it('lone * matches anything non-empty and empty', () => {
    expect(filterMatches('anything', '*')).toBe(true)
    expect(filterMatches('', '*')).toBe(true)
  })

  it('glob is anchored at both ends', () => {
    expect(filterMatches('run_code', '*code')).toBe(true)
    expect(filterMatches('run_code', 'run*')).toBe(true)
    expect(filterMatches('run_code_2', 'run*code')).toBe(false)
    expect(filterMatches('run_x_code', 'run*code')).toBe(true)
  })

  it('escapes regex special chars outside the glob star', () => {
    expect(filterMatches('a.b', 'a.b')).toBe(true)
    expect(filterMatches('axb', 'a.b')).toBe(false)
    expect(filterMatches('a.b', 'a.*')).toBe(true)
    expect(filterMatches('axb', 'a.*')).toBe(false)
  })

  it('a blank filter matches nothing', () => {
    expect(filterMatches('get_weather', '')).toBe(false)
    expect(filterMatches('', '')).toBe(false)
  })

  it('glob is case-sensitive', () => {
    expect(filterMatches('Set_goal', 'set_*')).toBe(false)
  })
})

describe('isToolFiltered', () => {
  it('is true when any filter matches', () => {
    expect(isToolFiltered('set_goal', ['run_code', 'set_*'])).toBe(true)
    expect(isToolFiltered('get_weather', ['get_weather'])).toBe(true)
  })

  it('is false when no filter matches', () => {
    expect(isToolFiltered('get_weather', ['set_*', 'run_code'])).toBe(false)
    expect(isToolFiltered('get_weather', [])).toBe(false)
  })
})

describe('toolNameOfPart', () => {
  it('returns the name for a static tool part (tool-<name>)', () => {
    expect(toolNameOfPart({ type: 'tool-get_weather', toolCallId: 'call-1' })).toBe('get_weather')
  })

  it('joins hyphenated static tool names after the tool- prefix', () => {
    expect(toolNameOfPart({ type: 'tool-multi-word-name', toolCallId: 'call-1' })).toBe('multi-word-name')
  })

  it('returns the toolName for a dynamic-tool part', () => {
    expect(toolNameOfPart({ type: 'dynamic-tool', toolName: 'run_code', toolCallId: 'call-2' })).toBe('run_code')
  })

  it('returns null for a non-tool part', () => {
    expect(toolNameOfPart({ type: 'text' })).toBe(null)
    expect(toolNameOfPart({ type: 'reasoning' })).toBe(null)
  })
})
