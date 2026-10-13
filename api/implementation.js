const { ExtensionSupport } = ChromeUtils.importESModule(
  "resource:///modules/ExtensionSupport.sys.mjs"
);

const PREF = "extensions.thunselect.preventNextSelection";

var thunselect = class extends ExtensionCommon.ExtensionAPI {
  onStartup() {
    this.active = true;
    this.windows = new Map();
    this.patches = new Map();
    ExtensionSupport.registerWindowListener(this.extension.id, {
      chromeURLs: ["chrome://messenger/content/messenger.xhtml"],
      onLoadWindow: win => this.watchWindow(win),
      onUnloadWindow: win => this.unwatchWindow(win),
    });
  }

  watchWindow(win) {
    if (this.windows.has(win)) {
      return;
    }
    const onLoad = event => this.patchPane(event.target.defaultView);
    win.addEventListener("DOMContentLoaded", onLoad, true);
    this.windows.set(win, onLoad);

    for (const tab of win.document.getElementById("tabmail").tabInfo) {
      this.patchPane(tab.chromeBrowser?.contentWindow);
    }
  }

  unwatchWindow(win) {
    win.removeEventListener("DOMContentLoaded", this.windows.get(win), true);
    this.windows.delete(win);
  }

  patchPane(pane) {
    if (
      !pane || pane.location.href !== "about:3pane" ||
      pane.document.readyState === "loading" || this.patches.has(pane)
    ) {
      return;
    }

    const listener = pane.dbViewWrapperListener;
    if (
      typeof listener?.onMessagesRemoved !== "function" ||
      !("_nextViewIndexAfterDelete" in listener)
    ) {
      console.error("ThUnselect: unsupported Thunderbird message-list API.");
      return;
    }

    const original = listener.onMessagesRemoved;
    const api = this;
    // shortcut: uses a private Thunderbird hook; revisit if its removal logic changes.
    function onMessagesRemoved(...args) {
      const nextIndex = this._nextViewIndexAfterDelete;
      const preventSelection =
        api.active && Services.prefs.getBoolPref(PREF, true) &&
        pane.gDBView && (pane.gFolder || pane.gViewWrapper?.isSynthetic) &&
        nextIndex != null && nextIndex >= 0 && nextIndex !== 0xffffffff &&
        !pane.mailContextMenu.selectionIsOverridden;

      if (!preventSelection) {
        return original.apply(this, args);
      }

      // Keep Thunderbird's housekeeping, but prevent its next-message branch.
      this._nextViewIndexAfterDelete = null;
      const result = original.apply(this, args);
      const tree = pane.threadTree;
      let notified = false;
      const onSelect = () => { notified = true; };
      tree.addEventListener("select", onSelect);
      try {
        tree.selectedIndex = -1;
      } finally {
        tree.removeEventListener("select", onSelect);
      }
      // An already-empty selection still needs to clear the old message preview.
      if (!notified) {
        tree.dispatchEvent(new pane.CustomEvent("select"));
      }
      return result;
    }

    const restore = () => {
      if (listener.onMessagesRemoved === onMessagesRemoved) {
        listener.onMessagesRemoved = original;
      }
      pane.removeEventListener("unload", restore);
      this.patches.delete(pane);
    };
    listener.onMessagesRemoved = onMessagesRemoved;
    pane.addEventListener("unload", restore, { once: true });
    this.patches.set(pane, restore);
  }

  onShutdown(isAppShutdown) {
    this.active = false;
    if (isAppShutdown) {
      return;
    }
    ExtensionSupport.unregisterWindowListener(this.extension.id);
    for (const win of this.windows.keys()) {
      this.unwatchWindow(win);
    }
    for (const restore of this.patches.values()) {
      restore();
    }
  }

  getAPI() {
    return {
      thunselect: {
        getEnabled: async () => Services.prefs.getBoolPref(PREF, true),
        setEnabled: async enabled => Services.prefs.setBoolPref(PREF, enabled),
      },
    };
  }
};
