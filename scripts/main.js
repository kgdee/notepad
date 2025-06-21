const header = document.querySelector("body .header");
const itemContainer = document.querySelector(".item-container");
const breadcrumbs = document.querySelector(".breadcrumbs");

const rootFolder = { id: null, name: "Root", path: [] };
let currentItems = null
let currentFolder = rootFolder;
let darkTheme = load("darkTheme", false)
let selectedItem = null;
let shouldSortByName = load("shouldSortByName", false)

document.addEventListener("DOMContentLoaded", async function () {
  currentItems = await DB.getItems("currentItems") || []
  displayItems();
  displayBreadcrumbs();
  toggleTheme(darkTheme);
});

function getItem(itemId) {
  return currentItems.filter((item) => item.id === itemId)[0];
}

function createItem(itemData) {
  if (!itemData.name) return;

  currentItems.push(itemData);
  DB.addItem("currentItems", itemData)

  selectedItem = itemData.id
  displayItems();
  Toast.show("Item has been successfully created");
}

function updateItem(itemId, updates) {
  if (!updates.name) return;
  const item = getItem(itemId);
  if (item.icon === updates.icon && item.name === updates.name && item.content === updates.content) {
    Toast.show("No update performed. There's nothing to update");
    return
  }
  const updatedItem = { ...item, ...updates };

  currentItems = currentItems.map((item) => (item.id === itemId ? updatedItem : item));
  DB.putItem("currentItems", updatedItem)
  displayItems();
  Toast.show("Item has been successfully updated");
}

function deleteItem(itemId = selectedItem) {
  if (!itemId) return;
  currentItems = currentItems.filter((item) => !(item.id === itemId || item.path.some((item) => item.id === itemId)));
  deselectItem();
  DB.deleteItem("currentItems", itemId)
  displayItems();
  Toast.show("Item has been successfully deleted");
}

function sortItems(items) {
  if (shouldSortByName) items.sort((a, b) => a.name.localeCompare(b.name));
  else items.sort((a, b) => b.lastModified - a.lastModified);

  const sortedItems = [...items.filter((item) => item.type === "folder"), ...items.filter((item) => item.type === "text")];

  return sortedItems;
}

function toggleSort() {
  shouldSortByName = !shouldSortByName
  save("shouldSortByName", shouldSortByName)
  displayItems()
}

function displayItems(items) {
  if (!items) items = currentItems.filter((item) => item.parentId === currentFolder.id);

  items = sortItems(items);
  itemContainer.innerHTML =
    items
      .map(
        (item) =>
          `
            <div class="item ${item.type} ${selectedItem === item.id ? "selected" : ""}" data-id="${item.id}" onclick="handleItem('${item.id}')">
              <img src="${item.icon || `images/${item.type}.png`}">
              <p>${item.name}</p>
            </div>
          `
      )
      .join("") || `<span class="message">No items found</span>`;
}

function handleItem(itemId) {
  if (selectedItem === itemId) {
    const item = getItem(itemId);
    item.type === "folder" ? openFolder(item.id) : ItemModal.toggle(item.id);
  } else {
    selectItem(itemId);
  }
}

function selectItem(itemId) {
  deselectItem();
  selectedItem = itemId;
  document.querySelector(`[data-id="${selectedItem}"]`).classList.add("selected");
}

function deselectItem() {
  if (!selectedItem) return;
  document.querySelector(`[data-id="${selectedItem}"]`).classList.remove("selected");
  selectedItem = null;
}

function editItem() {
  if (!selectedItem) return;
  ItemModal.toggle(selectedItem);
}

function openFolder(ref) {
  deselectItem();
  if (Number.isFinite(ref)) {
    currentFolder = currentItems[ref];
  } else if (typeof ref === "string") {
    currentFolder = currentItems.filter((item) => item.id === ref)[0];
  }
  if (!currentFolder) currentFolder = rootFolder;
  displayItems();
  displayBreadcrumbs();
}

function toggleTheme(force = undefined) {
  const toggle = document.querySelector(".theme-toggle");
  force === undefined ? (darkTheme = !darkTheme) : (darkTheme = force);
  save("darkTheme", darkTheme)
  document.body.classList.toggle("dark-theme", darkTheme);
  toggle.innerHTML = darkTheme ? `<i class="bi bi-sun"></i>` : `<i class="bi bi-moon"></i>`;
}

function displayBreadcrumbs() {
  breadcrumbs.innerHTML = "";
  breadcrumbs.innerHTML += currentFolder.path
    .map(
      (route) => `
            <button onclick="openFolder('${route.id}')">${route.name}</button> /
          `
    )
    .join("");
  breadcrumbs.innerHTML += `<button>${currentFolder.name}</button>`;
  breadcrumbs.scrollLeft = breadcrumbs.scrollWidth;
}

async function upload(file) {
  if (!file.type.startsWith("text/")) {
    Toast.show("Upload failed. Only text files are Allowed");
    return;
  }

  const itemData = {
    id: generateId(),
    name: getFileName(file),
    type: "text",
    parentId: currentFolder.id,
    path: [...currentFolder.path, { id: currentFolder.id, name: currentFolder.name }],
    content: await getFileText(file),
    icon: null,
  };

  createItem(itemData);
}

async function download() {
  if (!selectedItem) return;

  const item = getItem(selectedItem);
  if (item.type !== "text") return;

  const blob = new Blob([item.content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${item.name}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
