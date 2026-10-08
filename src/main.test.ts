import { describe, expect, it } from "vitest";
import { ENDPOINT, endpoint, HELP, isAgentKey, type MainIo, main } from "./main";
import { describe as describeError, lines } from "./relay";
import { VERSION } from "./version";

const KEY = "fc_agent_0123456789abcdefghijABCDEFGHIJ01";

/** main with these arguments and environment; what it printed and returned. */
async function run(argv: string[], env: MainIo["env"] = {}) {
  const out = { stdout: "", stderr: "" };
  const code = await main({
    argv,
    env,
    stdin: (async function* () {})(),
    stdout: (text) => {
      out.stdout += text;
    },
    stderr: (text) => {
      out.stderr += text;
    },
  });
  return { code, ...out };
}

describe("forecall-mcp", () => {
  it.each([["--help"], ["-h"]])("prints the help for %s", async (flag) => {
    expect(await run([flag])).toEqual({ code: 0, stdout: HELP, stderr: "" });
  });

  it.each([["--version"], ["-v"]])("prints the version for %s", async (flag) => {
    expect(await run([flag])).toEqual({ code: 0, stdout: `forecall-mcp ${VERSION}\n`, stderr: "" });
  });

  it("refuses arguments it does not know", async () => {
    const { code, stderr } = await run(["lint"]);
    expect(code).toBe(2);
    expect(stderr).toContain("unexpected argument lint");
  });

  it.each([
    [{}, "set FORECALL_API_KEY"],
    [{ FORECALL_API_KEY: "" }, "set FORECALL_API_KEY"],
    [{ FORECALL_API_KEY: "fc_ci_0123456789abcdefghijABCDEFGHIJ01" }, "is not an agent key"],
    [{ FORECALL_API_KEY: KEY, FORECALL_MCP_URL: "http://example.com/mcp" }, "must be https"],
    [{ FORECALL_API_KEY: KEY, FORECALL_MCP_URL: "not a url" }, "is not a URL"],
  ])("stops before relaying with %j", async (env, message) => {
    const { code, stdout, stderr } = await run([], env);
    expect(code).toBe(2);
    expect(stdout).toBe("");
    expect(stderr).toContain(message);
    expect(stderr).not.toContain(KEY.slice(9));
  });
});

describe("isAgentKey", () => {
  it.each([
    [KEY, true],
    ["fc_agent_short", false],
    [`${KEY}x`, false],
    ["fc_vendor_0123456789abcdefghijABCDEFGHIJ01", false],
    ["", false],
  ])("%s → %s", (key, expected) => {
    expect(isAgentKey(key)).toBe(expected);
  });
});

describe("endpoint", () => {
  it("is the KB's by default", () => {
    expect(String(endpoint(undefined))).toBe(ENDPOINT);
    expect(String(endpoint(""))).toBe(ENDPOINT);
  });

  it.each([
    "https://mcp.example.com/mcp",
    "http://localhost:8788/mcp",
    "http://127.0.0.1:4176/mcp",
    "http://mcp.forecall.localhost:8788/mcp",
  ])("takes %s", (url) => {
    expect(endpoint(url)).toBeInstanceOf(URL);
  });

  it.each(["http://example.com/mcp", "ftp://localhost/mcp", "mcp.forecall.dev"])(
    "refuses %s",
    (url) => {
      expect(typeof endpoint(url)).toBe("string");
    },
  );
});

describe("lines", () => {
  const collect = async (chunks: (string | Uint8Array)[]) => {
    const out: string[] = [];
    for await (const line of lines(
      (async function* () {
        yield* chunks;
      })(),
    )) {
      out.push(line);
    }
    return out;
  };

  it("splits on newlines across chunks, drops CR, and keeps a last line without one", async () => {
    expect(await collect(['{"a":', '1}\n{"b":2}\r\n', '{"c":3}'])).toEqual([
      '{"a":1}',
      '{"b":2}',
      '{"c":3}',
    ]);
  });

  it("decodes UTF-8 split across chunks", async () => {
    const bytes = new TextEncoder().encode('"天気"\n');
    expect(await collect([bytes.slice(0, 2), bytes.slice(2)])).toEqual(['"天気"']);
  });
});

describe("the error a client sees", () => {
  it("names the HTTP status, and the key when it was refused", () => {
    const refused = Object.assign(new Error("Error POSTing to endpoint: {}"), { status: 401 });
    expect(describeError(refused)).toBe(
      "HTTP 401: Error POSTing to endpoint: {} (check the agent key in FORECALL_API_KEY)",
    );
    const busy = Object.assign(new Error("Error POSTing to endpoint: slow down"), { status: 429 });
    expect(describeError(busy)).toBe("HTTP 429: Error POSTing to endpoint: slow down");
    expect(describeError(new Error("fetch failed"))).toBe("fetch failed");
    expect(describeError("odd")).toBe("odd");
  });
});
