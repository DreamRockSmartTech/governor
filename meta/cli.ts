/**
 * Governor CLI, forwarded through the umbrella package so the headline name
 * serves both the library and the tool:
 *
 * ```sh
 * deno install -gA -n governor jsr:@dreamrock/governor/cli
 * ```
 *
 * Thin forwarder over `@dreamrock/governor-cli` — the command surface,
 * version string, and behavior are the CLI package's own.
 *
 * @module
 */

import { main } from "@dreamrock/governor-cli";

export { main, VERSION as CLI_VERSION } from "@dreamrock/governor-cli";

if (import.meta.main) {
  Deno.exit(await main());
}
