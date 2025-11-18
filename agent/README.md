# Logfire Docs chatbot

## Usage

Make sure you have `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` set in your environment variables.

Run the agent backend + pre-packaged frontend:

```bash
cd agent
uv sync
uv run uvicorn chatbot.server:app
```

Then open your browser to `http://localhost:8000`.

### Frontend development

Optionally run the frontend in dev mode, which will connect to the running agent backend:

```bash
npm install
npm run dev
```

Then open your browser to `http://localhost:5173`.