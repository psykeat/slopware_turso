import assert from "node:assert/strict";
import test from "node:test";

import { getGridColumnOrderStorageKey, resolveGridLayoutState } from "./data-grid";

test("getGridColumnOrderStorageKey includes panelId so grids do not collide", () => {
  assert.equal(
    getGridColumnOrderStorageKey("article", "article-grid", "user-1"),
    "col-order:article:article-grid:user-1",
  );
  assert.equal(getGridColumnOrderStorageKey("article", "article-grid", null), null);
});

test("resolveGridLayoutState keeps legacy storage as bootstrap when no user override exists", () => {
  const state = resolveGridLayoutState({
    columns: [
      { key: "a", header: "A" },
      { key: "b", header: "B" },
      { key: "c", header: "C" },
    ],
    layoutResponse: {
      columnOrder: ["b", "a", "c"],
      resolution: {
        effectiveScope: "tenant",
        scopes: {
          global: { columnOrder: ["c", "b", "a"] },
          tenant: { columnOrder: ["b", "a", "c"] },
        },
      },
    },
    storedColumnOrder: ["c", "a", "b"],
  });

  assert.equal(state.hasServerUserOverride, false);
  assert.deepEqual(state.serverBaseColumnOrder, ["c", "b", "a"]);
  assert.deepEqual(state.serverTenantColumnOrder, ["b", "a", "c"]);
  assert.deepEqual(state.defaultColumnOrder, ["c", "a", "b"]);
});

test("resolveGridLayoutState prefers the server user override over legacy storage", () => {
  const state = resolveGridLayoutState({
    columns: [
      { key: "a", header: "A" },
      { key: "b", header: "B" },
      { key: "c", header: "C" },
    ],
    layoutResponse: {
      columnOrder: ["c", "b", "a"],
      resolution: {
        effectiveScope: "user",
        scopes: {
          global: { columnOrder: ["a", "b", "c"] },
          tenant: { columnOrder: ["b", "a", "c"] },
          user: { columnOrder: ["c", "b", "a"] },
        },
      },
    },
    storedColumnOrder: ["a", "c", "b"],
  });

  assert.equal(state.hasServerUserOverride, true);
  assert.deepEqual(state.defaultColumnOrder, ["c", "b", "a"]);
});
