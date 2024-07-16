// Format Domain Title /
const formatDomainTitle = (url) => {
    if (url.includes(".")) {
        // Remove Paths
        url = url.split("/")[2];
        // Remove protocol (http:// or https://) if present
        url = url.replace(/^(https?:\/\/)?(www\.)?/, '');
        // Split the domain by dots
        const parts = url.split('.');
        // Check if it's a country-specific TLD (e.g., .co.uk)
        if (parts.length > 2 && parts[parts.length - 2].length <= 3) {
            word = parts[parts.length - 3];
        } else {
            word = parts[parts.length - 2];
        }
        const firstLetter = word.charAt(0)
        const firstLetterCap = firstLetter.toUpperCase()
        const remainingLetters = word.slice(1)
        return (firstLetterCap + remainingLetters);
    }
    return "";
}
// Get Query Parameters //
const getQueryParam = (url, paramName) => {
    const link = new URL(url);
    const params = new URLSearchParams(link.search);
    return (params.get(paramName));
}
// Check if url is a search engine //
const checkIsSearchEngine = (url) => {
    const isGoogle = url.includes("www.google.com");
    const isBing = url.includes("bing.com");
    const isBrave = url.includes("search.brave.com");
    const isEcosia = url.includes("ecosia.org");
    const isDDG = url.includes("duckduckgo.com");

    return (isGoogle || isBing || isBrave || isEcosia || isDDG);
}
// Tab Group Naming Function //
const nameTabGroup = (groupId, url) => {
    chrome.storage.sync.get(
        { auto_created_group_name: "%domain%", auto_created_group_name_search_engine: "" },
        (items) => {
            let group_name_processed = "";
            if (items.auto_created_group_name != "") {
                group_name_processed = items.auto_created_group_name.replaceAll("%domain%", formatDomainTitle(url));
            }
            if (checkIsSearchEngine && items.auto_created_group_name_search_engine != "") {
                const searchQuery = getQueryParam(url, "q");
                if (typeof (searchQuery) == "string") group_name_processed = items.auto_created_group_name_search_engine.replaceAll("%search_query%", searchQuery);
            }
            group_name_processed != "" && chrome.tabGroups.update(groupId, { title: group_name_processed })
        }
    );
}
// Group Tabs //
// Check if pending url is here //
const groupTabs = (tab) => {
    console.log(tab);
    if ((typeof (tab.pendingUrl) != "undefined" && tab.pendingUrl !== "")) {
        groupTabsAction(tab);
    } else {
        setTimeout(() => {
            checkTab(tab);
        }, 10)
    }
}
// re-get tab info //
const checkTab = (tab) => {
    chrome.tabs.get(tab.id, (tab) => {
        groupTabs(tab);
    });
}
// actually group the tabs //
const groupTabsAction = (tab) => {
    if (tab.openerTabId && !(tab.pendingUrl.includes("chrome://")) && !(tab.pendingUrl.includes("extension://")) && !(tab.pendingUrl.includes("ntp.msn")) && tab.groupId === -1) {
        chrome.tabs.get(tab.openerTabId, (openerTab) => {
            if (!openerTab.pinned) {
                chrome.tabs.group({
                    tabIds: [tab.openerTabId, tab.id]
                }, (groupId) => {
                    nameTabGroup(groupId, openerTab.url);
                });
            }
        })
    }
}

// Detect New Tabs //
chrome.tabs.onCreated.addListener((tab) => {
    groupTabs(tab);
});



// Disband Tab Islands with only 1 tab //
chrome.storage.sync.get(
    { auto_disband_group: true },
    (items) => {
        if (items.auto_disband_group) {
            chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
                setTimeout(() => {
                    chrome.tabGroups.query({}, (info) => {
                        info.forEach(element => {
                            chrome.tabs.query({ groupId: element.id }, (tabs) => {
                                if (tabs.length == 1) {
                                    chrome.tabs.ungroup(tabs[0].id)
                                }
                            });
                        });
                    })
                }, 25);
            });

        }
    }
);


// New tab in group keyboard shortcut //
chrome.commands.onCommand.addListener((command) => {
    if (command === "newTabInGroup") {
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab.pinned) {
                chrome.tabs.create({ active: true, index: tab.index + 1 }, (newtab) => {
                    if (tab.groupId >= 0) {
                        chrome.tabs.group({ tabIds: [newtab.id], groupId: tab.groupId })
                    } else {
                        chrome.tabs.group({ tabIds: [newtab.id, tab.id] }, (groupId) => {
                            nameTabGroup(groupId, tab.url);
                        })
                    }
                })
            }
        })
    }
});