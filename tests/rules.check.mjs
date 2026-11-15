// Behavior check for domain rules (src/base/background.js + src/base/db.js)
// with a mocked `chrome` API and an in-memory IndexedDB. No dependencies.
// Run: node tests/rules.check.mjs
import assert from "node:assert/strict";

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// ---- in-memory IndexedDB, pre-seeded as an existing v3 database ----
const seed = [
  { hostname: "github.com", groupname: "Dev", color: "yellow" },
  { hostname: "gitlab.com", groupname: "Dev", color: "yellow" },
  { hostname: "bitbucket.org", groupname: "Dev", color: "blue" },
  { hostname: "old.com", groupname: "Old" },
  { hostname: "bad.com", groupname: "Bad", color: "<script>" },
  { hostname: "legacy.com", groupname: "Mixed" },
  { hostname: "mixed.com", groupname: "Mixed", color: "green" },
];
const state = { version: 3, deleted: false, stores: { GrpNameConf: { keyPath: "hostname", data: new Map(seed.map((r) => [r.hostname, r])) } } };
const clone = (v) => (v === undefined ? v : structuredClone(v));

function makeTx() {
  let pending = 0;
  const tx = { done: false };
  const check = () => {
    if (pending === 0 && !tx.done) { tx.done = true; tx.oncomplete && tx.oncomplete(); }
  };
  const schedule = (fn) => {
    pending++;
    const r = {};
    setTimeout(() => {
      r.result = fn();
      pending--;
      r.onsuccess && r.onsuccess({ target: r });
      setTimeout(check, 0);
    }, 0);
    return r;
  };
  setTimeout(check, 0);
  tx.objectStore = (name) => {
    const st = state.stores[name];
    return {
      get: (k) => schedule(() => clone(st.data.get(k))),
      getAll: () => schedule(() => [...st.data.values()].map(clone)),
      put: (v) => schedule(() => st.data.set(v[st.keyPath], clone(v))),
      delete: (k) => schedule(() => st.data.delete(k)),
      index: () => ({ getAll: (v) => schedule(() => [...st.data.values()].filter((x) => x.groupname === v).map(clone)) }),
      createIndex() {},
    };
  };
  return tx;
}
let upgradeTx;
const db = {
  objectStoreNames: { contains: (n) => n in state.stores },
  createObjectStore: (name, { keyPath }) => { state.stores[name] = { keyPath, data: new Map() }; return upgradeTx.objectStore(name); },
  deleteObjectStore: () => { state.deleted = true; },
  transaction: () => makeTx(),
};
globalThis.indexedDB = {
  open: (_n, v) => {
    const r = {};
    setTimeout(async () => {
      r.result = db;
      if (v > state.version) {
        upgradeTx = r.transaction = makeTx();
        r.onupgradeneeded();
        while (!upgradeTx.done) await tick(1);
        state.version = v;
      }
      r.onsuccess();
    }, 0);
    return r;
  },
};

// ---- chrome mock ----
const ev = () => { const fns = []; return { addListener: (f) => fns.push(f), fire: (...a) => fns.forEach((f) => f(...a)) }; };
const windows = { 1: { type: "normal" }, 2: { type: "popup" }, 3: { type: "normal" } };
const tabs = new Map();
const groups = new Map();
let nextGroup = 100;
let dragLocks = 0; // how many tabs.group calls fail as if the user were dragging a tab
const calls = { group: [], ungroup: [], openOptions: 0 };
const cbOrPromise = (v, cb) => (cb ? (cb(v), undefined) : Promise.resolve(v));
const addTab = (id, props) => { const t = { id, windowId: 1, pinned: false, groupId: -1, url: "chrome://newtab/", ...props }; tabs.set(id, t); return t; };

globalThis.chrome = {
  runtime: { getURL: () => "chrome-extension://x/", onInstalled: ev(), lastError: null, openOptionsPage: () => calls.openOptions++ },
  webNavigation: { onCreatedNavigationTarget: ev() },
  commands: { onCommand: ev() },
  storage: { sync: { get: (d, cb) => cb({ ...d }) } },
  windows: { get: async (id) => windows[id] },
  tabs: {
    onUpdated: ev(), onCreated: ev(), onRemoved: ev(), onDetached: ev(),
    get: (id, cb) => { const t = tabs.get(id); if (!t) return Promise.reject(new Error("no tab")); return cbOrPromise(t, cb); },
    query: (q, cb) => cbOrPromise([...tabs.values()].filter((t) => q.groupId === undefined || t.groupId === q.groupId), cb),
    group: (opts, cb) => {
      if (dragLocks > 0) {
        dragLocks--;
        return Promise.reject(new Error("Tabs cannot be edited right now (user may be dragging a tab)."));
      }
      calls.group.push(opts);
      let gid = opts.groupId;
      if (gid === undefined) {
        gid = nextGroup++;
        groups.set(gid, { id: gid, windowId: opts.createProperties?.windowId ?? tabs.get(opts.tabIds[0]).windowId, title: "", color: "grey" });
      }
      opts.tabIds.forEach((id) => (tabs.get(id).groupId = gid));
      return cbOrPromise(gid, cb);
    },
    ungroup: (id, cb) => { calls.ungroup.push(id); tabs.get(id).groupId = -1; cb && cb(); },
  },
  tabGroups: {
    get: async (id) => groups.get(id),
    query: async (q) => [...groups.values()].filter((g) => g.windowId === q.windowId),
    update: async (id, p) => Object.assign(groups.get(id), p),
  },
};

