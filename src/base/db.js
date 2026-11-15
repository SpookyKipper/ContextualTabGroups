// Shared IndexedDB access for the background worker and the options page (ES module).
//
// Store "GrpNameConf" (one record per hostname): { hostname, groupname, color? }
//   color here is an optional per-domain override.
// Store "Groups": { groupname, color }  color "" = name-only group (legacy behavior: only renames).

export const RULE_COLORS = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];
export const isColor = (c) => RULE_COLORS.includes(c);

const DOMAINS = "GrpNameConf";
const GROUPS = "Groups";

const req = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const done = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

// One cached connection per context instead of a new one per lookup.
let dbPromise = null;
export const openDB = () => (dbPromise ??= open().catch((e) => { dbPromise = null; throw e; }));

const open = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open("GrpNameConf", 4);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      // Let a newer version (e.g. after an extension update) upgrade instead of being blocked.
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    request.onupgradeneeded = () => {
      const db = request.result;
      const tx = request.transaction;
      // Never delete existing stores: user data must survive upgrades.
      if (!db.objectStoreNames.contains(DOMAINS)) {
        const store = db.createObjectStore(DOMAINS, { keyPath: "hostname" });
        store.createIndex("hostname", "hostname", { unique: true });
        store.createIndex("groupname", "groupname", { unique: false });
      }
      if (!db.objectStoreNames.contains(GROUPS)) {
        // v4: groups own the color. Each existing group takes the first valid color among its
        // domains; domains with that same color inherit it, a different color stays as override.
        const groups = db.createObjectStore(GROUPS, { keyPath: "groupname" });
        const domains = tx.objectStore(DOMAINS);
        domains.getAll().onsuccess = (event) => {
          const records = event.target.result;
          const groupColor = new Map();
          for (const d of records) {
            if (!groupColor.get(d.groupname)) groupColor.set(d.groupname, isColor(d.color) ? d.color : "");
          }
          groupColor.forEach((color, groupname) => groups.put({ groupname, color }));
          for (const d of records) {
            if ("color" in d && (d.color === groupColor.get(d.groupname) || !isColor(d.color))) {
              const { color, ...rest } = d;
              domains.put(rest);
            }
          }
        };
      }
    };
  });

const get = async (storeName, key) => {
  const db = await openDB();
  return req(db.transaction(storeName).objectStore(storeName).get(key));
};

const domainsOfGroup = async (groupname) => {
  const db = await openDB();
  return req(db.transaction(DOMAINS).objectStore(DOMAINS).index("groupname").getAll(groupname));
};

// Exact hostname first, then parent suffixes: "a.b.example.com" -> "b.example.com" -> "example.com" -> "com"
export async function getConfForHostname(hostname) {
  const parts = hostname.split(".");
  for (let i = 0; i < parts.length; i++) {
    const conf = await get(DOMAINS, parts.slice(i).join("."));
    if (conf) return conf;
  }
  return null;
}

// A domain is a rule when it resolves to a group name and a valid color (own override or group's).
export async function getRuleForHostname(hostname) {
  const conf = await getConfForHostname(hostname);
  if (!conf || !conf.groupname) return null;
  let color = isColor(conf.color) ? conf.color : null;
  if (!color) {
    const group = await get(GROUPS, conf.groupname);
    color = group && isColor(group.color) ? group.color : null;
  }
  return color ? { groupname: conf.groupname, color } : null;
}

// True when a tab group with this title is managed by a rule (must not be auto-disbanded).
export async function isRuleGroupTitle(title) {
  if (!title) return false;
  const group = await get(GROUPS, title);
  if (group && isColor(group.color)) return true;
  return (await domainsOfGroup(title)).some((d) => isColor(d.color));
}

// --- Options page helpers ---

export async function listAll() {
  const db = await openDB();
  const tx = db.transaction([GROUPS, DOMAINS]);
  const [groups, domains] = await Promise.all([req(tx.objectStore(GROUPS).getAll()), req(tx.objectStore(DOMAINS).getAll())]);
  return { groups, domains };
}

// Creates or updates a group; renaming moves its domains to the new name in the same transaction.
export async function saveGroup(oldName, group) {
  const db = await openDB();
  const tx = db.transaction([GROUPS, DOMAINS], "readwrite");
  const groups = tx.objectStore(GROUPS);
  const domains = tx.objectStore(DOMAINS);
  if (oldName != null && oldName !== group.groupname) {
    groups.delete(oldName);
    domains.index("groupname").getAll(oldName).onsuccess = (event) => {
      event.target.result.forEach((d) => domains.put({ ...d, groupname: group.groupname }));
    };
  }
  groups.put(group);
  return done(tx);
}

export async function deleteGroup(groupname) {
  const db = await openDB();
  const tx = db.transaction([GROUPS, DOMAINS], "readwrite");
  tx.objectStore(GROUPS).delete(groupname);
  const domains = tx.objectStore(DOMAINS);
  domains.index("groupname").getAll(groupname).onsuccess = (event) => {
    event.target.result.forEach((d) => domains.delete(d.hostname));
  };
  return done(tx);
}

export async function putDomain(record) {
  const db = await openDB();
  const tx = db.transaction(DOMAINS, "readwrite");
  tx.objectStore(DOMAINS).put(record);
  return done(tx);
}

export async function deleteDomain(hostname) {
  const db = await openDB();
  const tx = db.transaction(DOMAINS, "readwrite");
  tx.objectStore(DOMAINS).delete(hostname);
  return done(tx);
}
