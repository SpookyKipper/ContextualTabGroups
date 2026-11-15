import punycode from "./punycode.js";
import { getConfForHostname, getRuleForHostname, isRuleGroupTitle } from "./db.js";
const isFirefox = chrome.runtime.getURL("").startsWith("moz-extension://");
const isChrome = chrome.runtime.getURL("").startsWith("chrome-extension://");

// Genuine Tabs mean Tabs opened via browser click, and not a desktop shortcut or external link.
// Chrome put desktop shortcuts openerTabId as the one in active tab, no idea why.
// Not required on Firefox
const genuineNewTabs = new Set();
if (isChrome) {
  chrome.webNavigation.onCreatedNavigationTarget.addListener((details) => {
    console.log("New tab detected in onCreatedNavigationTarget: ", details);
    genuineNewTabs.add(details.tabId);
  });
}
// Start of Domain Rules (hostname -> group name + color) //
const getRuleForUrl = async (url) => {
  let hostname;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    hostname = u.hostname;
  } catch {
    return null;
  }
  return getRuleForHostname(hostname);
};

const isRuleGroup = async (groupId) => {
  try {
    const group = await chrome.tabGroups.get(groupId);
    return await isRuleGroupTitle(group.title);
  } catch (e) {
    return false;
  }
};

const applyRuleNow = async (tabId, retry = 0) => {
  try {
    await placeTabByRule(tabId);
  } catch (e) {
    // The tab strip is locked while the user drags a tab; retry like safeUngroupTab does
    if (retry < 10 && String(e && e.message).includes("cannot be edited right now")) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return applyRuleNow(tabId, retry + 1);
    }
    throw e;
  }
};

const placeTabByRule = async (tabId) => {
  const tab = await chrome.tabs.get(tabId); // re-read: state may have changed while queued or retrying
  if (tab.pinned) return;
  const rule = await getRuleForUrl(tab.url);
  if (!rule) return;
  const win = await chrome.windows.get(tab.windowId);
  if (win.type == "popup") return;

  const groups = await chrome.tabGroups.query({ windowId: tab.windowId });
  const group = groups.find((g) => g.title === rule.groupname);
  if (group) {
    if (tab.groupId !== group.id) {
      await chrome.tabs.group({ tabIds: [tab.id], groupId: group.id });
    }
  } else {
    const groupId = await chrome.tabs.group({
      tabIds: [tab.id],
      createProperties: { windowId: tab.windowId },
    });
    await chrome.tabGroups.update(groupId, { title: rule.groupname, color: rule.color });
  }
};

// ponytail: one global queue so two tabs hitting the same rule don't create two groups; per-window queues if it ever matters
let ruleQueue = Promise.resolve();
const applyRule = (tabId) => {
  ruleQueue = ruleQueue
    .then(() => applyRuleNow(tabId))
    .catch((e) => console.error("Applying domain rule failed:", e));
};
// End Domain Rules //

let tabMaps = new Map();

// On extension startup, load all tabs into map. Prevents lone tab no ungrouped due to no previous tab data.
chrome.runtime.onInstalled.addListener((details) => {
  console.log("Extension installed or updated!");
  // First install: open the options page, whose landing view is the welcome guide
  if (details && details.reason === "install") chrome.runtime.openOptionsPage();
  console.log("Firefox: ", isFirefox, " Chrome: ", isChrome);
  chrome.tabs.query({}, function (tabs) {
    tabs.forEach(function (tab) {
      tabMaps.set(tab.id, tab);
    });
  });
});

// On updated, if tab was ungrouped, check if it was the last tab in the group and ungroup if so disband it
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // tab was ungrouped
  const tabProp = tabMaps.get(tabId);
  if (typeof tabProp != "undefined" && tabProp.groupId >= 0) {
    disbandLoneGroup(tabProp.groupId);
  }

  // Domain rules run only on URL changes (new tab's first navigation or navigation in an
  // existing tab), so a tab the user ungroups manually is not pulled back while it stays put.
  if (changeInfo.url) applyRule(tabId);

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

