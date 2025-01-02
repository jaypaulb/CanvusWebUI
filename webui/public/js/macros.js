// public/js/macros.js

document.addEventListener("DOMContentLoaded", () => {
  // 1) Setup tab navigation
  setupTabs();

  // 2) Fetch zones to populate dropdowns
  fetchZones();

  // 3) Bind button clicks for Manage (Move/Copy/Delete)
  document.getElementById("manageMoveBtn").addEventListener("click", manageMove);
  document.getElementById("manageCopyBtn").addEventListener("click", manageCopy);
  document.getElementById("manageDeleteBtn").addEventListener("click", manageDelete);

  // 4) Bind Undelete logic
  document.getElementById("refreshDeletedRecordsBtn").addEventListener("click", refreshDeletedRecords);
  // The deletedRecordsList items will be generated in refreshDeletedRecords()
  // Each item is clickable, calling handleRecordClick()

  // 5) Bind Grouping logic
  document.getElementById("autoGridExecuteBtn").addEventListener("click", autoGrid);
  document.getElementById("groupByColorBtn").addEventListener("click", groupByColor);
  document.getElementById("groupByTitleBtn").addEventListener("click", groupByTitle);

  // 6) Color tolerance slider
  setupColorToleranceSlider();

  // Modal confirmation
  document.getElementById("undeleteConfirmBtn").addEventListener("click", confirmUndelete);
  document.getElementById("undeleteCancelBtn").addEventListener("click", hideUndeleteModal);
});

/* ------------------------------------------------------------------------- */
/* Globals                                                                   */
/* ------------------------------------------------------------------------- */

let selectedRecordId = null;
let selectedRecordWidgetCount = 0;
let selectedRecordTypes = {};

/* ------------------------------ TAB SWITCHING ------------------------------ */
function setupTabs() {
  const tabs = [
    { tabId: "tab-manage", panelId: "panel-manage" },
    { tabId: "tab-undelete", panelId: "panel-undelete" },
    { tabId: "tab-grouping", panelId: "panel-grouping" },
  ];

  tabs.forEach(({ tabId, panelId }) => {
    const tabEl = document.getElementById(tabId);
    const panelEl = document.getElementById(panelId);
    tabEl.addEventListener("click", (e) => {
      e.preventDefault();
      // Deactivate all tabs/panels
      tabs.forEach(({ tabId: tId, panelId: pId }) => {
        document.getElementById(tId).classList.remove("active");
        document.getElementById(pId).classList.remove("active");
      });
      // Activate the clicked tab/panel
      tabEl.classList.add("active");
      panelEl.classList.add("active");
    });
  });

  // By default, show the first tab (Manage)
  document.getElementById("tab-manage").classList.add("active");
  document.getElementById("panel-manage").classList.add("active");
}

/* ------------------------------ FETCH ZONES ------------------------------ */
async function fetchZones() {
  try {
    console.log("[fetchZones] Fetching zones and canvas details...");
    const res = await fetch("/get-zones");
    const data = await res.json();

    if (!data.success || !data.zones) {
      throw new Error("Failed to retrieve zones from the server.");
    }

    console.log(`[fetchZones] Retrieved ${data.zones.length} zones.`);

    // Populate the dropdowns with the updated zones list
    populateZoneDropdowns(data.zones);
  } catch (err) {
    console.error("[fetchZones] Error:", err.message);
    displayMessage(err.message);
  }
}

function populateZoneDropdowns(zones) {
  // Manage panel uses manageSourceZone, manageTargetZone
  // Undelete panel uses undeleteTargetZone
  // Grouping panel uses groupingSourceZone
  const manageSource = document.getElementById("manageSourceZone");
  const manageTarget = document.getElementById("manageTargetZone");
  const undeleteTarget = document.getElementById("undeleteTargetZone");
  const groupingSource = document.getElementById("groupingSourceZone");

  // Clear existing
  manageSource.innerHTML = "";
  manageTarget.innerHTML = "";
  undeleteTarget.innerHTML = "";
  groupingSource.innerHTML = "";

  // Populate dropdowns
  zones.forEach((zone) => {
    const zoneName = zone.anchor_name || `Zone ${zone.id}`;
    const option = document.createElement("option");
    option.value = zone.id;
    option.textContent = zoneName;

    // Clone the option for each dropdown
    manageSource.appendChild(option.cloneNode(true));
    manageTarget.appendChild(option.cloneNode(true));
    undeleteTarget.appendChild(option.cloneNode(true));
    groupingSource.appendChild(option.cloneNode(true));
  });
}

