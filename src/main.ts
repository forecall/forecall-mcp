// `forecall-mcp`: started by an MCP client as a stdio server, it relays to the Forecall Failure KB
// at https://mcp.forecall.dev/mcp with the agent key in FORECALL_API_KEY (relay.ts). For clients
// that start servers over stdio only, such as Claude Desktop or local LLM tools, and for networks
// where the client itself cannot reach the internet but this process can.
import { relay } from "./relay";
import { VERSION } from "./version";

export const ENDPOINT = "https://mcp.forecall.dev/mcp";

export const HELP = `Usage: forecall-mcp

Connects an MCP client that starts servers over stdio (Claude Desktop, local LLM tools) to the
Forecall Failure KB at ${ENDPOINT}. Run it as the server's command: it reads JSON-RPC on standard
input and writes the server's answers on standard output.

Environment:
  FORECALL_API_KEY  An agent key from https://app.forecall.dev/api-keys (fc_agent_...). Required.
  FORECALL_MCP_URL  Another endpoint, for development: https, or http on this machine.

Options:
  -h, --help        Show this help
  -v, --version     Show the version

In Claude Desktop's claude_desktop_config.json:
  "forecall": {
    "command": "npx",
    "args": ["-y", "forecall-mcp"],
    "env": { "FORECALL_API_KEY": "fc_agent_..." }
  }
`;

/** An agent key from the dashboard: `fc_agent_` and 32 letters and digits. */
export function isAgentKey(value: string): boolean {
  return /^fc_agent_[0-9A-Za-z]{32}$/.test(value);
}

/** The endpoint: the KB's, or FORECALL_MCP_URL when it is https or http on this machine. */
export function endpoint(value: string | undefined): URL | string {
  if (value === undefined || value === "") return new URL(ENDPOINT);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return `FORECALL_MCP_URL is not a URL: ${value}`;
  }
  const local =
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.hostname.endsWith(".localhost");
  if (url.protocol === "https:" || (url.protocol === "http:" && local)) return url;
  return "FORECALL_MCP_URL must be https, or http on this machine";
}

export interface MainIo {
  argv: string[];
  env: Record<string, string | undefined>;
  stdin: AsyncIterable<Uint8Array | string>;
  stdout(text: string): void;
  stderr(text: string): void;
}

/** Returns the exit code. */
export async function main(io: MainIo, fetchImpl?: typeof fetch): Promise<number> {
  const [first, ...rest] = io.argv;
  if (first === "-h" || first === "--help") {
    io.stdout(HELP);
    return 0;
  }
  if (first === "-v" || first === "--version") {
    io.stdout(`forecall-mcp ${VERSION}\n`);
    return 0;
  }
  if (first !== undefined || rest.length > 0) {
    io.stderr(`forecall-mcp: unexpected argument ${first}\n\n${HELP}`);
    return 2;
  }
  const key = io.env.FORECALL_API_KEY ?? "";
  if (!isAgentKey(key)) {
    io.stderr(
      key === ""
        ? "forecall-mcp: set FORECALL_API_KEY to an agent key from https://app.forecall.dev/api-keys\n"
        : "forecall-mcp: FORECALL_API_KEY is not an agent key (fc_agent_... from https://app.forecall.dev/api-keys)\n",
    );
    return 2;
  }
  const url = endpoint(io.env.FORECALL_MCP_URL);
  if (typeof url === "string") {
    io.stderr(`forecall-mcp: ${url}\n`);
    return 2;
  }
  await relay(io, {
    url,
    key,
    userAgent: `forecall-mcp/${VERSION}`,
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  });
  return 0;
}
