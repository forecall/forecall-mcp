// The built dist/forecall-mcp.js, run as an MCP client runs it: the official SDK's client starts
// it over stdio, and it relays to a stand-in for the Failure KB (test/fake-kb.ts) built with the
// official SDK's server, as the real one is. Both the default protocol and the version
// negotiation e2e clients use go through it.
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import type { Metafile } from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build, bundledPackages } from "./build.ts";
import { type FakeKb, KEY, startFakeKb } from "./test/fake-kb.ts";

const outdir = mkdtempSync(join(tmpdir(), "forecall-mcp-bundle-"));
const bundle = join(outdir, "forecall-mcp.js");
const manifest = JSON.parse(readFileSync(new URL("package.json", import.meta.url), "utf8"));
let metafile: Metafile;
let kb: FakeKb;

beforeAll(async () => {
  metafile = await build(outdir);
  kb = await startFakeKb();
}, 60_000);

afterAll(async () => {
  await kb.close();
});

/** The SDK's client with forecall-mcp as its stdio server. */
async function connect(
  env: Record<string, string>,
  options: ConstructorParameters<typeof Client>[1] = {},
) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [bundle],
    env: { PATH: process.env.PATH ?? "", ...env },
    stderr: "pipe",
  });
  let stderr = "";
  transport.stderr?.on("data", (chunk) => {
    stderr += chunk;
  });
  const client = new Client({ name: "forecall-mcp-test", version: "0.0.0" }, options);
  await client.connect(transport);
  return { client, stderr: () => stderr };
}

describe("the bundle", () => {
  it("starts with a shebang and shows its version", async () => {
    expect(readFileSync(bundle, "utf8").startsWith("#!/usr/bin/env node\n")).toBe(true);
    const { execFileSync } = await import("node:child_process");
    expect(execFileSync(process.execPath, [bundle, "--version"], { encoding: "utf8" })).toBe(
      `forecall-mcp ${manifest.version}\n`,
    );
  });

  it("holds only its own source and the MCP client's npm packages, each with its license", async () => {
    const packages = await bundledPackages(metafile);
    expect(packages.map((pkg) => pkg.name)).toContain("@modelcontextprotocol/client");
    const notices = readFileSync(join(outdir, "THIRD_PARTY_NOTICES.md"), "utf8");
    for (const pkg of packages) {
      expect(notices).toContain(`## ${pkg.name} ${pkg.version} (${pkg.license})`);
    }
    for (const input of Object.keys(metafile.inputs)) {
      const ours = input.startsWith("src/") || input === "package.json";
      const npm = packages.some((pkg) => input.includes(`node_modules/${pkg.name}/`));
      expect(ours || npm, input).toBe(true);
    }
  });
});

describe.each([
  ["the default protocol", {}],
  ["version negotiation", { versionNegotiation: { mode: "auto" } }],
] as const)("relaying with %s", (_, options) => {
  it("lists and calls the KB's tools, with the server's instructions", async () => {
    const before = kb.requests.length;
    const { client } = await connect({ FORECALL_API_KEY: KEY, FORECALL_MCP_URL: kb.url }, options);
    try {
      expect(client.getInstructions()).toBe(
        "The Failure KB holds MCP tool failures and workarounds.",
      );
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).toEqual(["kb_lookup"]);
      const result = await client.callTool({
        name: "kb_lookup",
        arguments: { server: "weather", tool: "get_forecast" },
      });
      expect(result.content).toEqual([
        { type: "text", text: "no known failures for weather/get_forecast" },
      ]);
    } finally {
      await client.close();
    }
    const sent = kb.requests.slice(before).filter((request) => request.method === "POST");
    expect(sent.length).toBeGreaterThanOrEqual(3);
    for (const request of sent) {
      expect(request.headers.authorization).toBe(`Bearer ${KEY}`);
      expect(request.headers["user-agent"]).toBe(`forecall-mcp/${manifest.version}`);
    }
    // After the handshake, every request names the protocol version.
    expect(sent.slice(1).every((request) => request.headers["mcp-protocol-version"])).toBe(true);
  }, 30_000);
});

it("tells the client when the KB refuses the key", async () => {
  const wrong = `fc_agent_${"x".repeat(32)}`;
  await expect(connect({ FORECALL_API_KEY: wrong, FORECALL_MCP_URL: kb.url })).rejects.toThrow(
    /forecall-mcp: HTTP 401: .*\(check the agent key in FORECALL_API_KEY\)/,
  );
}, 30_000);

it("refuses to start without a key", async () => {
  await expect(connect({ FORECALL_MCP_URL: kb.url })).rejects.toThrow();
}, 30_000);
