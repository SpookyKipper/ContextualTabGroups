// Open the database
var openDB = async () => {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open("GrpNameConf", 2);

    request.onerror = (event) => {
      reject(`Error opening database: ${event.target.errorCode}`);
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Delete existing object store if it exists
      if (db.objectStoreNames.contains("GrpNameConf")) {
        db.deleteObjectStore("GrpNameConf");
      }

      const objectStore = db.createObjectStore("GrpNameConf", {
        keyPath: "hostname",
        autoIncrement: false,
      });
      objectStore.createIndex("hostname", "hostname", { unique: true });
      objectStore.createIndex("groupname", "groupname", { unique: false });
    };
  });
};

var insertData = async () => {
  const db = await openDB();
  const transaction = db.transaction(["GrpNameConf"], "readwrite");
  const objectStore = transaction.objectStore("GrpNameConf");

  const hostname = document.getElementById("hostname").value;
  const groupname = document.getElementById("groupname").value;

  const regex = /^[A-Za-z0-9\.\-]{1,100}$/;
  if (!regex.test(hostname)) {
    alert(
      "- Invalid input on hostname. Only letters, numbers, dots, and hyphens are allowed, with a maximum length of 100 characters.\n- DO NOT include slashes, or http(s)://\n- Use Punycode domains (starting with xn--) for non-English hostnames."
    );
    return;
  }

  const data = { hostname, groupname };
  const request = objectStore.put(data);

  request.onsuccess = () => {
    console.log("Data inserted successfully!");
  };

  request.onerror = (event) => {
    console.error(`Error inserting data: ${event.target.error}`);
  };

  window.location.reload();
};

var deleteData = async () => {
  const db = await openDB();
  const transaction = db.transaction(["GrpNameConf"], "readwrite");
  const objectStore = transaction.objectStore("GrpNameConf");

  const request = objectStore.clear();

  request.onsuccess = () => {
    console.log("All data deleted successfully!");
    listData(); // Refresh the displayed list after deletion
  };

  request.onerror = (event) => {
    console.error(`Error deleting all data: ${event.target.error}`);
  };

  window.location.reload();
};
// Function to list all data
var listData = async () => {
  const db = await openDB();
  const transaction = db.transaction(["GrpNameConf"], "readonly");
  const objectStore = transaction.objectStore("GrpNameConf");

  const request = objectStore.getAll();

  request.onsuccess = (event) => {
    const data = event.target.result;
    displayDataAsList(data);
    console.log("List of Data:", data);
    // Display or process the data as needed
  };

  request.onerror = (event) => {
    console.error(`Error listing data: ${event.target.error}`);
  };
};

var displayDataAsList = (data) => {
  const resultList = document.querySelector("table");
  // resultList.innerHTML = ""; // Clear previous results

  data.forEach((entry) => {
    const listItem = document.createElement("tbody");
    const regex = /^[A-Za-z0-9\.\-]{1,100}$/;
    if (!regex.test(entry.hostname)) return;
    listItem.innerHTML = `<tr>
            <td>${entry.hostname}</td>
            <td id="groupnametemp">Load failed</td>
            <td>
              <img src="pen.svg" class="actions" id="modify-${entry.hostname}"><img src="trash.svg" class="actions" id="delete-${entry.hostname}">
            </td>
          </tr>`;

    resultList.appendChild(listItem);
    document.getElementById("groupnametemp").textContent = entry.groupname;
    document.getElementById("groupnametemp").removeAttribute("id");
    document
      .getElementById(`modify-${entry.hostname}`)
      .addEventListener("click", () => {
        document.querySelector(".modal").style.display = "block";
        document.getElementById("hostname").value = entry.hostname;
        document.getElementById("hostname").setAttribute("disabled", "true");
        document.getElementById("groupname").value = entry.groupname;
      });

    document
      .getElementById(`delete-${entry.hostname}`)
      .addEventListener("click", () => {
        const res = window.confirm(
          `Are you sure you want to delete ${entry.hostname}?`
        );
        if (res) {
          const dbPromise = openDB();
          dbPromise.then((db) => {
            const transaction = db.transaction(["GrpNameConf"], "readwrite");
            const objectStore = transaction.objectStore("GrpNameConf");
            const deleteRequest = objectStore.delete(entry.hostname);

            deleteRequest.onsuccess = () => {
              console.log(`Entry with hostname ${entry.hostname} deleted.`);
              window.location.reload();
            };

            deleteRequest.onerror = (event) => {
              console.error(`Error deleting entry: ${event.target.error}`);
            };
          });
        }
      });
  });
};
