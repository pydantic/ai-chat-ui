from typing import Any, cast

import pydantic_ai

from chatbot.data import Repo, get_docs_dir, get_markdown, get_table_of_contents
from chatbot.db import open_populated_table


agent = pydantic_ai.Agent(
    instructions="Help the user answer questions about two products ('repos'): Pydantic AI (pydantic-ai), an open source agent framework library, and Pydantic Logfire (logfire), an observability platform. Start by using the `search_docs` tool to search the relevant documentation and answer the question based on the search results. It uses a hybrid of semantic and keyword search, so writing either keywords or sentences may work. It's not searching google. Each search result starts with a path to a .md file. The file `foo/bar.md` corresponds to the URL `https://ai.pydantic.dev/foo/bar/` for Pydantic AI, `https://logfire.pydantic.dev/docs/foo/bar/` for Logfire. Include the URLs in your answer. The search results may not return complete files, or may not return the files you need. If they don't have what you need, you can use the `get_docs_file` tool. You probably only need to search once or twice, definitely not more than 3 times. The user doesn't see the search results, you need to actually return a summary of the info. To see the files that exist for the `get_docs_file` tool, along with a preview of the sections within, use the `get_table_of_contents` tool.",
)

agent.tool_plain(get_table_of_contents)


@agent.tool_plain
def get_docs_file(repo: Repo, filename: str):
    """Get the full text of a documentation file by its filename, e.g. `foo/bar.md`."""
    if not filename.endswith('.md'):
        filename += '.md'
    path = get_docs_dir(repo) / filename
    if not path.exists():
        return f'File {filename} does not exist'
    return get_markdown(path)


@agent.tool_plain
def search_docs(repo: Repo, query: str):
    results = cast(
        list[dict[str, Any]],
        open_populated_table(repo)
        .search(  # type: ignore
            query,
            query_type='hybrid',
            vector_column_name='vector',
            fts_columns='text',
        )
        .limit(10)
        .to_list(),
    )
    results = [
        r
        for r in results
        if not any(
            r != r2
            and r['path'] == r2['path']
            and r['headers'][: len(r2['headers'])] == r2['headers']
            for r2 in results
        )
    ]

    return '\n\n---------\n\n'.join(r['text'] for r in results)


if __name__ == '__main__':
    # print(agent.run_sync('how do i see errors').output)
    # search_docs("logfire", "errors debugging view errors logs")
    agent.to_cli_sync()
