/**
 * Governor — umbrella / meta package for the Governor governance toolkit.
 *
 * Portable, git-native governance for any repository. This flat package is the
 * convenience entry point: today it re-exports the core library so the headline
 * name is a real, functional publish. As the toolkit grows it becomes the
 * umbrella that re-exports across `@dreamrock/governor-core` and frontends.
 *
 * Components:
 * - `@dreamrock/governor-core` — the frontend-agnostic governance library.
 * - `@dreamrock/governor-cli` — the reference command-line frontend.
 *
 * This is a namespace-reservation stub for the initial `0.0.1` publish to JSR.
 *
 * @module
 */

export { VERSION as CORE_VERSION } from "@dreamrock/governor-core";

/** Current package version. Kept in sync with the `version` field in deno.json. */
export const VERSION: string = "0.0.1";
