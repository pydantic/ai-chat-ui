import { spawn, type ChildProcess } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SERVER_DIR = join(fileURLToPath(import.meta.url), '..', 'server')
const STARTUP_TIMEOUT = 30_000
const HEALTH_CHECK_INTERVAL = 200

let serverProcess: ChildProcess | undefined
let logStream: ReturnType<typeof createWriteStream> | undefined

function waitForServer(port: number): Promise<void> {
  const url = `http://127.0.0.1:${port}/api/configure`
  const start = Date.now()
  const controller = new AbortController()

  return new Promise((resolve, reject) => {
    const check = async () => {
      if (Date.now() - start > STARTUP_TIMEOUT) {
        controller.abort()
        reject(new Error(`Server did not start within ${STARTUP_TIMEOUT}ms`))
        return
      }
      try {
        const res = await fetch(url, { signal: controller.signal })
        if (res.ok) {
          resolve()
          return
        }
      } catch {
        // not ready yet (connection refused or aborted)
      }
      setTimeout(() => {
        void check()
      }, HEALTH_CHECK_INTERVAL)
    }
    void check()
  })
}

export async function setup({ provide }: { provide: (key: string, value: unknown) => void }) {
  const logFile = join(tmpdir(), 'ai-chat-ui-test-server.log')
  logStream = createWriteStream(logFile)
  console.log(`Test server logs: ${logFile}`)

  const port = await new Promise<number>((resolve, reject) => {
    const proc = spawn('uv', ['run', 'uvicorn', 'server:app', '--port', '0'], {
      cwd: SERVER_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    serverProcess = proc
    proc.unref()

    proc.stderr.pipe(logStream!)
    proc.stdout.pipe(logStream!)

    let resolved = false
    const portRegex = /Uvicorn running on http:\/\/[\d.]+:(\d+)/

    const onData = (data: Buffer) => {
      const text = data.toString()
      const match = portRegex.exec(text)
      if (match && !resolved) {
        resolved = true
        resolve(Number(match[1]))
      }
    }

    proc.stderr.on('data', onData)
    proc.stdout.on('data', onData)

    proc.on('error', (err) => {
      if (!resolved) reject(err)
    })

    proc.on('exit', (code) => {
      if (!resolved) reject(new Error(`Server exited with code ${code}`))
    })

    setTimeout(() => {
      if (!resolved) reject(new Error('Timed out waiting for server port'))
    }, STARTUP_TIMEOUT)
  })

  await waitForServer(port)
  console.log(`Test server running on port ${port}`)

  process.env.TEST_SERVER_PORT = String(port)
  provide('testServerPort', port)
}

export async function teardown() {
  if (serverProcess?.pid) {
    serverProcess.kill('SIGTERM')
    serverProcess.stdout?.destroy()
    serverProcess.stderr?.destroy()
  }
  if (logStream) {
    await new Promise<void>((resolve) => logStream!.end(resolve))
  }
}

declare module 'vitest' {
  export interface ProvidedContext {
    testServerPort: number
  }
}