/* ------------------------------ MANAGE ACTIONS ------------------------------ */
async function manageMove() {
  const sourceZoneId = document.getElementById("manageSourceZone").value;
  const targetZoneId = document.getElementById("manageTargetZone").value;
  if (!sourceZoneId || !targetZoneId) {
    displayMessage("Please select both Source and Target zones.");
    return;
  }
  try {
    const payload = { sourceZoneId, targetZoneId };
    const resp = await postJson("/api/macros/move", payload);
    displayMessage(resp.message);
  } catch (err) {
    displayMessage(err.message);
  }
}

async function manageCopy() {
  const sourceZoneId = document.getElementById("manageSourceZone").value;
  const targetZoneId = document.getElementById("manageTargetZone").value;
  if (!sourceZoneId || !targetZoneId) {
    displayMessage("Please select both Source and Target zones.");
    return;
  }
  try {
    const payload = { sourceZoneId, targetZoneId };
    console.log("manageCopy() => payload:", payload);
    const resp = await postJson("/api/macros/copy", payload);
    displayMessage(resp.message);
  } catch (err) {
    displayMessage(err.message);
  }
}

async function manageDelete() {
  const zoneId = document.getElementById("manageSourceZone").value;
  if (!zoneId) {
    displayMessage("Please select a Source zone for deletion.");
    return;
  }
  try {
    const payload = { zoneId };
    console.log("manageDelete() => payload:", payload);
    const resp = await postJson("/api/macros/delete", payload);
    displayMessage(resp.message);
  } catch (err) {
    displayMessage(err.message);
  }
}

/* ------------------------------------------------------------------------- */
/* Undelete + Delete History List                                           */
/* ------------------------------------------------------------------------- */

async function refreshDeletedRecords() {
  const listEl = document.getElementById("deletedRecordsList");
  listEl.innerHTML = "Loading deleted records...";
  try {
    const res = await fetch("/api/macros/deleted-records");
    if (!res.ok) {
      throw new Error("Failed to retrieve deleted records.");
    }
    const data = await res.json();
    if (!data.success || !data.records) {
      throw new Error("Invalid response retrieving deleted records.");
    }
    if (data.records.length === 0) {
      listEl.innerHTML = "No deleted records found.";
      return;
    }

    // Sort in descending order (most recent first)
    data.records.sort((a, b) => {
      if (a.timestamp < b.timestamp) return 1;
      if (a.timestamp > b.timestamp) return -1;
      return 0;
    });

    // If too many records, prompt a cleanup
    if (data.records.length > 5) {
      displayMessage(`There are ${data.records.length} delete history items. Consider cleaning older ones.`);
      // Optionally, you can implement automatic cleanup here or provide a button for it
    }

    // Render the records
    listEl.innerHTML = "";
    data.records.forEach(rec => {
      const div = document.createElement("div");
      div.classList.add("deletion-record");
      div.textContent = `Deleted at: ${rec.timestamp}, ID: ${rec.recordId}`;
      // We'll store the recordId in a data attribute
      div.dataset.recordId = rec.recordId;
      // Then we can handle a click
      div.addEventListener("click", handleDeletionRecordClick);
      listEl.appendChild(div);
    });
  } catch (err) {
    displayMessage(err.message);
    listEl.innerHTML = "Error loading records.";
  }
}

/**
 * When user clicks a record in the #deletedRecordsList,
 * we undelete that record to the chosen target zone.
 */
async function handleDeletionRecordClick(e) {
  const div = e.currentTarget;
  selectedRecordId = div.dataset.recordId;
  if (!selectedRecordId) {
    displayMessage("Invalid recordId for undelete.");
    return;
  }
  const targetZoneId = document.getElementById("undeleteTargetZone").value;
  if (!targetZoneId) {
    displayMessage("Please select a target zone for undelete.");
    return;
  }
  // We fetch extra info from the server if needed:
  showUndeleteModal(selectedRecordId);
}

