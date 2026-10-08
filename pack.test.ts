import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { publishedManifest, stage } from "./pack.ts";

const manifest = JSON.parse(readFileSync(new URL("package.json", import.meta.url), "utf8"));

describe("publishedManifest", () => {
  it("keeps what npm users see, names this repository for the provenance, and has no dependencies", () => {
    const published = publishedManifest(manifest);
    expect(published).toMatchObject({
      name: "forecall-mcp",
      license: "Apache-2.0",
      bin: { "forecall-mcp": "dist/forecall-mcp.js" },
      engines: { node: ">=22" },
      repository: { type: "git", url: "git+https://github.com/forecall/forecall-mcp.git" },
    });
    for (const field of ["dependencies", "devDependencies", "scripts", "packageManager"]) {
      expect(published).not.toHaveProperty(field);
    }
  });
});

describe("the package", () => {
  it("holds only the bundle, its notices, the license, the notice, the readme and the manifest", async () => {
    const dir = await stage();
    const output = execFileSync("npm", ["pack", dir, "--dry-run", "--json"], { encoding: "utf8" });
    const [{ files }] = JSON.parse(output) as [{ files: { path: string }[] }];
    expect(files.map((file) => file.path).toSorted()).toEqual([
      "LICENSE",
      "NOTICE",
      "README.md",
      "dist/THIRD_PARTY_NOTICES.md",
      "dist/forecall-mcp.js",
      "package.json",
    ]);
    const staged = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    expect(staged).not.toHaveProperty("devDependencies");
  }, 60_000);
});
