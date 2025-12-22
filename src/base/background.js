import punycode from "./punycode.js";



// Start of IndexedDB for Group Name Configurations

var openDB = async () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("GrpNameConf", 2);

    request.onerror = (event) => {
      reject(`Error opening database: ${event.target.errorCode}`);
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Delete existing object store if it exists
      if (db.objectStoreNames.contains("GrpNameConf")) {
        db.deleteObjectStore("GrpNameConf");
      }

      const objectStore = db.createObjectStore("GrpNameConf", {
        keyPath: "hostname",
        autoIncrement: false,
      });
      objectStore.createIndex("hostname", "hostname", { unique: true });
      objectStore.createIndex("groupname", "groupname", { unique: false });
      loadDefaultValues();
    };
  });
};


async function loadDefaultValues() {
  const db = await openDB();
  const transaction = db.transaction(["GrpNameConf"], "readwrite");
  const objectStore = transaction.objectStore("GrpNameConf");

  objectStore.put({ hostname: "spooky.hk", groupname: "SpookyKipper" });
  objectStore.put({ hostname: "spookysrv.com", groupname: "Spooky Services" });
  objectStore.put({ hostname: "flow.spookysrv.com", groupname: "Flow" });
  objectStore.put({ hostname: "ssl.com", groupname: "SSL.com" });
  objectStore.put({
    hostname: "bluearchive.nexon.com",
    groupname: "Blue Archive",
  });
  objectStore.put({ hostname: "developer.mozilla.org", groupname: "MDN Docs" });
  objectStore.put({ hostname: "gemini.google.com", groupname: "Gemini" });
  objectStore.put({ hostname: "mail.google.com", groupname: "Gmail" });
  objectStore.put({
    hostname: "docs.google.com",
    groupname: "Google Workspace",
  });
  objectStore.put({ hostname: "tw-pjsekai.com", groupname: "世界計劃" });
}


async function getGroupNameForHostname(hostname) {
  const db = await openDB();
  const transaction = db.transaction(["GrpNameConf"], "readonly");
  const objectStore = transaction.objectStore("GrpNameConf");

  return new Promise((resolve, reject) => {
    console.log(hostname);
    
    // Try exact match first
    const request = objectStore.get(hostname);

    request.onsuccess = (event) => {
      const result = event.target.result;
      if (result) {
        resolve(result.groupname);
      } else {
        // No exact match, try suffix matching
        const parts = hostname.split('.');
        
        // Generate all possible suffixes, from most specific to least
        // For "a.edge.ms.com", try: "edge.ms.com", "ms.com"
        const tryNextSuffix = (index) => {
          if (index >= parts.length - 1) {
            // No more suffixes to try
            resolve(null);
            return;
          }
          
          const suffix = parts.slice(index + 1).join('.');
          const suffixRequest = objectStore.get(suffix);
          
          suffixRequest.onsuccess = (event) => {
            const suffixResult = event.target.result;
            if (suffixResult) {
              resolve(suffixResult.groupname);
            } else {
              // Try next suffix
              tryNextSuffix(index + 1);
            }
          };
          
          suffixRequest.onerror = (event) => {
            reject(`Error retrieving data: ${event.target.error}`);
          };
        };
        
        // Start trying suffixes
        tryNextSuffix(0);
      }
    };

    request.onerror = (event) => {
      reject(`Error retrieving data: ${event.target.error}`);
    };
  });
}
// End IndexedDB functions //
















const isFirefox = typeof browser !== "undefined";
let tabMaps = new Map();

// On extension startup, load all tabs into map. Prevents lone tab no ungrouped due to no previous tab data.
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed or updated!");
  chrome.tabs.query({}, function (tabs) {
    tabs.forEach(function (tab) {
      tabMaps.set(tab.id, tab);
    });
  });

  
  loadDefaultValues();



});

// On updated, if tab was ungrouped, check if it was the last tab in the group and ungroup if so disband it
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // tab was ungrouped
  const tabProp = tabMaps.get(tabId);
  if (typeof tabProp != "undefined" && tabProp.groupId >= 0) {
    disbandLoneGroup(tabProp.groupId);
  }

  setTimeout(() => {
    tabMaps.set(tabId, tab);
  }, 50);
});

// Detect New Tabs //
chrome.tabs.onCreated.addListener((tab) => {
  // console.log("New tab created");
  // console.log(tab);
  groupTabs(tab);
  tabMaps.set(tab.id, tab);
});

// Listen for tab removal from group or group updates
chrome.tabs.onRemoved.addListener((tabId) => {
  // console.log("Tab closed: ", tabId);
  const tabProp = tabMaps.get(tabId);
  // console.log(tabProp);
  if (typeof tabProp != "undefined" && tabProp.groupId >= 0) {
    disbandLoneGroup(tabProp.groupId);
  }

  tabMaps.delete(tabId);
});

