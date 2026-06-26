import { describe, it, expect } from 'vitest'
import { groupParts, splitStates, type PartDescriptor } from '../../src/lib/tool-grouping'

const tool = (name: string): PartDescriptor => ({ toolName: name, filtered: false })
const hidden = (name: string): PartDescriptor => ({ toolName: name, filtered: true })
const text = (): PartDescriptor => ({ toolName: null, filtered: false })

describe('groupParts', () => {
  it('collapses 3 consecutive same-tool calls into one group of 3', () => {
    expect(groupParts([tool('get_weather'), tool('get_weather'), tool('get_weather')])).toEqual([
      { kind: 'tool', toolName: 'get_weather', indices: [0, 1, 2] },
    ])
  })

  it('does not group a lone call', () => {
    expect(groupParts([tool('get_weather')])).toEqual([{ kind: 'single', index: 0 }])
  })

  it('keeps different tools in separate runs', () => {
    expect(groupParts([tool('get_weather'), tool('calculate')])).toEqual([
      { kind: 'single', index: 0 },
      { kind: 'single', index: 1 },
    ])
  })

  it('groups each consecutive same-tool run separately', () => {
    expect(groupParts([tool('a'), tool('a'), tool('b'), tool('b')])).toEqual([
      { kind: 'tool', toolName: 'a', indices: [0, 1] },
      { kind: 'tool', toolName: 'b', indices: [2, 3] },
    ])
  })

  it('keeps a filtered run separate from a same-tool run', () => {
    expect(groupParts([hidden('noisy'), hidden('noisy'), tool('a'), tool('a')])).toEqual([
      { kind: 'hidden', indices: [0, 1] },
      { kind: 'tool', toolName: 'a', indices: [2, 3] },
    ])
  })

  it('breaks a same-tool run on a non-tool part', () => {
    expect(groupParts([tool('a'), text(), tool('a')])).toEqual([
      { kind: 'single', index: 0 },
      { kind: 'single', index: 1 },
      { kind: 'single', index: 2 },
    ])
  })

  it('breaks a same-tool run on a filtered call of the same name', () => {
    expect(groupParts([tool('a'), tool('a'), hidden('a'), tool('a'), tool('a')])).toEqual([
      { kind: 'tool', toolName: 'a', indices: [0, 1] },
      { kind: 'hidden', indices: [2] },
      { kind: 'tool', toolName: 'a', indices: [3, 4] },
    ])
  })

  it('returns an empty list for no parts', () => {
    expect(groupParts([])).toEqual([])
  })
})

describe('splitStates', () => {
  it('counts every terminal state as done -> running 0 (group collapses by default)', () => {
    expect(splitStates(['output-available', 'output-error', 'output-denied'])).toEqual({ done: 3, running: 0 })
  })

  it('counts approval-requested as running -> running > 0 (group expands by default)', () => {
    expect(splitStates(['approval-requested', 'output-available'])).toEqual({ done: 1, running: 1 })
  })

  it('counts pre-terminal states (input-streaming, input-available) as running', () => {
    expect(splitStates(['input-streaming', 'input-available'])).toEqual({ done: 0, running: 2 })
  })

  it('returns zero counts for no states', () => {
    expect(splitStates([])).toEqual({ done: 0, running: 0 })
  })
})
