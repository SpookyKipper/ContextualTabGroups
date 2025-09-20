let tabMaps = new Map();
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.groupId === -1) {
    // tab was ungrouped
    const tabProp = tabMaps.get(tabId);
    if (typeof tabProp != "undefined" && tabProp.groupId >= 0) {
      disbandLoneGroup(tabProp.groupId);
    }
  }

  setTimeout(() => {
    tabMaps.set(tabId, tab);
  }, 50);
});

// Detect New Tabs //
chrome.tabs.onCreated.addListener((tab) => {
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
  chrome.tabs.query({ groupId: groupId }, (tabs) => {
    // console.log(tabs);
    if (tabs.length === 1) {
      safeUngroupTab(tabs[0].id);
    } else if (tabs.length === 2 && browser && retries <= 20) {
      // Firefox takes a while to update
      setTimeout(() => {
        disbandLoneGroup(groupId, retries + 1);
      }, 5);
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
    // Split the domain by dots
    const parts = url.split(".");
    // Check if it's a country-specific TLD (e.g., .co.uk)
    if (parts.length > 2 && parts[parts.length - 2].length <= 3) {
      word = parts[parts.length - 3];
    } else {
      word = parts[parts.length - 2];
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
const nameTabGroup = (groupId, url) => {
  chrome.storage.sync.get(
    {
      auto_created_group_name: "%domain%",
      auto_created_group_name_search_engine: "%search_query%",
    },
    (items) => {
      let group_name_processed = "";
      if (items.auto_created_group_name != "") {
        group_name_processed = items.auto_created_group_name.replaceAll(
          "%domain%",
          formatDomainTitle(url)
        );
      }
      if (
        checkIsSearchEngine(url) &&
        items.auto_created_group_name_search_engine != ""
      ) {
        const searchQuery = getQueryParam(url, getSearchQueryUrlParam(url));
        if (typeof searchQuery == "string")
          group_name_processed = items.auto_created_group_name_search_engine
            .replaceAll("%search_query%", searchQuery)
            .replaceAll("%domain%", formatDomainTitle(url));
      }
      group_name_processed != "" &&
        chrome.tabGroups.update(groupId, { title: group_name_processed });
    }
  );
};
// Group Tabs //
// Check if pending url is here //
const groupTabs = (tab) => {
  // console.log(tab);
  if (
    (typeof tab.pendingUrl != "undefined" && tab.pendingUrl !== "") ||
    (typeof tab.url != "undefined" && tab.url !== "")
  ) {
    groupTabsAction(tab);
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
// actually group the tabs //
const groupTabsAction = (tab) => {
  if (
    tab.openerTabId &&
    !tab.pendingUrl.includes("chrome://") &&
    !tab.pendingUrl.includes("extension://") &&
    !tab.pendingUrl.includes("edge://") &&
    !tab.pendingUrl.includes("moz-extension:") &&
    !tab.pendingUrl.includes("about:") &&
    !tab.pendingUrl.includes("ntp.msn") &&
    true &&
    !tab.url.includes("chrome://") &&
    !tab.url.includes("extension://") &&
    !tab.url.includes("edge://") &&
    !tab.url.includes("moz-extension:") &&
    !tab.url.includes("about:") &&
    !tab.url.includes("ntp.msn") &&
    tab.groupId === -1
  ) {
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

// Disband Tab Islands with only 1 tab //
function disbandSingleTabGroups() {
  chrome.tabGroups.query({}, (groups) => {
    groups.forEach((group) => {
      chrome.tabs.query({ groupId: group.id }, (tabs) => {
        if (tabs.length === 1) {
          chrome.tabs.ungroup(tabs[0].id);
        }
      });
    });
  });
}

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
    if (browser) {
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
        //   console.warn(
        //     "Retrying ungroup tab due to error:",
        //     chrome.runtime.lastError.message
        //   );
          if (retry < 10)
            setTimeout(
              () => safeUngroupTab(tabId, retry + 1),
              100 * (retry + 1)
            );
        //   if (retry >= 10)
        //     console.warn(
        //       "Failed to ungroup tab after several retries:",
        //       chrome.runtime.lastError.message
        //     );
        } else {
          // console.log("Tab ungrouped successfully");
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
