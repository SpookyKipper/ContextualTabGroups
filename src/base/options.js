// Saves options to chrome.storage
const saveOptions = () => {
  const auto_disband_group =
    document.getElementById("auto_disband_group").checked;
  const auto_created_group_name = document.getElementById(
    "auto_created_group_name"
  ).value;
  const auto_created_group_name_search_engine = document.getElementById(
    "auto_created_group_name_search_engine"
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
      status.textContent = "Options saved.";
      setTimeout(() => {
        status.textContent = "";
      }, 750);
    }
  );
};

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
  chrome.storage.sync.get(
    {
      auto_disband_group: true,
      auto_created_group_name: "%domain%",
      auto_created_group_name_search_engine: "%search_query%",
    },
    (items) => {
      document.getElementById("auto_disband_group").checked =
        items.auto_disband_group;
      document.getElementById("auto_created_group_name").value =
        items.auto_created_group_name;
      document.getElementById("auto_created_group_name_search_engine").value =
        items.auto_created_group_name_search_engine;
    }
  );
};

document.addEventListener("DOMContentLoaded", restoreOptions);
document.getElementById("save").addEventListener("click", saveOptions);

document
  .getElementById("openKeyboardShortcut")
  .addEventListener("click", () => {
    if (typeof browser == "undefined") {
      chrome.tabs.create({ url: "chrome://extensions/shortcuts#:~:text=New tab in Group / Create a new group" });
    } else {
      browser.commands.openShortcutSettings();
    }
  });


  if (typeof browser != "undefined") {
    document.getElementById("firefoxNote").style.display = "block";
  } else {
    document.getElementById("firefoxNote").style.display = "none";
  }

document
  .getElementById("openGrpNameConf")
  .addEventListener("click", () => {
    // Open in iframe instead of new tab
    const iframeContainer = document.getElementById("iframeContainer");
    const configIframe = document.getElementById("configIframe");
    configIframe.src = "grpnameconf.html";
    setTimeout(() => {
      iframeContainer.style.display = "block";
      document.body.style.overflow = "hidden"; // Disable background scrolling
    }, 50); // Slight delay to ensure iframe src is set before displaying
  });

// Close iframe handler
document
  .getElementById("closeIframe")
  .addEventListener("click", () => {
    const iframeContainer = document.getElementById("iframeContainer");
    const configIframe = document.getElementById("configIframe");
    iframeContainer.style.display = "none";
    configIframe.src = ""; // Clear iframe content
    document.body.style.overflow = "auto"; // Re-enable background scrolling
  });