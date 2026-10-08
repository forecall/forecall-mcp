// A stand-in for mcp.forecall.dev in the tests: the official SDK's createMcpHandler answering one
// JSON response per request, stateless, as the real server does, behind the same bearer check.
// It records the headers of each request so tests can see what the relay sent.
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";

export const KEY = "fc_agent_0123456789abcdefghijABCDEFGHIJ01";

function kbServer(): McpServer {
  const server = new McpServer(
    { name: "forecall", version: "0.1.0" },
    { instructions: "The Failure KB holds MCP tool failures and workarounds." },
  );
  server.registerTool(
    "kb_lookup",
    {
      description: "Look up known failures of a tool.",
      inputSchema: z.object({ server: z.string(), tool: z.string() }),
    },
    async ({ server: name, tool }) => ({
      content: [{ type: "text", text: `no known failures for ${name}/${tool}` }],
    }),
  );
  return server;
}

export interface FakeKb {
  url: string;
  requests: { method: string; headers: IncomingHttpHeaders }[];
  close(): Promise<void>;
}

export async function startFakeKb(): Promise<FakeKb> {
  const handler = createMcpHandler(() => kbServer(), { responseMode: "json" });
  const requests: FakeKb["requests"] = [];
  const server: Server = createServer(async (incoming, outgoing) => {
    requests.push({ method: incoming.method ?? "", headers: incoming.headers });
    if (incoming.headers.authorization !== `Bearer ${KEY}`) {
      outgoing.writeHead(401, { "Content-Type": "application/json" });
      outgoing.end('{"error":"invalid_key"}');
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks);
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (typeof value === "string") headers.set(name, value);
    }
    const request = new Request(`http://127.0.0.1${incoming.url ?? "/"}`, {
      method: incoming.method,
      headers,
      ...(body.length > 0 ? { body } : {}),
    });
    const response = await handler.fetch(request, {
      authInfo: { token: KEY, clientId: "test", scopes: ["kb"] },
    });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/mcp`,
    requests,
    close: () => new Promise((done) => server.close(() => done())),
  };
}
