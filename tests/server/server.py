"""Deterministic test server for E2E tests."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Literal

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import Route

from pydantic_ai import Agent, ModelRetry
from pydantic_ai.messages import ModelMessage, RetryPromptPart, ToolReturnPart
from pydantic_ai.models.function import AgentInfo, DeltaThinkingPart, DeltaToolCall, FunctionModel
from pydantic_ai.tools import DeferredToolRequests
from pydantic_ai.ui.vercel_ai import VercelAIAdapter
from pydantic_ai.ui.vercel_ai._event_stream import VercelAIEventStream
from pydantic_ai.ui.vercel_ai.response_types import SourceUrlChunk

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


@agent.tool_plain(requires_approval=True)
def delete_records(table: str) -> str:
    """Delete rows from a table, failing after approval was granted."""
    raise ModelRetry(f"Table {table!r} is locked")


@agent.tool_plain
def run_code(code: str, restart: bool = False) -> dict[str, object]:
    """Run a snippet of Python code."""
    return {"output": "hello world\n", "result": 42}


@agent.tool_plain
def large_output() -> dict[str, object]:
    """Return a tool output large enough to exceed the lazy-render threshold."""
    return {"summary": "large_result_marker", "payload": "x" * 22000}


def _is_retry(part: object) -> bool:
    # Newer pydantic-ai records a tool's ModelRetry as ToolReturnPart(outcome="retried"). Releases
    # without that outcome, such as the one uv.lock resolves for Python 3.10, use RetryPromptPart.
    return isinstance(part, RetryPromptPart) or (
        isinstance(part, ToolReturnPart) and part.outcome == "retried"
    )


def _has_tool_return(messages: list[ModelMessage]) -> bool:
    return any(
        isinstance(p, ToolReturnPart) and not _is_retry(p) for msg in messages for p in msg.parts
    )


def _has_retry_prompt(messages: list[ModelMessage]) -> bool:
    return any(_is_retry(p) for msg in messages for p in msg.parts)


def _first_tool_return_content(messages: list[ModelMessage]) -> str:
    return next(
        (str(p.content) for msg in messages for p in msg.parts if isinstance(p, ToolReturnPart)),
        "",
    )


async def stream_text(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str]:
    yield "Hello from the test server!"


async def stream_slow(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str]:
    """Streams slowly so specs can observe in-flight UI (thinking indicator, stop button)."""
    await asyncio.sleep(1.0)
    for chunk in ["Taking ", "my ", "time ", "here."]:
        yield chunk
        await asyncio.sleep(0.6)


async def stream_reasoning(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaThinkingPart]]:
    """Emits a thinking part before the answer, so specs can exercise the reasoning UI.

    Structured the way reasoning models summarise their steps — a heading per
    step, then its body — which is what the trace timeline renders from.
    """
    # Paced like `stream_slow`: without a gap the whole stream can arrive in one
    # read, so the UI never observes a streaming state and reports no duration.
    yield {0: DeltaThinkingPart(content="**Understanding the question**\n")}
    await asyncio.sleep(0.4)
    yield {0: DeltaThinkingPart(content="Working through the question step by step.\n\n")}
    await asyncio.sleep(0.4)
    yield {0: DeltaThinkingPart(content="**Weighing the options**\n")}
    await asyncio.sleep(0.4)
    yield {0: DeltaThinkingPart(content="The answer follows from the premise.")}
    await asyncio.sleep(0.4)
    yield "Here is the considered answer."


async def stream_failure(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str]:
    """Fails the run itself, so specs can exercise the request-failure UI.

    The message is deliberately long and multi-line, the shape a provider error
    actually arrives in — that is what the error card's summary/details split is
    for.
    """
    yield "Working on it"
    await asyncio.sleep(0.2)
    raise RuntimeError(
        "Upstream provider returned 503 Service Unavailable.\n"
        "request_id=req_8f2c41ab-77de-4d0e-9a11-6bc2d0f4e7c3\n"
        "The model endpoint is temporarily overloaded. Retrying in a few seconds usually succeeds."
    )


async def stream_markdown(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str]:
    """Markdown exercising the two lazily-loaded renderers: a fenced code block pulls a
    shiki language grammar via dynamic import, and math pulls the KaTeX fonts. The offline
    single-file artifact must render both with no network access."""
    yield (
        "Fenced code block:\n\n```python\ndef greet():\n    return 'offline'\n```\n\n"
        "And math:\n\n$$\nE = mc^2\n$$\n\n"
        # Aligned equations and matrices are the MathML layout attributes the
        # sanitiser has to let through; a plain `E = mc^2` needs none of them.
        "$$\n\\begin{aligned}\na &= b + c \\\\\nd &= e - f\n\\end{aligned}\n$$\n\n"
        "$$\n\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}\n$$\n\n"
        "And a [link to the docs](https://ai.pydantic.dev/) with `inline code`.\n"
    )


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


async def stream_sourced_tools(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    """Two tool calls with a cited source between them.

    `SourcedEventStream` injects the `source-url` chunk after the first call's
    input lands, which is where a provider that cites its sources puts them. The
    UI renders sources in their own strip, so the part draws nothing in the
    message column — and treating it as content used to break the turn's work
    into one foldable block per tool call.
    """
    if _has_tool_return(messages):
        yield "Looked it up and worked it out."
        return
    yield {
        0: DeltaToolCall(name="get_weather", json_args=json.dumps({"city": "Lisbon"})),
        1: DeltaToolCall(name="calculate", json_args=json.dumps({"expression": "3 + 4"})),
    }


async def stream_reasoning_then_tool(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaThinkingPart | DeltaToolCall]]:
    """Thinks for a while, then calls a tool.

    The thinking is paced so the turn spends most of its time before the first
    tool call — which is what the activity block has to keep counting. Remounted
    when the tool arrived, its timer restarted and reported only the tool.
    """
    if _has_tool_return(messages):
        yield "Thought about it, then looked it up."
        return
    for chunk in ["**Considering the question**\n", "Weighing what to look up.\n\n", "**Deciding**\n"]:
        yield {0: DeltaThinkingPart(content=chunk)}
        await asyncio.sleep(0.9)
    yield {1: DeltaToolCall(name="get_weather", json_args=json.dumps({"city": "Oslo"}))}


async def stream_two_step(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    """A genuine tool loop: one call, then a second that depends on it, then the answer.

    Each round is its own model step, so the SDK puts a `step-start` part between
    the tool calls — which is what the turn-activity grouping has to see through
    to keep the whole loop in one foldable block.
    """
    returns = [p for msg in messages for p in msg.parts if isinstance(p, ToolReturnPart)]
    if not returns:
        yield {0: DeltaToolCall(name="get_weather", json_args=json.dumps({"city": "London"}))}
    elif len(returns) == 1:
        yield {0: DeltaToolCall(name="calculate", json_args=json.dumps({"expression": "2 + 2"}))}
    else:
        yield "Both steps are done."


async def stream_interleaved(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    """Work, answer, then work again — two activity blocks in one turn.

    The prose between the rounds ends the first block, so only the second one is
    still live while the turn finishes. Handed the whole message's streaming
    flag, the first block kept spinning "Working" and counting time it was no
    longer spending. The second round is paced slowly enough to assert against
    while it is happening.
    """
    returns = [p for msg in messages for p in msg.parts if isinstance(p, ToolReturnPart)]
    if not returns:
        yield {0: DeltaToolCall(name="get_weather", json_args=json.dumps({"city": "Cairo"}))}
    elif len(returns) == 1:
        # A real model takes a while to answer a tool result. Without that gap the
        # prose can land in the same render as the first round, so the first block
        # is never live and has no duration to report.
        await asyncio.sleep(0.6)
        yield "Checked the weather. Now the sums:"
        yield {0: DeltaToolCall(name="calculate", json_args=json.dumps({"expression": "6 * 7"}))}
    else:
        for chunk in ["Both", " rounds", " are", " done."]:
            yield chunk
            await asyncio.sleep(0.6)


async def stream_repeated_tool(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    if _has_tool_return(messages):
        yield "All weather lookups completed."
        return
    yield {
        0: DeltaToolCall(name="get_weather", json_args=json.dumps({"city": "London"})),
        1: DeltaToolCall(name="get_weather", json_args=json.dumps({"city": "Paris"})),
        2: DeltaToolCall(name="get_weather", json_args=json.dumps({"city": "Tokyo"})),
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


async def stream_run_code(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    if _has_tool_return(messages):
        yield "The code ran successfully."
        return
    yield {
        0: DeltaToolCall(
            name="run_code",
            json_args=json.dumps({"code": "print('hello world')", "restart": False}),
        )
    }


async def stream_large_output(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    if _has_tool_return(messages):
        yield "The large output is ready."
        return
    yield {0: DeltaToolCall(name="large_output", json_args="{}")}


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


async def stream_approval_slow(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    """An approved tool whose continuation takes a moment to answer at all.

    Answering an approval puts the run back into `submitted` with the assistant
    turn still on screen, and the gap before the response is where a second
    avatar and a second "Thinking" used to appear underneath it. The delay lives
    in `chat()`, which holds the whole response rather than the text inside it.
    """
    if _has_tool_return_for(messages, "send_email"):
        yield "The email has been sent successfully."
        return
    yield {
        0: DeltaToolCall(
            name="send_email",
            json_args=json.dumps({"to": "alice@example.com", "body": "Hello from the test!"}),
        )
    }


async def stream_approval_error(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    """An approved tool that then fails — the card has to hold both facts."""
    if _has_retry_prompt(messages):
        yield "The rows could not be deleted."
        return
    if _has_tool_return_for(messages, "delete_records"):
        yield "Nothing was deleted."
        return
    yield {
        0: DeltaToolCall(
            name="delete_records",
            json_args=json.dumps({"table": "archive"}),
        )
    }


async def stream_repeated_approval(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    if _has_tool_return_for(messages, "send_email"):
        yield "Both emails have been sent successfully."
        return
    yield {
        0: DeltaToolCall(
            name="send_email",
            json_args=json.dumps({"to": "alice@example.com", "body": "Hello Alice!"}),
        ),
        1: DeltaToolCall(
            name="send_email",
            json_args=json.dumps({"to": "bob@example.com", "body": "Hello Bob!"}),
        ),
    }


async def stream_reasoning_then_approval(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaThinkingPart | DeltaToolCall]]:
    """Thinks for a while, then asks for approval — a long leg, then a short one.

    The turn's clock runs in two intervals with the wait for the user between
    them, and almost all of the work is in the first. A total that reports only
    the interval after the approval is off by seconds, which the other approval
    fixtures cannot show: they emit their tool call immediately, so both of
    their intervals round to the same second.
    """
    if _has_tool_return_for(messages, "send_email"):
        outcome = _tool_return_outcome(messages, "send_email")
        if outcome == "denied":
            yield "The email was not sent because you denied the request."
        else:
            yield "The email has been sent successfully."
        return
    for chunk in ["**Drafting the message**\n", "Working out who it should go to.\n\n", "**Ready to send**\n"]:
        yield {0: DeltaThinkingPart(content=chunk)}
        await asyncio.sleep(0.9)
    yield {
        1: DeltaToolCall(
            name="send_email",
            json_args=json.dumps({"to": "alice@example.com", "body": "Hello from the test!"}),
        )
    }


models: dict[str, object] = {
    "text": FunctionModel(stream_function=stream_text),
    # Same reply as `text`; the difference is on the wire, where its usage
    # metadata carries a total and no breakdown.
    "total-only-usage": FunctionModel(stream_function=stream_text),
    "markdown": FunctionModel(stream_function=stream_markdown),
    "slow": FunctionModel(stream_function=stream_slow),
    "failure": FunctionModel(stream_function=stream_failure),
    "reasoning": FunctionModel(stream_function=stream_reasoning),
    "tool": FunctionModel(stream_function=stream_tool),
    "multi-tool": FunctionModel(stream_function=stream_multi_tool),
    "two-step": FunctionModel(stream_function=stream_two_step),
    "reasoning-tool": FunctionModel(stream_function=stream_reasoning_then_tool),
    "repeated-tool": FunctionModel(stream_function=stream_repeated_tool),
    "error": FunctionModel(stream_function=stream_error),
    "approval": FunctionModel(stream_function=stream_approval),
    "approval-slow": FunctionModel(stream_function=stream_approval_slow),
    "approval-error": FunctionModel(stream_function=stream_approval_error),
    "repeated-approval": FunctionModel(stream_function=stream_repeated_approval),
    "reasoning-approval": FunctionModel(stream_function=stream_reasoning_then_approval),
    "run-code": FunctionModel(stream_function=stream_run_code),
    "sourced-tools": FunctionModel(stream_function=stream_sourced_tools),
    "interleaved": FunctionModel(stream_function=stream_interleaved),
    "large-output": FunctionModel(stream_function=stream_large_output),
    "anthropic": "anthropic:claude-haiku-4-5",
    "openai": "openai-responses:gpt-4.1-nano",
    "google": "google:gemini-2.0-flash",
}

SDK_VERSION: Literal[5, 6] = 6


# Builtin tools are advertised per model, so a spec picks the toolbar it wants
# by picking a model. `text` (the default) declares one, keeping the composer a
# plain bar for every spec that does not care; `markdown` declares all four,
# which is past the inline limit and pushes the rest into the overflow menu.
BUILTIN_TOOLS = [
    {"id": "web_search", "name": "Web search"},
    {"id": "code_execution", "name": "Code execution"},
    {"id": "image_generation", "name": "Image generation"},
    {"id": "url_context", "name": "URL context"},
]
MODEL_BUILTIN_TOOLS = {
    "text": ["web_search"],
    "markdown": [tool["id"] for tool in BUILTIN_TOOLS],
}


async def configure(request: Request) -> Response:
    model_list = [
        {
            "id": f"function:function::{name}",
            "name": name,
            "builtinTools": MODEL_BUILTIN_TOOLS.get(name, []),
        }
        for name in models
    ]
    return JSONResponse({"models": model_list, "builtinTools": BUILTIN_TOOLS})


class UsageEventStream(VercelAIEventStream):
    """Attach the conversation turn's token usage to the assistant message's metadata.

    The adapter already merges `ModelResponse.metadata` into the `message-metadata`
    chunk, so writing there is all it takes for `UIMessage.metadata.usage` to reach
    the browser. Keys are camelCase to match the rest of the wire format.

    Answering an approval starts a second run against the same assistant message,
    and the client deep-merges each `message-metadata` chunk into the one it
    already has — so a run reports its own usage plus whatever is already on that
    message, or the second run silently erases the first run's tokens.
    """

    #: Report only `totalTokens`, the minimum the UI accepts. The breakdown is
    #: optional in this shape, and a backend that omits it used to make the
    #: per-reply chip read "0 in, 0 out" on a reply that cost real tokens.
    total_only = False

    #: Emit a `source-url` chunk once the first tool call's input has landed,
    #: which is where a provider that cites its sources puts them: between the
    #: calls they came from, not after the last one.
    emit_source = False
    _source_emitted = False

    async def handle_tool_call_end(self, part):  # type: ignore[override]
        async for chunk in super().handle_tool_call_end(part):
            yield chunk
        if self.emit_source and not self._source_emitted:
            self._source_emitted = True
            yield SourceUrlChunk(
                source_id="source-1",
                url="https://example.com/lisbon-forecast",
                title="Lisbon forecast",
            )

    def _carried_usage(self) -> dict[str, int]:
        """Usage already on the assistant message this run is about to write to."""
        last = self.run_input.messages[-1]
        if last.role != "assistant" or not isinstance(last.metadata, dict):
            return {}
        carried = last.metadata.get("usage")
        return carried if isinstance(carried, dict) else {}

    async def handle_run_result(self, event):  # type: ignore[override]
        usage = event.result.usage
        response = event.result.response
        run = (
            {"totalTokens": usage.total_tokens}
            if self.total_only
            else {
                "inputTokens": usage.input_tokens,
                "outputTokens": usage.output_tokens,
                "totalTokens": usage.total_tokens,
                "cacheReadTokens": usage.cache_read_tokens,
                "cacheWriteTokens": usage.cache_write_tokens,
                "requests": usage.requests,
                "toolCalls": usage.tool_calls,
            }
        )
        carried = self._carried_usage()
        reported = {key: value + carried.get(key, 0) for key, value in run.items()}
        response.metadata = {**(response.metadata or {}), "usage": reported}
        async for chunk in super().handle_run_result(event):
            yield chunk


class UsageAdapter(VercelAIAdapter):
    def build_event_stream(self):  # type: ignore[override]
        stream = UsageEventStream(
            self.run_input,
            accept=self.accept,
            sdk_version=self.sdk_version,
            server_message_id=self.server_message_id,
        )
        extra = self.run_input.__pydantic_extra__ or {}
        # The client sends the qualified id (`function:function::<name>`), which
        # `chat()` splits the same way to look the model up.
        model_id = extra.get("model") or ""
        stream.total_only = model_id.split("::")[-1] == "total-only-usage"
        stream.emit_source = model_id.split("::")[-1] == "sourced-tools"
        return stream


async def chat(request: Request) -> Response:
    adapter = await UsageAdapter.from_request(request, agent=agent, sdk_version=SDK_VERSION)
    extra = adapter.run_input.__pydantic_extra__ or {}
    model_id = extra.get("model")
    name = model_id.split("::")[-1] if model_id else None
    model_ref = models.get(name) if name else None
    # Hold the response back, not just its first token: the adapter opens the
    # stream immediately, which moves the client from `submitted` to `streaming`
    # before a slow model has said anything. `submitted` is the state where the
    # "Thinking" placeholder lives, so a spec about it needs the whole reply
    # delayed rather than the text inside it.
    if name == "approval-slow":
        await asyncio.sleep(1.5)
    return await UsageAdapter.dispatch_request(
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
