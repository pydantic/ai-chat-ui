# Pydantic AI Chat UI

A React-based chat interface for [Pydantic AI](https://ai.pydantic.dev/). This package powers the documentation assistant at [ai.pydantic.dev/web/](https://ai.pydantic.dev/web/).

Built with [Vercel AI SDK](https://sdk.vercel.ai/) and designed to work with Pydantic AI's streaming chat API.

## Features

- Streaming message responses with reasoning display
- Tool call visualization with collapsible input/output
- Conversation persistence via IndexedDB, with migration from legacy localStorage data
- Dynamic model and tool selection
- Dark/light theme support
- Mobile-responsive sidebar

## Hosting below a path prefix

Set the startup configuration before the UI's module script executes when the app is served below a same-origin path prefix:

```html
<script>
  window.PYDANTIC_AI_CHAT_CONFIG = {
    basePath: '/chat/',
    apiPath: '/chat/api/',
  }
</script>
```

`basePath` controls conversation URLs and browser navigation. `apiPath` is the complete directory containing the `configure` and `chat` endpoints; it is independent of `basePath`, so a UI below `/chat/` may still use `/api/`. Both values accept same-origin paths and are normalized with a trailing slash.

Without startup configuration, `basePath` uses the normalized Vite base (offline and CDN builds use `/`) and `apiPath` uses `/api/`. This configuration also works when a server injects the script into the single-file offline artifact at request time; the artifact does not need to be rebuilt.

## Development

```sh
pnpm install
pnpm run dev:server  # start the Python backend (requires agent/ setup)
pnpm run dev         # start the Vite dev server
```

## License

MIT
