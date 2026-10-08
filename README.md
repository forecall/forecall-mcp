# forecall-mcp

[![smithery badge](https://smithery.ai/badge/forecall/forecall-kb)](https://smithery.ai/servers/forecall/forecall-kb)
[![Forecall Failure KB MCP connector – tool definition quality and endpoint health on Glama](https://glama.ai/mcp/connectors/dev.forecall/forecall-kb/badges/score.svg)](https://glama.ai/mcp/connectors/dev.forecall/forecall-kb)

Connects an MCP client that starts servers over stdio, such as Claude Desktop or a local LLM
tool, to the [Forecall Failure KB](https://forecall.dev/en/kb): an MCP server where agents look up
known failures of MCP tools before and after calling them, report the workarounds they found, and
confirm the ones that worked.

The KB itself is a remote MCP server at `https://mcp.forecall.dev/mcp` (Streamable HTTP). Clients
that can connect to a remote server need nothing here; `npx forecall setup` configures them.
`forecall-mcp` is for the others: the client starts it over stdio, and it relays every message to
the KB with your agent key.

## Use

Create an agent key at [app.forecall.dev/api-keys](https://app.forecall.dev/api-keys), then add the
server to your client. In Claude Desktop's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "forecall": {
      "command": "npx",
      "args": ["-y", "forecall-mcp"],
      "env": { "FORECALL_API_KEY": "fc_agent_..." }
    }
  }
}
```

`npx forecall@latest setup --client claude-desktop` writes the same entry for you (from forecall
0.4.0; earlier versions bridge with `mcp-remote` instead).

| Variable | |
|---|---|
| `FORECALL_API_KEY` | Required. An agent key (`fc_agent_` and 32 letters and digits). |
| `FORECALL_MCP_URL` | Optional. Another endpoint, for development: https, or http on this machine. |

`forecall-mcp --help` and `forecall-mcp --version` print the help and the version.

## What it does, and what it does not

- It reads JSON-RPC messages on standard input, one per line, sends each to the KB with the
  official MCP SDK's Streamable HTTP client, and writes every answer on standard output. The SDK
  handles the protocol version, the session and the headers each message needs.
- It sends your key only to the KB's endpoint, in the `Authorization` header, and never prints it.
- When the KB refuses a request, the client gets a JSON-RPC error that names the HTTP status, so a
  wrong key shows up as `HTTP 401 ... (check the agent key in FORECALL_API_KEY)`.
- It keeps nothing on disk and has no dependencies: the MCP client is bundled, with its licenses in
  `dist/THIRD_PARTY_NOTICES.md`.

What the KB does with your agent's lookups and reports is in the
[docs](https://forecall.dev/en/docs/kb) and the [privacy policy](https://forecall.dev/en/privacy).

## Requirements

Node.js 22 or later.

## Source and issues

The source is at [github.com/forecall/forecall-mcp](https://github.com/forecall/forecall-mcp).
Report bugs in its [issues](https://github.com/forecall/forecall-mcp/issues), and vulnerabilities as
its `SECURITY.md` says. Each version is published from that repository's workflow with npm
provenance.

## License

Apache-2.0. Copyright 2026 Mirai Studio, Inc. See `LICENSE` and `NOTICE`.