chrome.tabs.onDetached.addListener((tab) => {
  const tabProp = tabMaps.get(tabId);
  if (typeof tabProp != "undefined" && tabProp.groupId >= 0) {
    disbandLoneGroup(tabProp.groupId);
  }

  chrome.tabs.get(tabId, (tab) => {
    tabMaps.set(tabId, tab);
  });
});

function disbandLoneGroup(groupId, retries = 0) {
  chrome.storage.sync.get({ auto_disband_group: true }, (items) => {
    if (items.auto_disband_group) {
      chrome.tabs.query({ groupId: groupId }, (tabs) => {
        // console.log(tabs);
        if (tabs.length === 1) {
          safeUngroupTab(tabs[0].id);
        } else if (tabs.length === 2 && isFirefox && retries <= 100) {
          // Firefox takes a while to update
          setTimeout(() => {
            disbandLoneGroup(groupId, retries + 1);
          }, 5);
        }
      });
    }
  });
}

// Format Domain Title /
const formatDomainTitle = (url) => {
  if (url.includes(".")) {
    // Remove Paths
    url = url.split("/")[2];
    // Remove protocol (http:// or https://) if present
    url = url.replace(/^(https?:\/\/)?(www\.)?/, "");
  }
  return url;
};
const getGrpNameFromDomain = (url) => {
  if (url.includes(".")) {
    // Split the domain by dots
    const parts = url.split(".");

    let word = "";
    // Check if it's a country-specific TLD (e.g., .co.uk)
    if (parts.length > 2 && parts[parts.length - 2].length <= 3) {
      word = parts[parts.length - 3];
    } else {
      word = parts[parts.length - 2];
    }
    if (word.startsWith("xn--")) {
      word = punycode.decode(word.slice(4));
    }
    const firstLetter = word.charAt(0);
    const firstLetterCap = firstLetter.toUpperCase();
    const remainingLetters = word.slice(1);
    return firstLetterCap + remainingLetters;
  }
  return "";
};
// Get Query Parameters //
const getQueryParam = (url, paramName) => {
  const link = new URL(url);
  const params = new URLSearchParams(link.search);
  return params.get(paramName);
};
// Check if url is a search engine //
const checkIsSearchEngine = (url) => {
  const isGoogle = url.includes("www.google.com");
  const isBing = url.includes("bing.com");
  const isBrave = url.includes("search.brave.com");
  const isEcosia = url.includes("ecosia.org");
  const isDDG = url.includes("duckduckgo.com");
  const isAsk = url.includes("ask.com/web");
  const isYahoo = url.includes("search.yahoo.com");
  const isSP = url.includes("startpage.com/sp/search");
  const isBaidu = url.includes("baidu.com/s");
  const isYT = url.includes("youtube.com/results");

  return (
    isGoogle ||
    isBing ||
    isBrave ||
    isEcosia ||
    isDDG ||
    isAsk ||
    isYahoo ||
    isSP ||
    isBaidu ||
    isYT
  );
};
const getSearchQueryUrlParam = (url) => {
  const isGoogle = url.includes("www.google.com");
  const isBing = url.includes("bing.com");
  const isBrave = url.includes("search.brave.com");
  const isEcosia = url.includes("ecosia.org");
  const isDDG = url.includes("duckduckgo.com");
  const isAsk = url.includes("ask.com/web");
  const isYahoo = url.includes("search.yahoo.com");
  const isSP = url.includes("startpage.com/sp/search");
  const isBaidu = url.includes("baidu.com/s");
  const isYT = url.includes("youtube.com/results");

  if (isGoogle || isBing || isBrave || isEcosia || isDDG || isAsk) return "q";
  if (isYT) return "search_query";
  if (isSP) return "query";
  if (isYahoo) return "p";
  if (isBaidu) return "wd";
};


