// The relay: JSON-RPC messages from an MCP client over stdio, one per line, go to the Forecall
// Failure KB over Streamable HTTP, and every message the server sends back goes out on stdout.
// The official SDK's HTTP client transport speaks the HTTP side (sessions, protocol versions and
// the headers each message needs); this file only frames stdio and passes messages through.
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

/** A JSON-RPC message as it arrives: only the fields the relay looks at are typed. */
interface Message {
  jsonrpc?: unknown;
  id?: string | number | null;
  method?: unknown;
  result?: { protocolVersion?: unknown };
}

export interface RelayIo {
  /** Standard input, as chunks of bytes. */
  stdin: AsyncIterable<Uint8Array | string>;
  /** Writes to standard output: JSON-RPC only. */
  stdout(text: string): void;
  /** Writes to standard error: what went wrong, never the key. */
  stderr(text: string): void;
}

export interface RelayOptions {
  url: URL;
  key: string;
  userAgent: string;
  fetch?: typeof fetch;
}

const isRequest = (message: Message) =>
  typeof message.method === "string" && message.id !== undefined && message.id !== null;

/**
 * What went wrong with a send, for the client: the SDK's message, with the HTTP status when the
 * server answered one, and a hint when it refused the key.
 */
export function describe(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status !== "number") return text;
  const hint = status === 401 || status === 403 ? " (check the agent key in FORECALL_API_KEY)" : "";
  return `HTTP ${status}: ${text}${hint}`;
}

/** Lines of text from chunks of bytes, without their line ends. */
export async function* lines(input: AsyncIterable<Uint8Array | string>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let rest = "";
  for await (const chunk of input) {
    rest += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
    let at = rest.indexOf("\n");
    while (at >= 0) {
      yield rest.slice(0, at).replace(/\r$/, "");
      rest = rest.slice(at + 1);
      at = rest.indexOf("\n");
    }
  }
  rest += decoder.decode();
  if (rest.trim() !== "") yield rest;
}

/** Runs until standard input ends and every request sent has been answered or failed. */
export async function relay(io: RelayIo, options: RelayOptions): Promise<void> {
  const write = (message: unknown) => io.stdout(`${JSON.stringify(message)}\n`);
  const transport = new StreamableHTTPClientTransport(options.url, {
    requestInit: {
      headers: { Authorization: `Bearer ${options.key}`, "User-Agent": options.userAgent },
    },
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  // The ids of the `initialize` requests sent: their answers carry the protocol version the
  // transport must name on every later request.
  const initializing = new Set<string | number>();
  transport.onmessage = (message) => {
    const answer = message as Message;
    if (answer.id !== undefined && answer.id !== null && initializing.delete(answer.id)) {
      const version = answer.result?.protocolVersion;
      if (typeof version === "string") transport.setProtocolVersion(version);
    }
    write(message);
  };
  transport.onerror = (error) => {
    io.stderr(`forecall-mcp: ${error.message}\n`);
  };
  await transport.start();

  const pending = new Set<Promise<void>>();
  for await (const line of lines(io.stdin)) {
    if (line.trim() === "") continue;
    let message: Message;
    try {
      message = JSON.parse(line) as Message;
    } catch {
      write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      continue;
    }
    if (message.method === "initialize" && isRequest(message)) {
      initializing.add(message.id as string | number);
    }
    // Sent without waiting, so that requests run side by side as the client sent them.
    const sent = transport
      .send(message as Parameters<typeof transport.send>[0])
      .catch((error: unknown) => {
        const text = describe(error);
        if (isRequest(message)) {
          initializing.delete(message.id as string | number);
          write({
            jsonrpc: "2.0",
            id: message.id,
            error: { code: -32000, message: `forecall-mcp: ${text}` },
          });
        } else {
          io.stderr(`forecall-mcp: ${text}\n`);
        }
      })
      .finally(() => {
        pending.delete(sent);
      });
    pending.add(sent);
  }
  await Promise.all(pending);
  await transport.close();
}
