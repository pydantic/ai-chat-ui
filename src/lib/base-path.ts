const RAW = import.meta.env.BASE_URL
const BASE = RAW.startsWith('http') ? '/' : RAW.endsWith('/') ? RAW : RAW + '/'

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
