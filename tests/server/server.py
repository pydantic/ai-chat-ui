"""Deterministic test server for E2E tests."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Literal

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import Route

from pydantic_ai import Agent, ModelRetry
from pydantic_ai.messages import ModelMessage, RetryPromptPart, ToolReturnPart
from pydantic_ai.models.function import AgentInfo, DeltaToolCall, FunctionModel
from pydantic_ai.tools import DeferredToolRequests
from pydantic_ai.ui.vercel_ai import VercelAIAdapter

agent = Agent(output_type=[str, DeferredToolRequests])


@agent.tool_plain
def get_weather(city: str) -> str:
    """Get weather for a city."""
    if not city:
        raise ModelRetry("City name is required")
    return f"Weather in {city}: Sunny, 72°F"


@agent.tool_plain
def calculate(expression: str) -> str:
    """Calculate a math expression."""
    return "Result: 42"


@agent.tool_plain(requires_approval=True)
def send_email(to: str, body: str) -> str:
    """Send an email to a recipient."""
    return f"Email sent to {to}"


def _has_tool_return(messages: list[ModelMessage]) -> bool:
    return any(isinstance(p, ToolReturnPart) for msg in messages for p in msg.parts)


def _has_retry_prompt(messages: list[ModelMessage]) -> bool:
    return any(isinstance(p, RetryPromptPart) for msg in messages for p in msg.parts)


def _first_tool_return_content(messages: list[ModelMessage]) -> str:
    return next(
        (str(p.content) for msg in messages for p in msg.parts if isinstance(p, ToolReturnPart)),
        "",
    )


async def stream_text(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str]:
    yield "Hello from the test server!"


async def stream_tool(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    if _has_tool_return(messages):
        yield f"Tool result: {_first_tool_return_content(messages)}"
        return
    yield {0: DeltaToolCall(name="get_weather", json_args=json.dumps({"city": "San Francisco"}))}


async def stream_multi_tool(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    if _has_tool_return(messages):
        yield "All tools completed successfully."
        return
    yield {
        0: DeltaToolCall(name="get_weather", json_args=json.dumps({"city": "San Francisco"})),
        1: DeltaToolCall(name="calculate", json_args=json.dumps({"expression": "2 + 2"})),
    }


async def stream_error(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    if _has_tool_return(messages):
        yield "Error handled."
        return
    if _has_retry_prompt(messages):
        yield "The tool encountered an error."
        return
    yield {0: DeltaToolCall(name="get_weather", json_args=json.dumps({"city": ""}))}


def _has_tool_return_for(messages: list[ModelMessage], tool_name: str) -> bool:
    return any(
        isinstance(p, ToolReturnPart) and p.tool_name == tool_name
        for msg in messages
        for p in msg.parts
    )


def _tool_return_outcome(messages: list[ModelMessage], tool_name: str) -> str:
    for msg in messages:
        for p in msg.parts:
            if isinstance(p, ToolReturnPart) and p.tool_name == tool_name:
                return p.outcome
    return ""


async def stream_approval(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    if _has_tool_return_for(messages, "send_email"):
        outcome = _tool_return_outcome(messages, "send_email")
        if outcome == "denied":
            yield "The email was not sent because you denied the request."
        else:
            yield "The email has been sent successfully."
        return
    yield {
        0: DeltaToolCall(
            name="send_email",
            json_args=json.dumps({"to": "alice@example.com", "body": "Hello from the test!"}),
        )
    }


models: dict[str, object] = {
    "text": FunctionModel(stream_function=stream_text),
    "tool": FunctionModel(stream_function=stream_tool),
    "multi-tool": FunctionModel(stream_function=stream_multi_tool),
    "error": FunctionModel(stream_function=stream_error),
    "approval": FunctionModel(stream_function=stream_approval),
    "anthropic": "anthropic:claude-haiku-4-5",
    "openai": "openai-responses:gpt-4.1-nano",
    "google": "google:gemini-2.0-flash",
}

SDK_VERSION: Literal[5, 6] = 6


async def configure(request: Request) -> Response:
    model_list = [
        {"id": f"function:function::{name}", "name": name, "builtinTools": []}
        for name in models
    ]
    return JSONResponse({"models": model_list, "builtinTools": []})


async def chat(request: Request) -> Response:
    adapter = await VercelAIAdapter.from_request(request, agent=agent, sdk_version=SDK_VERSION)
    extra = adapter.run_input.__pydantic_extra__ or {}
    model_id = extra.get("model")
    model_ref = models.get(model_id.split("::")[-1]) if model_id else None
    return await VercelAIAdapter.dispatch_request(
        request, agent=agent, model=model_ref, sdk_version=SDK_VERSION,
    )


async def options_chat(request: Request) -> Response:
    return Response(status_code=200, headers={
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    })


app = Starlette(routes=[
    Route("/api/chat", options_chat, methods=["OPTIONS"]),
    Route("/api/chat", chat, methods=["POST"]),
    Route("/api/configure", configure, methods=["GET"]),
])
