const isFirefox = chrome.runtime.getURL("").startsWith("moz-extension://");

// Saves options to chrome.storage
const saveOptions = () => {
  const auto_disband_group =
    document.getElementById("auto_disband_group").checked;
  const auto_created_group_name = document.getElementById(
    "auto_created_group_name",
  ).value;
  const auto_created_group_name_search_engine = document.getElementById(
    "auto_created_group_name_search_engine",
  ).value;

  chrome.storage.sync.set(
    {
      auto_disband_group: auto_disband_group,
      auto_created_group_name: auto_created_group_name,
      auto_created_group_name_search_engine:
        auto_created_group_name_search_engine,
    },
    () => {
      // Update status to let user know options were saved.
      const status = document.getElementById("status");
      status.textContent = chrome.i18n.getMessage("optionsSaved");
      setTimeout(() => {
        status.textContent = "";
      }, 750);
    },
  );
};

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
  chrome.storage.sync.get(
    {
      auto_disband_group: true,
      auto_created_group_name: "%domain%",
      auto_created_group_name_search_engine: "",
    },
    (items) => {
      document.getElementById("auto_disband_group").checked =
        items.auto_disband_group;
      document.getElementById("auto_created_group_name").value =
        items.auto_created_group_name;
      document.getElementById("auto_created_group_name_search_engine").value =
        items.auto_created_group_name_search_engine;
    },
  );
};

document.addEventListener("DOMContentLoaded", restoreOptions);
document.getElementById("save").addEventListener("click", saveOptions);

document
  .getElementById("openKeyboardShortcut")
  .addEventListener("click", () => {
    if (!isFirefox) {
      chrome.tabs.create({
        // Text fragment highlights the command, whose description is localized
        url: `chrome://extensions/shortcuts#:~:text=${encodeURIComponent(chrome.i18n.getMessage("cmdNewTabInGroup"))}`,
      });
    } else {
      browser.commands.openShortcutSettings();
    }
  });

if (isFirefox) {
  document.getElementById("firefoxNote").style.display = "block";
} else {
  document.getElementById("firefoxNote").style.display = "none";
}

// Two top tabs; none is open until the user picks one (the welcome guide shows meanwhile)
const tabs = [...document.querySelectorAll('[role="tab"]')];
const selectTab = (tab) => {
  tabs.forEach((t) => {
    const selected = t === tab;
    t.setAttribute("aria-selected", String(selected));
    t.tabIndex = selected ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !selected;
  });
  document.getElementById("pick-hint").hidden = true;
};
tabs.forEach((tab) => tab.addEventListener("click", () => selectTab(tab)));

// ARIA tabs keyboard pattern: Left/Right/Home/End move between tabs
document.querySelector('[role="tablist"]').addEventListener("keydown", (e) => {
  const i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  const tab = tabs[(next + tabs.length) % tabs.length];
  tab.focus();
  selectTab(tab);
});

// Welcome guide: jump straight into creating the first group
document.getElementById("welcome-start").addEventListener("click", () => {
  selectTab(document.getElementById("tab-groups"));
  document.getElementById("new-group").click();
});

// Populate version number (no fetch needed)
document.getElementById("version").textContent =
  chrome.runtime.getManifest().version;
