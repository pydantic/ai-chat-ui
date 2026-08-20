import { z } from 'zod'

import type { BuiltinTool, ModelConfig } from '@/types'

export interface StartupConfig {
  basePath?: string
  apiPath?: string
}

export interface ResolvedStartupConfig {
  readonly basePath: string
  readonly apiPath: string
}

export interface RemoteConfig {
  models: ModelConfig[]
  builtinTools: BuiltinTool[]
}

const PATH_ORIGIN = 'https://pydantic-ai-chat.invalid'

/** Normalize a same-origin directory path for safe suffix concatenation. */
export function normalizeDirectoryPath(path: string, name: string): string {
  const url = new URL(path, PATH_ORIGIN)
  if (url.origin !== PATH_ORIGIN || url.search || url.hash) {
    throw new TypeError(`${name} must be a same-origin path without a query or fragment`)
  }
  return url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`
}

function defaultBasePath(viteBase: string): string {
  const url = new URL(viteBase || '/', PATH_ORIGIN)
  return url.origin === PATH_ORIGIN ? normalizeDirectoryPath(url.pathname, 'Vite base') : '/'
}

const startupConfigSchema = z
  .object(
    {
      basePath: z.string({ error: 'PYDANTIC_AI_CHAT_CONFIG.basePath must be a string' }).optional(),
      apiPath: z.string({ error: 'PYDANTIC_AI_CHAT_CONFIG.apiPath must be a string' }).optional(),
    },
    { error: 'PYDANTIC_AI_CHAT_CONFIG must be an object' },
  )
  .optional()

export function resolveStartupConfig(
  config: unknown = typeof window === 'undefined' ? undefined : window.PYDANTIC_AI_CHAT_CONFIG,
  viteBase: string = import.meta.env.BASE_URL,
): ResolvedStartupConfig {
  const parsedConfig = startupConfigSchema.safeParse(config)
  if (!parsedConfig.success) {
    throw new TypeError(parsedConfig.error.issues[0].message)
  }
  const { basePath, apiPath } = parsedConfig.data ?? {}
  return Object.freeze({
    basePath: basePath === undefined ? defaultBasePath(viteBase) : normalizeDirectoryPath(basePath, 'basePath'),
    apiPath: apiPath === undefined ? '/api/' : normalizeDirectoryPath(apiPath, 'apiPath'),
  })
}

export const startupConfig = resolveStartupConfig()

const remoteConfigSchema = z.looseObject({
  models: z.array(
    z.looseObject({
      id: z.string(),
      name: z.string(),
      builtinTools: z.array(z.string()),
    }),
  ),
  builtinTools: z.array(z.looseObject({ id: z.string(), name: z.string() })),
})

export function parseRemoteConfig(value: unknown): RemoteConfig {
  const parsedConfig = remoteConfigSchema.safeParse(value)
  if (!parsedConfig.success) {
    throw new Error('Configuration response did not contain models and builtin tools')
  }
  return parsedConfig.data
}

/**
 * Read the backend's model and builtin-tool configuration.
 *
 * Both the status and the shape are checked before the body is handed back. A
 * `fetch` resolves for a 4xx or 5xx just as happily as for a 200, so an error
 * payload used to be cast to a configuration and stored as a successful result:
 * the banner offering a retry never appeared, and the first read of a property
 * that error bodies do not have (`models.find(...)`) threw during render, taking
 * the chat down instead.
 */
export async function fetchConfig(): Promise<RemoteConfig> {
  const res = await fetch(`${startupConfig.apiPath}configure`)
  if (!res.ok) {
    throw new Error(`Configuration request failed with ${String(res.status)}`)
  }
  const body: unknown = await res.json()
  return parseRemoteConfig(body)
}
