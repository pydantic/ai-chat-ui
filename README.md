# Pydantic AI Chat package

Example React frontend for Pydantic AI Chat using [Vercel AI Elements](https://vercel.com/changelog/introducing-ai-elements).

## Dev

```sh
npm install
npm run dev

# stop your logfire platform, to avoid port 8000 conflicts

cd agent && uv run uvicorn chatbot.server:app
```
