const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const vm = require("node:vm");

function setup() {
  let enabled = true;
  const context = vm.createContext({
    ChromeUtils: { importESModule: () => ({ ExtensionSupport: {
      registerWindowListener() {},
      unregisterWindowListener() {},
    } }) },
    ExtensionCommon: { ExtensionAPI: class {} },
    Services: { prefs: {
      getBoolPref: () => enabled,
      setBoolPref: (_, value) => { enabled = value; },
    } },
    console,
  });
  vm.runInContext(readFileSync("api/implementation.js", "utf8"), context);
  const api = new context.thunselect();
  api.extension = { id: "test" };
  api.onStartup();

  let selectedIndex = -1;
  const tree = new EventTarget();
  Object.defineProperty(tree, "selectedIndex", {
    get: () => selectedIndex,
    set(value) {
      if (value !== selectedIndex) {
        selectedIndex = value;
        tree.dispatchEvent(new Event("select"));
      }
    },
  });
  let events = 0;
  tree.addEventListener("select", () => events++);
  const seen = [];
  const listener = {
    _nextViewIndexAfterDelete: 2,
    onMessagesRemoved(arg) {
      seen.push([this, this._nextViewIndexAfterDelete, arg]);
      return "housekeeping";
    },
  };
  const original = listener.onMessagesRemoved;
  const pane = Object.assign(new EventTarget(), {
    location: { href: "about:3pane" },
    document: { readyState: "complete" },
    dbViewWrapperListener: listener,
    gDBView: {},
    gFolder: {},
    mailContextMenu: { selectionIsOverridden: false },
    threadTree: tree,
    CustomEvent: Event,
  });
  api.patchPane(pane);
  return { api, pane, listener, original, seen, events: () => events };
}

test("prevents next selection, preserves housekeeping, clears preview exactly once", () => {
  for (const initiallySelected of [-1, 1]) {
    const s = setup();
    s.pane.threadTree.selectedIndex = initiallySelected;
    const before = s.events();
    assert.equal(s.listener.onMessagesRemoved("test"), "housekeeping");
    assert.deepEqual(s.seen, [[s.listener, null, "test"]]);
    assert.equal(s.pane.threadTree.selectedIndex, -1);
    assert.equal(s.events() - before, 1);
  }
});

test("passes through when disabled, unrelated, invalid, or context selection is overridden", async () => {
  for (const variant of ["disabled", "context", "no-view", "no-folder", null, -1, 0xffffffff]) {
    const s = setup();
    if (variant === "disabled") await s.api.getAPI().thunselect.setEnabled(false);
    else if (variant === "context") s.pane.mailContextMenu.selectionIsOverridden = true;
    else if (variant === "no-view") s.pane.gDBView = null;
    else if (variant === "no-folder") s.pane.gFolder = null;
    else s.listener._nextViewIndexAfterDelete = variant;
    const index = s.listener._nextViewIndexAfterDelete;
    assert.equal(s.listener.onMessagesRemoved(), "housekeeping");
    assert.equal(s.seen[0][1], index);
    assert.equal(s.events(), 0);
  }
});

test("patches once and restores on pane unload or add-on shutdown", () => {
  for (const shutdown of [false, true]) {
    const s = setup();
    const patched = s.listener.onMessagesRemoved;
    s.api.patchPane(s.pane);
    assert.equal(s.listener.onMessagesRemoved, patched);
    if (shutdown) s.api.onShutdown(false);
    else s.pane.dispatchEvent(new Event("unload"));
    assert.equal(s.listener.onMessagesRemoved, s.original);
    assert.equal(s.api.patches.size, 0);
  }
});

test("does not overwrite another add-on's later hook and leaves its chain inert", () => {
  const s = setup();
  const patched = s.listener.onMessagesRemoved;
  const other = function (...args) { return patched.apply(this, args); };
  s.listener.onMessagesRemoved = other;
  s.api.onShutdown(false);
  assert.equal(s.listener.onMessagesRemoved, other);
  s.listener.onMessagesRemoved();
  assert.equal(s.seen[0][1], 2);
  assert.equal(s.events(), 0);
});
