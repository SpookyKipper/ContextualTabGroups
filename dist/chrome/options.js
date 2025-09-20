// Saves options to chrome.storage
const saveOptions = () => {
  const auto_disband_group = document.getElementById('auto_disband_group').checked;
  const auto_created_group_name = document.getElementById('auto_created_group_name').value;
  const auto_created_group_name_search_engine = document.getElementById('auto_created_group_name_search_engine').value;

  chrome.storage.sync.set(
    { auto_disband_group: auto_disband_group, auto_created_group_name: auto_created_group_name, auto_created_group_name_search_engine: auto_created_group_name_search_engine},
    () => {
      // Update status to let user know options were saved.
      const status = document.getElementById('status');
      status.textContent = 'Options saved.';
      setTimeout(() => {
        status.textContent = '';
      }, 750);
    }
  );
};

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
  chrome.storage.sync.get(
    {auto_disband_group: true, auto_created_group_name: "%domain%", auto_created_group_name_search_engine: "%search_query%"},
    (items) => {
        document.getElementById('auto_disband_group').checked = items.auto_disband_group;
        document.getElementById('auto_created_group_name').value = items.auto_created_group_name;
        document.getElementById('auto_created_group_name_search_engine').value = items.auto_created_group_name_search_engine;
    }
  );
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);