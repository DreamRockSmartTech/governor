/**
 * Governor CLI — the reference command-line frontend for
 * `@dreamrock/governor-core`.
 *
 * One consumer of the frontend-agnostic core. A future VSCode extension is a
 * sibling frontend over the same core; contributors may fork this CLI or build
 * their own against the library.
 *
 * Commands in this release are read-only: `check` (validate a tree) and `index`
 * (regenerate the INDEX view). The mutation/creation surface (`new`/`set`/
 * `edge`) lands in a later version.
 *
 * @module
 */

import { VERSION as CORE_VERSION } from "@dreamrock/governor-core";
import { dispatch } from "./src/args.ts";

/** Current package version. Kept in sync with the `version` field in deno.json. */
export const VERSION: string = "0.0.1";

if (import.meta.main) {
  const code = await dispatch(Deno.args, `${VERSION} (core ${CORE_VERSION})`);
  Deno.exit(code);
}
