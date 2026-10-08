// The entry the bin runs: real standard input, output and error, and the process's exit code.
import { main } from "./main";

process.exitCode = await main({
  argv: process.argv.slice(2),
  env: process.env,
  stdin: process.stdin,
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});
