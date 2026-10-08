// The package's version, read from package.json at build time (esbuild inlines the JSON).
import manifest from "../package.json" with { type: "json" };

export const VERSION: string = manifest.version;
