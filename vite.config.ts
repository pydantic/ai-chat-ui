import { readFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import tsconfigPaths from 'vite-tsconfig-paths'
// import { analyzer } from 'vite-bundle-analyzer'

// 8000 is quite common for backend, avoid the clash
const BACKEND_DEV_SERVER_PORT = process.env.BACKEND_PORT ?? 38001
const API_PROXY_PATH = process.env.API_PROXY_PATH ?? '/api'

function apiProxy(pathPrefix: string) {
  return {
    target: `http://localhost:${BACKEND_DEV_SERVER_PORT}/`,
    changeOrigin: true,
    rewrite: (path: string) => `/api${path.slice(pathPrefix.length)}`,
  }
}

const API_PROXY = {
  '/api': apiProxy('/api'),
  ...(API_PROXY_PATH === '/api' ? {} : { [API_PROXY_PATH]: apiProxy(API_PROXY_PATH) }),
}

const FAVICON_MIME_TYPES: Record<string, string | undefined> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

// vite-plugin-singlefile inlines <script> and <link rel="stylesheet">, but favicons are
// plain public/ files it leaves as relative hrefs. Without this they'd 404 in the
// single-file artifact, which has no sibling files to resolve against.
function inlineFavicons(): Plugin {
  return {
    name: 'inline-favicons',
    transformIndexHtml(html) {
      return html.replace(/href="\.\/([\w-]+\.(?:svg|png|ico))"/g, (link, fileName: string) => {
        const mimeType = FAVICON_MIME_TYPES[extname(fileName)]
        if (mimeType === undefined) return link
        const base64 = readFileSync(resolve(__dirname, 'public', fileName)).toString('base64')
        return `href="data:${mimeType};base64,${base64}"`
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // `--mode offline` emits a single self-contained index.html for air-gapped hosting
  // (pydantic-ai's `to_web(html_source=...)` takes one file). Everything is inlined:
  // the lazily-imported chunks, which would otherwise be fetched from the CDN base at
  // runtime, and the KaTeX fonts referenced by url() from its stylesheet.
  const offline = mode === 'offline'

  return {
    plugins: [
      react(),
      tailwindcss(),
      tsconfigPaths({ root: __dirname }),
      ...(offline ? [inlineFavicons(), viteSingleFile()] : []),
    ],
    base: offline ? './' : command === 'build' ? 'https://cdn.jsdelivr.net/npm/@pydantic/ai-chat-ui/dist/' : '',
    build: {
      assetsDir: 'assets',
      // The favicons are inlined above, so nothing should be copied next to index.html --
      // the artifact is meant to be exactly one file.
      ...(offline ? { outDir: 'offline', copyPublicDir: false } : {}),
    },
    server: { proxy: API_PROXY },
    // The offline E2E spec serves the built artifact with `vite preview`, which needs the
    // same /api proxy the dev server has.
    preview: { proxy: API_PROXY },
  }
})
