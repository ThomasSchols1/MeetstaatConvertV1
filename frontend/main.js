const requiredColumns = ["project", "item", "quantity", "unit"];
let latestRows = [];

function validateRow(row) {
  const missing = requiredColumns.filter((column) => !(column in row) || row[column] === "" || row[column] == null);
  if (missing.length) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }

  const quantity = Number(row.quantity);
  if (Number.isNaN(quantity)) {
    throw new Error("quantity must be numeric");
  }
  if (quantity < 0) {
    throw new Error("quantity must be >= 0");
  }
}

function convertRows(rows) {
  return rows.map((row, index) => {
    try {
      validateRow(row);
    } catch (error) {
      throw new Error(`Row ${index + 1}: ${error.message}`);
    }

    return {
      project_code: String(row.project).trim().toUpperCase(),
      description: String(row.item).trim(),
      quantity: Number(row.quantity),
      uom: String(row.unit).trim().toLowerCase(),
    };
  });
}

const inputElement = document.getElementById("input");
const outputElement = document.getElementById("output");
const statusElement = document.getElementById("status");
const anchorSelectElement = document.getElementById("anchorSelect");
const confirmAnchorButton = document.getElementById("confirmAnchorBtn");
const treeViewContainer = document.getElementById("treeViewContainer");
const treeRootElement = document.getElementById("treeRoot");

function setStatus(message, isError = false) {
  statusElement.className = isError ? "error" : "ok";
  statusElement.textContent = message;
}

function populateAnchorOptions(rows) {
  anchorSelectElement.innerHTML = "";
  rows.forEach((row, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${index + 1}) ${row.item}`;
    anchorSelectElement.appendChild(option);
  });
}

function renderTreeView(anchorIndex) {
  treeRootElement.innerHTML = "";

  const anchorRow = latestRows[anchorIndex];
  const rootNode = document.createElement("li");
  rootNode.textContent = `${anchorIndex + 1}) ${anchorRow.item}`;

  const children = latestRows.slice(anchorIndex + 1);
  if (children.length > 0) {
    const childList = document.createElement("ul");
    children.forEach((row, index) => {
      const childItem = document.createElement("li");
      childItem.textContent = `${anchorIndex + index + 2}) ${row.item}`;
      childList.appendChild(childItem);
    });
    rootNode.appendChild(childList);
  }

  treeRootElement.appendChild(rootNode);
  treeViewContainer.classList.remove("hidden");
}

document.getElementById("convertBtn").addEventListener("click", () => {
  try {
    const parsed = JSON.parse(inputElement.value);
    if (!Array.isArray(parsed)) {
      throw new Error("Input must be a JSON array of rows");
    }

    const converted = convertRows(parsed);
    latestRows = parsed;
    populateAnchorOptions(parsed);
    treeViewContainer.classList.add("hidden");

    outputElement.textContent = JSON.stringify(converted, null, 2);
    setStatus(`Converted ${converted.length} row(s) successfully. Kies nu een ankerregel.`);
  } catch (error) {
    outputElement.textContent = "";
    treeViewContainer.classList.add("hidden");
    setStatus(error.message, true);
  }
});

confirmAnchorButton.addEventListener("click", () => {
  if (latestRows.length === 0) {
    setStatus("Geen data geladen. Klik eerst op Convert.", true);
    return;
  }

  const selectedIndex = Number(anchorSelectElement.value);
  renderTreeView(selectedIndex);
  setStatus(`Anker bevestigd op regel ${selectedIndex + 1}. Treeview geladen.`);
});

document.getElementById("convertBtn").click();
