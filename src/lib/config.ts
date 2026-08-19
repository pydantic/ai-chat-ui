import { isRecord } from '@/lib/is-record'
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

function configuredPath(config: unknown, key: keyof StartupConfig): string | undefined {
  if (config === undefined) return undefined
  if (!isRecord(config)) throw new TypeError('PYDANTIC_AI_CHAT_CONFIG must be an object')
  const value = config[key]
  if (value !== undefined && typeof value !== 'string') {
    throw new TypeError(`PYDANTIC_AI_CHAT_CONFIG.${key} must be a string`)
  }
  return value
}

export function resolveStartupConfig(
  config: unknown = typeof window === 'undefined' ? undefined : window.PYDANTIC_AI_CHAT_CONFIG,
  viteBase: string = import.meta.env.BASE_URL,
): ResolvedStartupConfig {
  const basePath = configuredPath(config, 'basePath')
  const apiPath = configuredPath(config, 'apiPath')
  return Object.freeze({
    basePath: basePath === undefined ? defaultBasePath(viteBase) : normalizeDirectoryPath(basePath, 'basePath'),
    apiPath: apiPath === undefined ? '/api/' : normalizeDirectoryPath(apiPath, 'apiPath'),
  })
}

export const startupConfig = resolveStartupConfig()

function isModelConfig(value: unknown): value is ModelConfig {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray(value.builtinTools) &&
    value.builtinTools.every((tool) => typeof tool === 'string')
  )
}

function isBuiltinTool(value: unknown): value is BuiltinTool {
  return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string'
}

/**
 * The elements are checked, not just the arrays.
 *
 * A backend that answers with the right keys and the wrong contents used to pass
 * here and fail later in render — a model without `name` reaches the select as a
 * blank option that cannot be told apart from its neighbours, and one without
 * `id` sends a request the server rejects. Rejecting the response instead puts
 * the retry banner in front of it.
 */
function isRemoteConfig(value: unknown): value is RemoteConfig {
  if (!isRecord(value)) return false
  return (
    Array.isArray(value.models) &&
    value.models.every(isModelConfig) &&
    Array.isArray(value.builtinTools) &&
    value.builtinTools.every(isBuiltinTool)
  )
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
  if (!isRemoteConfig(body)) {
    throw new Error('Configuration response did not contain models and builtin tools')
  }
  return body
}
