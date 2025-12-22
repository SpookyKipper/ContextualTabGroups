document.getElementById("close-modal").addEventListener("click", () => {
  document.querySelector(".modal").style.display = "none";
});

document.getElementById("add-entry").addEventListener("click", () => {
  document.querySelector(".modal").style.display = "block";
  document.getElementById("groupname").value = "";
  document.getElementById("hostname").value = "";
  document.getElementById("hostname").removeAttribute("disabled");
});

document.getElementById("save-entry").addEventListener("click", () => {
  insertData();
  //   document.querySelector(".modal").style.display = "none";
  //   listData(); // Refresh the displayed list after insertion
});
listData(); // Initial listing of data