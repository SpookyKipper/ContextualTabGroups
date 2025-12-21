document.querySelector("#go-to-options").addEventListener("click", function () {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL("options.html"));
  }
});

document
  .querySelector("#disband-all-tab-groups")
  .addEventListener("click", function (e) {
    if (e.target.innerHTML === "Disband all tab groups")
      e.target.innerHTML = "Are you sure?";
    else {
      chrome.tabGroups.query({}, function (groups) {
        for (let group of groups) {
          chrome.tabs.query({ groupId: group.id }, function (tabs) {
            let tabIds = tabs.map((tab) => tab.id);
            chrome.tabs.ungroup(tabIds);
          });
        }
      });
      e.target.innerHTML = "Done!";
      e.target.setAttribute("style", "background-color: #27ae60!important")
      setTimeout(() => {
        e.target.innerHTML = "Disband all tab groups";
        e.target.setAttribute("style", "background-color: #c0392b!important")
      }, 2000);
    }
  });
