import { describe, expect, it } from 'vitest'

import { isRunCodeOutput, parseRunCodeInput } from '../../src/lib/run-code-payload'

describe('run code payloads', () => {
  it('falls back independently for malformed input fields', () => {
    expect(parseRunCodeInput({ code: 42, restart: true })).toEqual({ code: '', restart: true })
    expect(parseRunCodeInput({ code: 'print(1)', restart: 'yes' })).toEqual({ code: 'print(1)', restart: false })
  })

  it('falls back to an empty input for a malformed payload', () => {
    expect(parseRunCodeInput(null)).toEqual({ code: '', restart: false })
  })

  it('recognizes output and result payloads with arbitrary values and extra keys', () => {
    expect(isRunCodeOutput({ output: 'stdout', extra: true })).toBe(true)
    expect(isRunCodeOutput({ output: 42 })).toBe(true)
    expect(isRunCodeOutput({ result: null, metadata: { elapsed: 1 } })).toBe(true)
  })

  it('leaves non-run-code outputs for the generic fallback', () => {
    expect(isRunCodeOutput(null)).toBe(false)
    expect(isRunCodeOutput([])).toBe(false)
    expect(isRunCodeOutput({})).toBe(false)
    expect(isRunCodeOutput({ extra: true })).toBe(false)
  })
})
