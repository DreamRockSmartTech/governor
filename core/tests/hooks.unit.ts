import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import {
  defaultPolicyHook,
  ENGINE_DIR,
  HOOK_NAMES,
  HOOKS_PATH,
  missingSigningKeys,
  POLICY_DIR,
  stubScript,
  WRAPPER,
} from "../src/hooks.ts";

Deno.test("HOOKS_PATH points git at the engine dir for core.hooksPath", () => {
  // git invokes hooks from the engine (generated) dir; policy files sit beside it.
  assertEquals(HOOKS_PATH, ".governance/hooks/_");
  assertEquals(ENGINE_DIR, ".governance/hooks/_");
  assertEquals(POLICY_DIR, ".governance/hooks");
});

Deno.test("HOOK_NAMES includes the shipped defaults", () => {
  assert(HOOK_NAMES.includes("pre-commit"));
  assert(HOOK_NAMES.includes("commit-msg"));
});

Deno.test("the wrapper honors the GOVERNOR=0 bypass and runs the policy file", () => {
  assertStringIncludes(WRAPPER, "GOVERNOR");
  // It must invoke the sibling policy hook by name.
  assertStringIncludes(WRAPPER, "hook_name");
});

Deno.test("stubScript sources the wrapper (hook name derived at runtime from $0)", () => {
  const stub = stubScript("pre-commit");
  assertStringIncludes(stub, "governor.sh");
  // The stub is generic — the wrapper resolves the hook name from $0, so the
  // stub body itself does not embed the hook name.
  assertStringIncludes(stub, "dirname");
});

Deno.test("defaultPolicyHook(pre-commit) runs governor check", () => {
  const hook = defaultPolicyHook("pre-commit");
  assertStringIncludes(hook, "governor check");
});

Deno.test("missingSigningKeys reports exactly the absent mandate keys", () => {
  const present = {
    "user.name": "Justin",
    "user.email": "j@x.com",
    "commit.gpgsign": "true",
    "gpg.program": "gpg",
    "user.signingkey": "ABC",
  };
  assertEquals(missingSigningKeys(present), []);

  const partial = { "user.name": "Justin", "commit.gpgsign": "false" };
  const missing = missingSigningKeys(partial);
  assert(missing.includes("user.email"));
  assert(missing.includes("user.signingkey"));
  // gpgsign present-but-false counts as unsatisfied.
  assert(missing.includes("commit.gpgsign"));
});
