# [2.1.0](https://github.com/pydantic/ai-chat-ui/compare/v2.0.0...v2.1.0) (2026-08-10)


### Features

* add offline single-file build for self-hosting ([#42](https://github.com/pydantic/ai-chat-ui/issues/42)) ([99bc204](https://github.com/pydantic/ai-chat-ui/commit/99bc204dddd1d5b3f552083a735b6c7f4382980a))

# [2.0.0](https://github.com/pydantic/ai-chat-ui/compare/v1.2.0...v2.0.0) (2026-07-06)


* feat!: target Vercel AI SDK v6 ([f8ebace](https://github.com/pydantic/ai-chat-ui/commit/f8ebace88ab2f45598ac47591375735665ba0e4e))


### Bug Fixes

* avoid eager rendering for large tool output ([#25](https://github.com/pydantic/ai-chat-ui/issues/25)) ([544d3e0](https://github.com/pydantic/ai-chat-ui/commit/544d3e0fcc5168cc0d53ab41c2dbb4799a5ad2cf))
* memoize CodeBlock highlighting to stop re-highlight-on-render ([#35](https://github.com/pydantic/ai-chat-ui/issues/35)) ([6d9bb04](https://github.com/pydantic/ai-chat-ui/commit/6d9bb04cc5a3e8fbf836cffb7f26fbfef883d0f3))
* propagate conversation id changes to the sidebar ([#27](https://github.com/pydantic/ai-chat-ui/issues/27)) ([586598a](https://github.com/pydantic/ai-chat-ui/commit/586598a052924005b627b77b15ec23719ce1af30))


### Continuous Integration

* disable husky hooks during semantic-release commit ([fcce769](https://github.com/pydantic/ai-chat-ui/commit/fcce76916c6bf256c05fc3f04fc53388bf4b4b84))


### Features

* collapse consecutive same-tool calls into a counted group ([#30](https://github.com/pydantic/ai-chat-ui/issues/30), [#36](https://github.com/pydantic/ai-chat-ui/issues/36)) ([450a72b](https://github.com/pydantic/ai-chat-ui/commit/450a72ba6c290f9b56a25ab78d69ccaf8b690580))
* editable user messages with conversation forking ([#22](https://github.com/pydantic/ai-chat-ui/issues/22)) ([376f24c](https://github.com/pydantic/ai-chat-ui/commit/376f24c08cca7af1d980f7c2d7602cf2956f4db4))
* readable run_code tool input/output ([#26](https://github.com/pydantic/ai-chat-ui/issues/26)) ([9c65dd2](https://github.com/pydantic/ai-chat-ui/commit/9c65dd2189c1710752015eed73427a89d18af233))
* reasoning-effort dropdown in the chat toolbar ([#28](https://github.com/pydantic/ai-chat-ui/issues/28)) ([efe2b9e](https://github.com/pydantic/ai-chat-ui/commit/efe2b9e073d35d4d441d3ccd5f4116227b713f24))
* tool approval UI for AI SDK v6 ([#23](https://github.com/pydantic/ai-chat-ui/issues/23)) ([150aaca](https://github.com/pydantic/ai-chat-ui/commit/150aaca258b2fd58ace6d11a0dd89920a7caf482)), closes [#21](https://github.com/pydantic/ai-chat-ui/issues/21) [#16](https://github.com/pydantic/ai-chat-ui/issues/16)
* tool-call filters -- hide noisy tools by name or glob ([#34](https://github.com/pydantic/ai-chat-ui/issues/34)) ([c3194c3](https://github.com/pydantic/ai-chat-ui/commit/c3194c3e22e14a2ec8e7ee89d07bb43a7dc72f96))
* upgrade Vercel AI SDK v5 to v6 ([#21](https://github.com/pydantic/ai-chat-ui/issues/21)) ([d0e641a](https://github.com/pydantic/ai-chat-ui/commit/d0e641a1404259e42aa5a371dded116d55b1c00f))


### BREAKING CHANGES

* The chat UI now targets Vercel AI SDK v7 and is no longer wire-compatible with a v5/v6 server.
* The chat UI now targets Vercel AI SDK v6 and is no longer wire-compatible with a v5 server. Cut as 2.0.0.

# [1.2.0](https://github.com/pydantic/ai-chat-ui/compare/v1.1.0...v1.2.0) (2026-04-07)

### Features

- support sub-path deployment for preview URLs ([#19](https://github.com/pydantic/ai-chat-ui/issues/19)) ([7782ba4](https://github.com/pydantic/ai-chat-ui/commit/7782ba4da5d0c0e1c1f3f24c200e0364f149dcf0))

# [1.1.0](https://github.com/pydantic/ai-chat-ui/compare/v1.0.0...v1.1.0) (2026-02-16)

### Features

- display tool error text in modal dialog ([#11](https://github.com/pydantic/ai-chat-ui/issues/11)) ([eeba30c](https://github.com/pydantic/ai-chat-ui/commit/eeba30cc315bcd3efd553bf91aabac46647c7f56))

# 1.0.0 (2026-01-09)

### Features

- setup automation ([f966b87](https://github.com/pydantic/ai-chat-ui/commit/f966b87c3bd8627cc28730ff4b5034b395a4450a))
