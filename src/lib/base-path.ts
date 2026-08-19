import { startupConfig } from '@/lib/config'

const BASE = startupConfig.basePath

export function stripBasePath(pathname: string): string {
  if (BASE === '/') return pathname
  if (pathname.startsWith(BASE)) return '/' + pathname.slice(BASE.length)
  return pathname
}

export function withBasePath(appPath: string): string {
  if (BASE === '/') return appPath
  const stripped = appPath.startsWith('/') ? appPath.slice(1) : appPath
  return BASE + stripped
}
