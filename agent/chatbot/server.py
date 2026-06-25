from __future__ import annotations as _annotations

import logfire

from .agent import agent

# 'if-token-present' means nothing will be sent (and the example will work) if you don't have logfire configured
logfire.configure(send_to_logfire='if-token-present')
logfire.instrument_pydantic_ai()

app = agent.to_web(
    models={
        'Claude Sonnet 4.5': 'anthropic:claude-sonnet-4-5',
        'GPT 5': 'openai-responses:gpt-5',
        'Gemini 2.5 Pro': 'google:gemini-2.5-pro',
    },
)
logfire.instrument_starlette(app)
