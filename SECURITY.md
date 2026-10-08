# Security

## Reporting a vulnerability

Report it privately through GitHub: open this repository's **Security** tab and choose
**Report a vulnerability**
([github.com/forecall/forecall-mcp/security/advisories/new](https://github.com/forecall/forecall-mcp/security/advisories/new)).
Do not open a public issue or pull request for it.

Please include what is affected (the version), how to reproduce it, and what an attacker could do
with it. We will reply in the report, keep you updated while we fix it, and credit you in the
advisory unless you prefer otherwise.

Vulnerabilities in the Forecall service (forecall.dev, app.forecall.dev, api.forecall.dev and
mcp.forecall.dev) can be reported the same way.

## Supported versions

Fixes go into the latest version of `forecall-mcp` on npm. Update to it.

## What runs on your machine

- `forecall-mcp` reads JSON-RPC messages on standard input and sends them only to the Forecall
  Failure KB at `https://mcp.forecall.dev/mcp`, or to the endpoint in `FORECALL_MCP_URL` (https, or
  http on your machine), with the agent key from `FORECALL_API_KEY` in the `Authorization` header.
- It writes the KB's answers on standard output and its own errors on standard error, never the
  key. It keeps nothing on disk and starts no other program.

Every version on npm is published from this repository's Release workflow with npm provenance, so
you can check which commit built it.
