/**
 * Governor — umbrella / meta package for the Governor governance toolkit.
 *
 * Portable, git-native governance for any repository. This flat package is the
 * convenience entry point: the default export re-exports the core library in
 * full, and `./cli` forwards the reference CLI, so the headline name serves
 * both the library and the tool:
 *
 * ```sh
 * deno install -gA -n governor jsr:@dreamrock/governor/cli
 * ```
 *
 * Components:
 * - `@dreamrock/governor-core` — the frontend-agnostic governance library (re-exported here in full).
 * - `@dreamrock/governor-cli` — the reference command-line frontend (forwarded via `./cli`).
 * - `@dreamrock/governor-skill` — the agent skill (cooperative layer).
 *
 * @module
 */

export * from "@dreamrock/governor-core";
export { VERSION as CORE_VERSION } from "@dreamrock/governor-core";

/** Current package version. Kept in sync with the `version` field in deno.json. */
export const VERSION: string = "0.2.0";