// background.js logs a lot; keep the check output readable
console.log = () => {};
await import("../src/base/background.js");
const dbApi = await import("../src/base/db.js");
const T = chrome.tabs;
const navigate = (id, url) => { const t = tabs.get(id); t.url = url; T.onUpdated.fire(id, { url }, t); };
const settle = () => tick(150);
const groupOf = (id) => groups.get(tabs.get(id).groupId);

// --- first install opens the options page (welcome guide), updates do not ---
chrome.runtime.onInstalled.fire({ reason: "install" });
chrome.runtime.onInstalled.fire({ reason: "update" });
assert.equal(calls.openOptions, 1);

// --- migration v3 -> v4 ---
addTab(1, {});
navigate(1, "https://gist.github.com/x");
await settle();
const D = state.stores.GrpNameConf.data, G = state.stores.Groups.data;
assert.equal(state.deleted, false, "upgrade must not delete stores");
assert.equal(state.version, 4);
assert.equal(D.size, seed.length, "no domain lost");
assert.deepEqual(Object.fromEntries([...G].map(([k, v]) => [k, v.color])), { Dev: "yellow", Old: "", Bad: "", Mixed: "green" });
assert.equal("color" in D.get("github.com"), false, "same-as-group color becomes inherited");
assert.equal(D.get("bitbucket.org").color, "blue", "different color kept as override");
assert.equal("color" in D.get("bad.com"), false, "invalid color dropped");

// --- rules ---
assert.deepEqual([groupOf(1).title, groupOf(1).color], ["Dev", "yellow"], "suffix match + group color");
addTab(2, {}); navigate(2, "https://bitbucket.org/"); await settle();
assert.equal(tabs.get(2).groupId, tabs.get(1).groupId, "override domain joins existing group");
addTab(3, { windowId: 3 }); navigate(3, "https://bitbucket.org/"); await settle();
assert.deepEqual([groupOf(3).title, groupOf(3).color], ["Dev", "blue"], "override color used when it creates the group");
addTab(4, {}); navigate(4, "https://legacy.com/"); await settle();
assert.equal(groupOf(4).title, "Mixed", "domain inherits colored group");
addTab(5, {}); navigate(5, "https://old.com/");
addTab(6, {}); navigate(6, "https://bad.com/");
addTab(7, { pinned: true }); navigate(7, "https://github.com/");
addTab(8, { windowId: 2 }); navigate(8, "https://github.com/");
await settle();
for (const id of [5, 6, 7, 8]) assert.equal(tabs.get(id).groupId, -1, `tab ${id} must stay ungrouped`);

// --- tab strip locked by a drag: the rule is retried, not dropped ---
dragLocks = 3;
addTab(10, {}); navigate(10, "https://gitlab.com/");
await tick(800);
assert.equal(dragLocks, 0);
assert.equal(groupOf(10).title, "Dev", "rule applied after the drag ends");

// --- manual ungroup is not reverted without a URL change ---
tabs.get(10).groupId = -1;
T.onUpdated.fire(10, { status: "complete" }, tabs.get(10));
await settle();
assert.equal(tabs.get(10).groupId, -1);

// --- override on a colorless group makes that domain a rule ---
await dbApi.putDomain({ hostname: "x.com", groupname: "Old", color: "red" });
addTab(9, {}); navigate(9, "https://x.com/"); await settle();
assert.deepEqual([groupOf(9).title, groupOf(9).color], ["Old", "red"]);
assert.equal(await dbApi.isRuleGroupTitle("Old"), true);
assert.equal(await dbApi.isRuleGroupTitle("Bad"), false);

// --- a rule group left with one tab is not disbanded; a normal one still is ---
assert.equal(tabs.get(2).groupId, tabs.get(1).groupId); // "Dev" in window 1: tabs 1 and 2
tabs.delete(2); T.onRemoved.fire(2); await settle();
assert.equal(groupOf(1)?.title, "Dev", "rule group survives with one tab");
assert.equal(calls.ungroup.length, 0);
groups.set(500, { id: 500, windowId: 1, title: "Foo", color: "blue" });
addTab(11, { groupId: 500 }); addTab(12, { groupId: 500 });
T.onUpdated.fire(11, {}, tabs.get(11)); T.onUpdated.fire(12, {}, tabs.get(12)); await settle();
tabs.delete(12); T.onRemoved.fire(12); await settle();
assert.deepEqual(calls.ungroup, [11], "non-rule lone group is still disbanded");

// --- options helpers: rename moves domains, delete removes them ---
await dbApi.saveGroup("Dev", { groupname: "Work", color: "green" });
assert.equal(G.has("Dev"), false);
assert.equal(G.get("Work").color, "green");
assert.deepEqual([...D.values()].filter((d) => d.groupname === "Work").map((d) => d.hostname).sort(), ["bitbucket.org", "github.com", "gitlab.com"]);
await dbApi.deleteGroup("Work");
assert.equal(G.has("Work"), false);
assert.equal([...D.values()].some((d) => d.groupname === "Work"), false);
assert.equal((await dbApi.listAll()).domains.length, D.size);

process.stdout.write("ALL CHECKS PASSED\n");
process.exit(0);
