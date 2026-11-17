const API_URL =
  "https://script.google.com/macros/s/AKfycbzkXsDaHUn9Jmz8IgE3d1Bk4U86Q9korDsbEgK6v6GZ0CXzFohmG0B8FESK_oXJQWS5Dg/exec";

let isLoading = false;

function jsonpRequest() {
  return new Promise((resolve, reject) => {
    const callbackName =
      "sheetCallback_" + Date.now();

    const script = document.createElement("script");

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Google Sheets request timed out"));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      script.remove();
      delete window[callbackName];
    }

    window[callbackName] = function (data) {
      cleanup();
      resolve(data);
    };

    script.onerror = function () {
      cleanup();
      reject(new Error("Unable to load Google Sheets data"));
    };

    script.src =
      API_URL +
      "?action=read&callback=" +
      callbackName +
      "&t=" +
      Date.now();

    document.head.appendChild(script);
  });
}

function show(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function updateDashboard(rows) {
  if (!rows.length) {
    show("temperatureValue", "--");
    show("fireValue", "No data");
    show("personsValue", "--");
    show("doorValue", "No data");
    show("fingerprintNote", "No records");
    show("temperatureNote", "No readings");
    show("fireNote", "No readings");
    show("bannerTitle", "No readings available");
    show("bannerMessage", "Waiting for sensor records.");
    show("bannerTag", "NO DATA");
    renderEvents([]);
    return;
  }

  const latest = rows[0];

  show("temperatureValue", latest.Temperature || "--");
  show("personsValue", latest.Persons || "--");
  show("fingerprintNote", latest.Fingerprint || "No fingerprint information");

  const fire = String(latest.Fire || "").trim().toLowerCase();

  if (["1", "yes", "true", "on", "fire", "detected", "high", "danger"].includes(fire)) {
    show("fireValue", "DETECTED");
    show("fireNote", "Fire alert reported");
    show("bannerIcon", "🔥");
    show("bannerTitle", "Fire alert reported");
    show("bannerMessage", "Verify the sensor and follow emergency procedures.");
    show("bannerTag", "ALERT");
    document.getElementById("safetyBanner").className = "alert-banner danger";
  } else if (["0", "no", "false", "off", "clear", "safe", "normal", "no fire"].includes(fire)) {
    show("fireValue", "Clear");
    show("fireNote", "Latest sensor value");
    show("bannerIcon", "🛡️");
    show("bannerTitle", "No fire detected in latest reading");
    show("bannerMessage", "Continue monitoring the sensor readings.");
    show("bannerTag", "MONITORING");
    document.getElementById("safetyBanner").className = "alert-banner safe";
  } else {
    show("fireValue", latest.Fire || "Unknown");
    show("fireNote", "Check sensor value");
    show("bannerTitle", "Safety status needs verification");
    show("bannerMessage", "The fire sensor value is missing or unrecognized.");
    show("bannerTag", "CHECK");
    document.getElementById("safetyBanner").className = "alert-banner";
  }

  const event = String(latest.Event || "").toLowerCase();

  if (event.includes("denied") || event.includes("rejected") || event.includes("invalid")) {
    show("doorValue", "Denied");
  } else if (event.includes("granted") || event.includes("authorized") || event.includes("unlocked")) {
    show("doorValue", "Granted");
  } else {
    show("doorValue", latest.Event || "Unknown");
  }

  setEquipment("fanValue", latest.Fan);
  setEquipment("pumpValue", latest.Pump);

  renderEvents(rows);
}

function setEquipment(id, value) {
  const element = document.getElementById(id);
  if (!element) return;

  const v = String(value ?? "").trim().toLowerCase();
  element.textContent = value === "" || value == null ? "Unknown" : String(value);
  element.className = "state-pill";

  if (["1", "on", "running", "active", "true", "yes"].includes(v)) {
    element.classList.add("on");
  } else if (["0", "off", "stopped", "inactive", "false", "no"].includes(v)) {
    element.classList.add("off");
  } else {
    element.classList.add("neutral");
  }
}

function renderEvents(rows) {
  const table = document.getElementById("eventsTable");
  if (!table) return;

  table.replaceChildren();

  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 9;
    td.className = "empty-state";
    td.textContent = "No events recorded.";
    tr.appendChild(td);
    table.appendChild(tr);
    show("eventSummary", "No events found");
    return;
  }

  rows.slice(0, 20).forEach(row => {
    const tr = document.createElement("tr");

    [
      row.Date,
      row.Time,
      row.Event,
      row.Fingerprint,
      row.Persons,
      row.Temperature,
      row.Fire,
      row.Fan,
      row.Pump
    ].forEach(value => {
      const td = document.createElement("td");
      td.textContent = value || "—";
      tr.appendChild(td);
    });

    table.appendChild(tr);
  });

  show("eventSummary", `${rows.length} records retrieved`);
}

async function refreshDashboard() {
  if (isLoading) return;
  isLoading = true;

  try {
    const data = await jsonpRequest();

    if (!data || data.success !== true || !Array.isArray(data.rows)) {
      throw new Error("Unexpected response from Google Sheets");
    }

    updateDashboard(data.rows);

    const connection = document.querySelector(".connection");
    if (connection) {
      connection.classList.remove("disconnected");
      connection.classList.add("connected");
    }

    show("connectionText", "Google Sheets connected");
    show("lastUpdated", new Date().toLocaleTimeString());
  } catch (error) {
    console.error("Dashboard connection error:", error);
    show("connectionText", "Connection error");
    show("eventSummary", error.message);
  } finally {
    isLoading = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("refreshButton");

  if (button) {
    button.addEventListener("click", refreshDashboard);
  }

  refreshDashboard();
  setInterval(refreshDashboard, 5000);
});