chrome.tabs.onDetached.addListener((tabId) => {
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
          // Rule groups may live with a single tab
          isRuleGroup(groupId).then((ruleGroup) => {
            if (!ruleGroup) safeUngroupTab(tabs[0].id);
          });
        } else if (tabs.length === 2 && isFirefox && retries <= 100) {
          // Firefox takes a while to update
          setTimeout(() => {
            disbandLoneGroup(groupId, retries + 1);
          }, 20);
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
  const conf = await getConfForHostname(formatDomainTitle(url));
  const customName = conf ? conf.groupname : null;
  chrome.storage.sync.get(
    {
      auto_created_group_name: "%domain%",
      // Off by default: group names can sync to the browser account
      auto_created_group_name_search_engine: "",
    },
    (items) => {
      let group_name_processed = "";
      if (items.auto_created_group_name != "") {
        if (customName) {
          group_name_processed = items.auto_created_group_name.replaceAll(
            "%domain%",
            customName,
          );
        } else {
          group_name_processed = items.auto_created_group_name.replaceAll(
            "%domain%",
            getGrpNameFromDomain(formatDomainTitle(url)),
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
            group_name_processed = items.auto_created_group_name_search_engine
              .replaceAll("%domain%", customName)
              .replaceAll("%search_query%", searchQuery);
          } else {
            group_name_processed = items.auto_created_group_name_search_engine
              .replaceAll(
                "%domain%",
                getGrpNameFromDomain(formatDomainTitle(url)),
              )
              .replaceAll("%search_query%", searchQuery);
          }
        }
      }
      group_name_processed != "" &&
        chrome.tabGroups.update(groupId, { title: group_name_processed });
    },
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
      setTimeout(
        () => {
          checkTabFF(tab);
        },
        25 * retries + 1,
      );
    } else {
      groupTabs(tab);
    }
  });
};
// actually group the tabs //
const groupTabsAction = (tab) => {
  console.log("Grouping tabs for tab: ", tab);
  // console.log(tabMaps.get(tab.openerTabId));

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
        // (tab.pendingUrl.startsWith("http://") ||
        //   tab.pendingUrl.startsWith("https://")) // do not group if opened from file shortcut (Chrome puts openerTabId for those for unknown reason)
      );
    }
  }

  async function proceedGroupTab() {
    if (tab.openerTabId && checkurl() && tab.groupId === -1) {
      // Rule-matching tabs are placed by applyRule (tabs.onUpdated), which wins over opener grouping
      const url = isFirefox && tab.url === "about:blank" ? tab.title : tab.pendingUrl || tab.url;
      if (await getRuleForUrl(url)) return;
      chrome.tabs.get(tab.openerTabId, (openerTab) => {
        if (!openerTab.pinned) {
          chrome.tabs.group(
            {
              tabIds: [tab.openerTabId, tab.id],
            },
            (groupId) => {
              nameTabGroup(groupId, openerTab.url);
            },
          );
        }
      });
    }
  }

  if (isChrome) {
    function checkLaunchedFromShortcut(time = 0) {
      if (genuineNewTabs.has(tab.id)) {
        console.log("Tab is genuine, proceeding to group check");
        genuineNewTabs.delete(tab.id); // cleanup to prevent memory leak
        if (typeof tab.openerTabId != "undefined") {
          // Check if window & opener window is not a popup
          console.log(tab);
          console.log(tabMaps.get(tab.openerTabId));
          chrome.windows
            .get(tabMaps.get(tab.openerTabId).windowId)
            .then((window) => {
              if (window.type != "popup") {
                console.log(
                  "Opener window is not a popup, proceeding to group tab",
                );
                chrome.windows
                  .get(tab.windowId)
                  .then((currentWindow) => {
                    if (currentWindow.type != "popup") {
                      proceedGroupTab();
                      console.log(
                        "Current window is not a popup, proceeding to group tab",
                      );
                    } else {
                      console.log(
                        "Current window is a popup, not grouping tab",
                      );
                    }
                  })
                  .catch((error) => {
                    console.error("Error retrieving current window:", error);
                  });
              } else {
                console.log("Opener window is a popup, not grouping tab");
              }
            })
            .catch((error) => {
              console.error("Error retrieving window:", error);
            });
        }
      } else {
        if (time < 20) {
          setTimeout(() => {
            checkLaunchedFromShortcut(time + 1);
          }, 50); // wait
        } else {
          console.log("Tab is likely opened from shortcut, skipping grouping.");
        }
      }
    }

    checkLaunchedFromShortcut();
  } else {
    // Firefox
    proceedGroupTab();
  }
};

// New tab in group keyboard shortcut //
chrome.commands.onCommand.addListener((command) => {
  if (command === "newTabInGroup") {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab.pinned) {
        chrome.windows
          .get(tab.windowId)
          .then((currentWindow) => {
            if (currentWindow.type != "popup") {
              chrome.tabs.create(
                { active: true, index: tab.index + 1 },
                (newtab) => {
                  if (tab.groupId >= 0) {
                    chrome.tabs.group({
                      tabIds: [newtab.id],
                      groupId: tab.groupId,
                    });
                  } else {
                    chrome.tabs.group(
                      { tabIds: [tab.id, newtab.id] },
                      (groupId) => {
                        nameTabGroup(groupId, tab.url);
                      },
                    );
                  }
                },
              );
            } else {
              console.log("Current window is a popup, not grouping tab");
            }
          })
          .catch((error) => {
            console.error("Error retrieving current window:", error);
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
            "Tabs cannot be edited right now",
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
