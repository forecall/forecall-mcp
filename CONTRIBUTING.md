# Contributing

Thank you for helping. Issues and pull requests are welcome in English or Japanese.

## Issues

- Say which client starts `forecall-mcp`, its version, the output of `forecall-mcp --version`, and
  what you expected. What `forecall-mcp` wrote on standard error helps.
- Never paste your agent key or any other secret.
- For a vulnerability, do not open an issue: see [SECURITY.md](SECURITY.md).

## Pull requests

1. Keep each pull request to one change, and say why it is needed.
2. Add or update tests with the change. `bundle.test.ts` starts the built relay with the official
   MCP SDK's client against a stand-in for the KB built with the SDK's server.
3. Run `pnpm check` (Biome, the type check and the tests) before you push. CI runs the same, and
   also packs the package and tries it on Node.js 22 and 24.
4. Write the title as a [Conventional Commit](https://www.conventionalcommits.org/), such as
   `fix: ...` or `feat: ...`. Pull requests are squash-merged into `main`.
5. Leave the version to the maintainers: a version raised on `main` starts a release.

## License of contributions

This repository is under the Apache License 2.0. As its section 5 says, a contribution you submit
for inclusion is under the same license, with no additional terms. There is no separate contributor
agreement to sign.
