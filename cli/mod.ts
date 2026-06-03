/**
 * Governor CLI — the reference command-line frontend for `@dreamrock/governor-core`.
 *
 * One consumer of the frontend-agnostic core. A future VSCode extension is a
 * sibling frontend over the same core; contributors may fork this CLI or build
 * their own frontend against the library.
 *
 * This is a namespace-reservation stub for the initial `0.0.1` publish to JSR.
 * The real command surface lands in later versions.
 *
 * @module
 */

import { VERSION as CORE_VERSION } from "@dreamrock/governor-core";

/** Current package version. Kept in sync with the `version` field in deno.json. */
export const VERSION: string = "0.0.1";

if (import.meta.main) {
  console.log(`@dreamrock/governor-cli ${VERSION} (core ${CORE_VERSION})`);
}
