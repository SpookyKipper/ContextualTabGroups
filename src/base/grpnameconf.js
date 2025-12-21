document.getElementById("close-modal").addEventListener("click", () => {
  document.querySelector(".modal").style.display = "none";
});

document.getElementById("add-entry").addEventListener("click", () => {
  document.querySelector(".modal").style.display = "block";
  document.getElementById("groupname").value = "";
  document.getElementById("hostname").innerText = "";
});