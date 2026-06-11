#!/usr/bin/env sh
# Gate proof: the CLI integration (e2e) suite is green.
# Runnable for gate-01 — exit 0 = cleared, non-zero = failed.
exec deno test -A cli/tests/cli.e2e.ts
