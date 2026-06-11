/**
 * Governor CLI — the reference command-line frontend for
 * `@dreamrock/governor-core`.
 *
 * One consumer of the frontend-agnostic core. A future VSCode extension is a
 * sibling frontend over the same core; contributors may fork this CLI or build
 * their own against the library.
 *
 * Command surface: setup (`init`), porcelain workflow (`next`/`work`/`done`),
 * read (`check` incl. `--staged`, `index`), and write plumbing
 * (`new`/`set`/`edge`/`status`/`gate run`/`review-check`). Run
 * `governor --help` for the full synopsis.
 *
 * @module
 */

import { VERSION as CORE_VERSION } from "@dreamrock/governor-core";
import { dispatch } from "./src/args.ts";

/** Current package version. Kept in sync with the `version` field in deno.json. */
export const VERSION: string = "0.1.0";

if (import.meta.main) {
  const code = await dispatch(Deno.args, `${VERSION} (core ${CORE_VERSION})`);
  Deno.exit(code);
}
