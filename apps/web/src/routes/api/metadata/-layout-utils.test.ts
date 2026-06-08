import assert from "node:assert/strict";
import test from "node:test";

import { canWriteLayoutScope, resolveLayoutBody } from "./-layout-utils";

test("resolveLayoutBody defaults to a personal user scope", () => {
  const resolved = resolveLayoutBody({
    layoutDefinition: {
      columnOrder: ["a", "b"],
    },
  });

  assert.equal(resolved.scope, "user");
  assert.deepEqual(resolved.layoutDefinition, {
    columnOrder: ["a", "b"],
  });
});

test("canWriteLayoutScope allows personal saves and gates published scopes", () => {
  assert.equal(
    canWriteLayoutScope({
      scope: "user",
      tenantRole: null,
      isSystemAdmin: false,
      isBaseTenant: false,
    }),
    true,
  );

  assert.equal(
    canWriteLayoutScope({
      scope: "tenant",
      tenantRole: "member",
      isSystemAdmin: false,
      isBaseTenant: false,
    }),
    false,
  );

  assert.equal(
    canWriteLayoutScope({
      scope: "tenant",
      tenantRole: "owner",
      isSystemAdmin: false,
      isBaseTenant: false,
    }),
    true,
  );

  assert.equal(
    canWriteLayoutScope({
      scope: "global",
      tenantRole: "owner",
      isSystemAdmin: false,
      isBaseTenant: true,
    }),
    true,
  );
});
