document.querySelector("#go-to-options").addEventListener("click", function () {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL("options.html"));
  }
});

const t = (key) => chrome.i18n.getMessage(key);
// Confirmation state is tracked explicitly; comparing the (localized) button text would break per language
let confirming = false;

document
  .querySelector("#disband-all-tab-groups")
  .addEventListener("click", function (e) {
    if (!confirming) {
      confirming = true;
      e.target.textContent = t("areYouSure");
    } else {
      confirming = false;
      chrome.tabGroups.query({}, function (groups) {
        for (let group of groups) {
          chrome.tabs.query({ groupId: group.id }, function (tabs) {
            let tabIds = tabs.map((tab) => tab.id);
            chrome.tabs.ungroup(tabIds);
          });
        }
      });
      e.target.textContent = t("done");
      e.target.setAttribute("style", "background-color: #27ae60!important")
      setTimeout(() => {
        e.target.textContent = t("disbandAll");
        e.target.setAttribute("style", "background-color: #c0392b!important")
      }, 2000);
    }
  });
