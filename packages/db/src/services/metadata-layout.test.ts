import assert from "node:assert/strict";
import test from "node:test";

import { mergeLayoutDefinitionsByScope } from "./metadata";

test("mergeLayoutDefinitionsByScope applies layers in global -> org -> tenant -> user order", () => {
  const merged = mergeLayoutDefinitionsByScope([
    {
      scope: "tenant",
      layoutDefinition: {
        columnOrder: ["tenant-a", "tenant-b"],
        density: "compact",
      },
    },
    {
      scope: "global",
      layoutDefinition: {
        columnOrder: ["global-a", "global-b"],
        density: "spacious",
      },
    },
    {
      scope: "user",
      layoutDefinition: {
        columnOrder: ["user-a", "user-b"],
      },
    },
    {
      scope: "org",
      layoutDefinition: {
        density: "comfortable",
      },
    },
  ]);

  assert.deepEqual(merged.effectiveLayout, {
    columnOrder: ["user-a", "user-b"],
    density: "compact",
  });
  assert.equal(merged.effectiveScope, "user");
  assert.deepEqual(merged.rowsByScope.get("global")?.layoutDefinition, {
    columnOrder: ["global-a", "global-b"],
    density: "spacious",
  });
});