/* 
   Show the modal overlay with a custom message 
*/
async function showUndeleteModal(recordId) {
  const overlay = document.getElementById("undeleteConfirmOverlay");
  const msgEl = document.getElementById("undeleteConfirmMessage");
  const listEl = document.getElementById("undeleteWidgetList");

  msgEl.textContent = `Restore deleted record [${recordId}]?`;

  try {
    const info = await getDeletedRecordDetails(recordId);
    // info.count, info.types
    listEl.innerHTML = `Will restore <strong>${info.count}</strong> widgets:<br/>`;
    if (Object.keys(info.types).length > 0) {
      listEl.innerHTML += "<ul>";
      for (const [t, cnt] of Object.entries(info.types)) {
        listEl.innerHTML += `<li>${t}: ${cnt}</li>`;
      }
      listEl.innerHTML += "</ul>";
    }
  } catch (err) {
    listEl.innerHTML = "No additional info. (Failed to load details)";
    console.log("[showUndeleteModal]", err);
  }

  overlay.style.display = "block";
}

/*
   Hide the modal
*/
function hideUndeleteModal() {
  selectedRecordId = null;
  const overlay = document.getElementById("undeleteConfirmOverlay");
  overlay.style.display = "none";
}

/* 
   Confirm -> calls POST /api/macros/undelete
*/
async function confirmUndelete() {
  if (!selectedRecordId) {
    displayMessage("No record selected to undelete.");
    hideUndeleteModal();
    return;
  }
  const targetZoneId = document.getElementById("undeleteTargetZone").value;
  if (!targetZoneId) {
    displayMessage("No target zone selected.");
    hideUndeleteModal();
    return;
  }
  try {
    const payload = { recordId: selectedRecordId, targetZoneId };
    const resp = await postJson("/api/macros/undelete", payload);
    displayMessage(resp.message || "Undelete success.");
    refreshDeletedRecords();
  } catch (err) {
    displayMessage(err.message);
  }
  hideUndeleteModal();
}

/* 
   Fetch deleted record details (optional)
*/
async function getDeletedRecordDetails(recordId) {
  const res = await fetch(`/api/macros/deleted-details?recordId=${recordId}`);
  if (!res.ok) {
    throw new Error("Failed to retrieve details for recordId=" + recordId);
  }
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Invalid response from details route");
  }
  return data; // { success:true, count: <number>, types: {...} }
}

/* ------------------------------------------------------------------------- */
/* Grouping: AutoGrid, Color, Title                                         */
/* ------------------------------------------------------------------------- */

async function autoGrid() {
  const zoneId = document.getElementById("groupingSourceZone").value;
  if (!zoneId) {
    displayMessage("Please select a Source zone for Auto-Grid.");
    return;
  }
  try {
    // We now only send { zoneId }
    const payload = { zoneId };
    const resp = await postJson("/api/macros/auto-grid", payload);
    displayMessage(resp.message);
  } catch (err) {
    displayMessage(err.message);
  }
}

async function groupByColor() {
  const zoneId = document.getElementById("groupingSourceZone").value;
  const tolerance = document.getElementById("colorToleranceSlider").value;
  if (!zoneId) {
    displayMessage("Please select a Source zone for Group by Color.");
    return;
  }
  try {
    const payload = { zoneId, tolerance };
    const resp = await postJson("/api/macros/group-color", payload);
    displayMessage(resp.message);
  } catch (err) {
    displayMessage(err.message);
  }
}

async function groupByTitle() {
  const zoneId = document.getElementById("groupingSourceZone").value;
  if (!zoneId) {
    displayMessage("Please select a Source zone for Group by Title.");
    return;
  }
  try {
    // The server might do alphabetical grouping or sorting
    const payload = { zoneId };
    const resp = await postJson("/api/macros/group-title", payload);
    displayMessage(resp.message);
  } catch (err) {
    displayMessage(err.message);
  }
}

/* ------------------------------------------------------------------------- */
/* Color Tolerance Slider                                                   */
/* ------------------------------------------------------------------------- */

function setupColorToleranceSlider() {
  const slider = document.getElementById("colorToleranceSlider");
  const valSpan = document.getElementById("colorToleranceValue");
  if (!slider || !valSpan) return;
  slider.addEventListener("input", () => {
    valSpan.textContent = slider.value + "%";
  });
}

/* ------------------------------------------------------------------------- */
/* Generic Helpers                                                           */
/* ------------------------------------------------------------------------- */

async function postJson(url, bodyObj) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyObj),
  });
  if (!resp.ok) {
    const msg = await resp.text();
    throw new Error(msg || "Server error");
  }
  return resp.json();
}

function displayMessage(msg) {
  const msgEl = document.getElementById("macro-message");
  if (msgEl) {
  msgEl.textContent = msg;
  } else {
    console.log("[displayMessage]", msg);
  }
}
