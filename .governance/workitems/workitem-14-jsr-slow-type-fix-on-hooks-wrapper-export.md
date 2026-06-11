---
uid: 38f3214e-4750-4f2a-97a2-a92ca5d525c0
id: workitem-14-jsr-slow-type-fix-on-hooks-wrapper-export
node_type: workitem
status: complete
title: JSR slow-type fix on hooks WRAPPER export
owner: j.bellero@dreamrocksmarttech.com
parent: masterplan-01-road-to-v1
---

## Description

Annotate the exported `WRAPPER` constant in `core/src/hooks.ts` with an explicit
`: string` type so the package passes JSR's no-slow-types check.

## Evidence

JSR flagged `WRAPPER` as a slow type (https://jsr.io/docs/about-slow-types): the
no-slow-types rule requires explicit annotations on exported symbols whose types are
not trivially inferable, and an exported `const` initialized with a template literal
does not qualify — unlike the plain string-literal consts beside it. Every other
export in the module was already compliant (annotated array consts, explicit function
return types), so this was the lone diagnostic.

## Approach

Add the `: string` annotation in place; no behavioral change. Verified with
`deno lint` and a clean `deno publish --dry-run`. Rejected: converting the template
literal to a plain quoted string (would force escaped newlines and hurt readability
of the embedded shell script).