// Tab Group Naming Function //
const nameTabGroup = async (groupId, url) => {
  const customName = await getGroupNameForHostname(formatDomainTitle(url));
  chrome.storage.sync.get(
    {
      auto_created_group_name: "%domain%",
      auto_created_group_name_search_engine: "%search_query%",
    },
    (items) => {
      let group_name_processed = "";
      if (items.auto_created_group_name != "") {
        if (customName) {
          group_name_processed = items.auto_created_group_name.replaceAll(
            "%domain%",
            customName
          );
        } else {
          group_name_processed = items.auto_created_group_name.replaceAll(
            "%domain%",
            getGrpNameFromDomain(formatDomainTitle(url))
          );
        }
      }
      if (
        checkIsSearchEngine(url) &&
        items.auto_created_group_name_search_engine != ""
      ) {
        const searchQuery = getQueryParam(url, getSearchQueryUrlParam(url));
        if (typeof searchQuery == "string") {
          if (customName) {
            group_name_processed = items.auto_created_group_name
              .replaceAll("%domain%", customName)
              .replaceAll("%search_query%", searchQuery);
          } else {
            group_name_processed = items.auto_created_group_name
              .replaceAll("%domain%", getGrpNameFromDomain(formatDomainTitle(url)))
              .replaceAll("%search_query%", searchQuery);
          }
        }
      }
      group_name_processed != "" &&
        chrome.tabGroups.update(groupId, { title: group_name_processed });
    }
  );
};
// Group Tabs //
// Check if pending url is here //
const groupTabs = (tab) => {
  if (typeof tab == "undefined") return;

  if (
    (typeof tab.pendingUrl != "undefined" && tab.pendingUrl !== "") ||
    (isFirefox && typeof tab.title != "undefined" && tab.title !== "")
    // Firefox does not have pendingUrl and put it in title instead.
  ) {
    if (tab.title === "New Tab" && tab.url === "about:blank" && isFirefox) {
      checkTabFF(tab);
    } else {
      groupTabsAction(tab);
    }
  } else {
    setTimeout(() => {
      checkTab(tab);
    }, 10);
  }
};
// re-get tab info //
const checkTab = (tab) => {
  chrome.tabs.get(tab.id, (tab) => {
    groupTabs(tab);
  });
};
const checkTabFF = (tab, retries = 0) => {
  if (retries > 20) return; // assume real about:blank after 20 tries
  browser.tabs.get(tab.id, (tab) => {
    // console.log(tab);
    if (tab.url === "about:blank" && tab.title === "New Tab" && isFirefox) {
      // Firefox mysteriously puts Tab Property opened with "<a> target _blank" with title "New Tab" (url about:blank) for a short while
      setTimeout(() => {
        checkTabFF(tab);
      }, 25 * retries + 1);
    } else {
      groupTabs(tab);
    }
  });
};
// actually group the tabs //
const groupTabsAction = (tab) => {
  // console.log(tab);
  function checkurl() {
    if (isFirefox) {
      if (tab.url === "about:blank") {
        return (
          tab.title &&
          !tab.title.startsWith("chrome://") &&
          !tab.title.startsWith("moz-extension:") &&
          !tab.title.startsWith("about:") &&
          !tab.title.includes("ntp.msn")
        );
      } else {
        return (
          tab.url &&
          !tab.url.startsWith("chrome://") &&
          !tab.url.startsWith("moz-extension:") &&
          !tab.url.startsWith("about:") &&
          !tab.url.includes("ntp.msn")
        );
      }
    } else {
      return (
        tab.pendingUrl &&
        !tab.pendingUrl.startsWith("chrome://") &&
        !tab.pendingUrl.startsWith("chrome-untrusted://") &&
        !tab.pendingUrl.startsWith("extension://") &&
        !tab.pendingUrl.startsWith("chrome-extension://") &&
        !tab.pendingUrl.startsWith("edge://") &&
        !tab.pendingUrl.startsWith("about:") &&
        !tab.pendingUrl.includes("ntp.msn")
      );
    }
  }

  if (tab.openerTabId && checkurl() && tab.groupId === -1) {
    chrome.tabs.get(tab.openerTabId, (openerTab) => {
      if (!openerTab.pinned) {
        chrome.tabs.group(
          {
            tabIds: [tab.openerTabId, tab.id],
          },
          (groupId) => {
            nameTabGroup(groupId, openerTab.url);
          }
        );
      }
    });
  }
};

// New tab in group keyboard shortcut //
chrome.commands.onCommand.addListener((command) => {
  if (command === "newTabInGroup") {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab.pinned) {
        chrome.tabs.create({ active: true, index: tab.index + 1 }, (newtab) => {
          if (tab.groupId >= 0) {
            chrome.tabs.group({ tabIds: [newtab.id], groupId: tab.groupId });
          } else {
            chrome.tabs.group({ tabIds: [tab.id, newtab.id] }, (groupId) => {
              nameTabGroup(groupId, tab.url);
            });
          }
        });
      }
    });
  }
});

// --- Safe ungroup editing helpers ---
function safeUngroupTab(tabId, retry = 0) {
  try {
    // console.log("Ungrouping tab ", tabId);
    if (isFirefox) {
      browser.tabs.ungroup(tabId);
    } else {
      chrome.tabs.ungroup(tabId, () => {
        if (
          chrome.runtime.lastError &&
          chrome.runtime.lastError.message &&
          chrome.runtime.lastError.message.includes(
            "Tabs cannot be edited right now"
          )
        ) {
          // Tab is being dragged by user, wait and retry
          if (retry < 15)
            setTimeout(() => safeUngroupTab(tabId, retry + 1), 100);
        }
      });
    }

    // console.log("Tab ungrouped successfully");
  } catch (e) {
    // console.log(e);
    if (
      e.message &&
      e.message.includes("Tabs cannot be edited right now") &&
      retry < 5
    ) {
      setTimeout(() => safeUngroupTab(tabId, retry + 1), 100 * (retry + 1));
    }
  }
}
