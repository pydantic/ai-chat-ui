import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchConfig, normalizeDirectoryPath, resolveStartupConfig } from '../../src/lib/config'

const respond = (body: unknown, init: { status?: number } = {}) => {
  const status = init.status ?? 200
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchConfig', () => {
  it('returns the configuration with unknown fields intact', async () => {
    const config = {
      models: [{ id: 'a', name: 'a', builtinTools: [], provider: 'test-provider' }],
      builtinTools: [{ id: 'web_search', name: 'Web search', category: 'search' }],
      defaultModel: 'a',
    }
    respond(config)

    await expect(fetchConfig()).resolves.toEqual(config)
    expect(fetch).toHaveBeenCalledWith('/api/configure')
  })

  it('rejects an error response instead of storing it as configuration', async () => {
    // `fetch` resolves for a 500 as happily as for a 200, so the error body used
    // to be cast to a configuration: the retry banner never appeared, and the
    // first read of `models` threw during render.
    respond({ detail: 'no providers configured' }, { status: 500 })

    await expect(fetchConfig()).rejects.toThrow(/500/)
  })

  it('rejects a 200 that is not a configuration', async () => {
    respond({ detail: 'something else entirely' })

    await expect(fetchConfig()).rejects.toThrow(/models and builtin tools/)
  })

  it('keeps JSON parse errors intact', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.reject(new SyntaxError('Unexpected token <')),
        }),
      ),
    )

    await expect(fetchConfig()).rejects.toThrow(SyntaxError)
  })

  it('rejects arrays of the wrong shape', async () => {
    // Checking only that `models` is an array let a well-formed envelope full of
    // junk through, and it surfaced as blank options in the model select rather
    // than as the retry banner.
    respond({ models: [{ id: 'a' }], builtinTools: [] })
    await expect(fetchConfig()).rejects.toThrow(/models and builtin tools/)

    respond({ models: [{ id: 'a', name: 'a', builtinTools: [7] }], builtinTools: [] })
    await expect(fetchConfig()).rejects.toThrow(/models and builtin tools/)

    respond({ models: [], builtinTools: ['web_search'] })
    await expect(fetchConfig()).rejects.toThrow(/models and builtin tools/)
  })
})

describe('startup configuration', () => {
  it('normalizes configured directories independently', () => {
    expect(resolveStartupConfig({ basePath: '/demo', apiPath: 'services/chat' }, '/ignored/')).toEqual({
      basePath: '/demo/',
      apiPath: '/services/chat/',
    })
    expect(resolveStartupConfig({ basePath: '/demo' }, '/build/')).toEqual({
      basePath: '/demo/',
      apiPath: '/api/',
    })
    expect(resolveStartupConfig({ apiPath: '/demo/api' }, '/build/')).toEqual({
      basePath: '/build/',
      apiPath: '/demo/api/',
    })
  })

  it('defaults to the normalized Vite base and root API directory', () => {
    expect(resolveStartupConfig(undefined, '/docs')).toEqual({ basePath: '/docs/', apiPath: '/api/' })
    expect(resolveStartupConfig(undefined, './')).toEqual({ basePath: '/', apiPath: '/api/' })
    expect(resolveStartupConfig(undefined, 'https://cdn.example.com/package/')).toEqual({
      basePath: '/',
      apiPath: '/api/',
    })
  })

  it('rejects origins, query strings, and fragments', () => {
    expect(() => normalizeDirectoryPath('https://example.com/demo/', 'basePath')).toThrow(/same-origin path/)
    expect(() => normalizeDirectoryPath('//example.com/demo/', 'basePath')).toThrow(/same-origin path/)
    expect(() => normalizeDirectoryPath('/demo/?tenant=one', 'basePath')).toThrow(/query or fragment/)
    expect(() => normalizeDirectoryPath('/demo/#chat', 'basePath')).toThrow(/query or fragment/)
  })

  it('rejects malformed startup configuration', () => {
    expect(() => resolveStartupConfig('demo', '/')).toThrow(new TypeError('PYDANTIC_AI_CHAT_CONFIG must be an object'))
    expect(() => resolveStartupConfig([], '/')).toThrow(new TypeError('PYDANTIC_AI_CHAT_CONFIG must be an object'))
    expect(() => resolveStartupConfig({ apiPath: 7 }, '/')).toThrow(
      new TypeError('PYDANTIC_AI_CHAT_CONFIG.apiPath must be a string'),
    )
  })
})
