// Bundles forecall-mcp into dist/forecall-mcp.js (src/cli.ts and the npm packages it uses), so
// that the published package depends on nothing. Not minified, so anyone can read what runs;
// esbuild drops the comments. No source map. The licenses of the bundled npm packages are written
// to dist/THIRD_PARTY_NOTICES.md.
//
//   node build.ts [outdir]
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

/** Licenses that let us bundle a package as long as its notice goes with it. */
export const ALLOWED_LICENSES = ["MIT", "ISC", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause"];

const packageDir = fileURLToPath(new URL(".", import.meta.url));

/** Builds dist/ into `outdir` and returns the metafile (bundle.test.ts reads it). */
export async function build(outdir = join(packageDir, "dist")): Promise<esbuild.Metafile> {
  const result = await esbuild.build({
    // Paths in the metafile are relative to this package.
    absWorkingDir: packageDir,
    entryPoints: { "forecall-mcp": "src/cli.ts" },
    outdir,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    legalComments: "none",
    metafile: true,
    logLevel: "warning",
    // The MCP client's CommonJS dependencies (cross-spawn) call require().
    banner: {
      js: '#!/usr/bin/env node\nimport { createRequire as __forecallCreateRequire } from "node:module";\nconst require = __forecallCreateRequire(import.meta.url);',
    },
  });
  const metafile = result.metafile as esbuild.Metafile;
  await writeFile(join(outdir, "THIRD_PARTY_NOTICES.md"), await thirdPartyNotices(metafile));
  return metafile;
}

export interface BundledPackage {
  name: string;
  version: string;
  license: string;
  /** The license file's text, then the NOTICE file's if the package has one. */
  texts: string[];
}

/** The npm packages whose code is in the bundle, from esbuild's metafile. */
export async function bundledPackages(metafile: esbuild.Metafile): Promise<BundledPackage[]> {
  const roots = new Set<string>();
  for (const input of Object.keys(metafile.inputs)) {
    const match = /^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(input);
    if (match?.[1] !== undefined) roots.add(match[1]);
  }
  const packages: BundledPackage[] = [];
  for (const root of roots) {
    const dir = join(packageDir, root);
    const manifest = JSON.parse(await readFile(join(dir, "package.json"), "utf8")) as {
      name: string;
      version: string;
      license?: string;
    };
    const files = await readdir(dir);
    const licenseFile = files.find((file) => /^licen[cs]e(\.(md|txt))?$/i.test(file));
    if (licenseFile === undefined) throw new Error(`${manifest.name} has no license file`);
    const license = manifest.license ?? "";
    if (!ALLOWED_LICENSES.includes(license)) {
      throw new Error(`${manifest.name} is under "${license}", which is not in ALLOWED_LICENSES`);
    }
    const texts = [await readFile(join(dir, licenseFile), "utf8")];
    const notice = files.find((file) => /^notice(\.(md|txt))?$/i.test(file));
    if (notice !== undefined) texts.push(await readFile(join(dir, notice), "utf8"));
    packages.push({ name: manifest.name, version: manifest.version, license, texts });
  }
  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

async function thirdPartyNotices(metafile: esbuild.Metafile): Promise<string> {
  const sections = (await bundledPackages(metafile)).map(
    (pkg) =>
      `## ${pkg.name} ${pkg.version} (${pkg.license})\n\n${pkg.texts.map((text) => text.trim()).join("\n\n")}\n`,
  );
  return `# Third-party notices\n\nThe forecall-mcp bundle includes code from these npm packages, under their own licenses.\n\n${sections.join("\n")}`;
}

if (import.meta.main) await build(process.argv[2] ? resolve(process.argv[2]) : undefined);
