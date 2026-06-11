#!/usr/bin/env sh
# Gate proof: all four packages pass a JSR publish dry-run.
# Runnable for gate-02 — exit 0 = cleared, non-zero = failed.
# --allow-dirty: this proof runs mid-commit (pre-commit hook), when the
# working tree legitimately differs from HEAD.
exec deno publish --dry-run --allow-dirty --quiet
