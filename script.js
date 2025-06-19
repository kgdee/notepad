const projectName = "notepad";
const itemContainer = document.querySelector(".item-container");
const searchBox = document.querySelector(".search-box");
const breadcrumbs = document.querySelector(".breadcrumbs");

const rootFolder = { id: null, name: "Root", path: [] };
let currentItems = JSON.parse(localStorage.getItem(`${projectName}_items`)) || [];
let currentFolder = rootFolder;
let darkTheme = JSON.parse(localStorage.getItem(`${projectName}_darkTheme`)) || false;
let selectedItem = null;

document.addEventListener("DOMContentLoaded", function () {
  displayItems();
  displayBreadcrumbs();
  toggleTheme(darkTheme);
});

window.addEventListener("error", (event) => {
  const error = `${event.type}: ${event.message}`;
  console.error(error);
  alert(error);
});

function stopPropagation(event) {
  event.stopPropagation();
}

function getFileDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

function getFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
}

function getItem(itemId) {
  return currentItems.filter((item) => item.id === itemId)[0];
}

function createItem(itemData) {
  if (!itemData.name) return;

  currentItems.push(itemData);
  localStorage.setItem(`${projectName}_items`, JSON.stringify(currentItems));

  displayItems();
  Toast.show("Item has been successfully created");
}

function updateItem(itemId, updates) {
  if (!updates.name) return;
  const item = getItem(itemId);
  const updatedItem = { ...item, ...updates };
  if (Object.keys(updates).every((key) => updates[key] === item[key])) return Toast.show("Cannot update. There's nothing to update");

  currentItems = currentItems.map((item) => (item.id === itemId ? updatedItem : item));

  localStorage.setItem(`${projectName}_items`, JSON.stringify(currentItems));
  displayItems();
  Toast.show("Item has been successfully updated");
}

function deleteItem(itemId = selectedItem) {
  if (!itemId) return;
  currentItems = currentItems.filter((item) => !(item.id === itemId || item.path.some((item) => item.id === itemId)));
  deselectItem();
  localStorage.setItem(`${projectName}_items`, JSON.stringify(currentItems));
  displayItems();
  Toast.show("Item has been successfully deleted");
}

function displayItems(items) {
  if (!items) items = currentItems.filter((item) => item.parentId === currentFolder.id);
  itemContainer.innerHTML =
    items
      .map(
        (item) =>
          `
            <div class="item ${item.type}" data-id="${item.id}" onclick="handleItem('${item.id}')">
              <img src="${item.icon || `${item.type}.png`}">
              <p class="item-text truncated">${item.name}</p>
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

const ItemModal = (() => {
  const element = document.querySelector(".text-modal");
  const title = element.querySelector(".title");
  const nameInput = element.querySelector(".name-input");
  const contentInput = element.querySelector(".content-input");
  const iconInput = element.querySelector(".icon-input input");
  const iconPreview = element.querySelector(".icon-input img");
  const submitBtn = element.querySelector(".submit");
  const deleteBtn = element.querySelector(".delete");
  let currentItemType = "text";

  iconInput.oninput = (event) => {
    const file = event.target.files[0];

    if (!isFileSizeAllowed(file)) {
      Toast.show("That file is too large. Please select a file smaller than 5MB.");
      event.target.value = "";
      return;
    }

    iconPreview.src = URL.createObjectURL(event.target.files[0])
  };

  async function createItemData(item = {}) {
    const itemData = {
      id: item.id || crypto.randomUUID(),
      name: nameInput.value || item.name,
      type: item.type || currentItemType,
      parentId: item.parentId || currentFolder.id,
      path: item.path || [...currentFolder.path, { id: currentFolder.id, name: currentFolder.name }],
      content: contentInput.value || item.content,
      icon: iconInput.value ? await getFileDataUrl(iconInput.files[0]) : item.icon || null,
    };
    return itemData;
  }

  function toggle(itemId, itemType) {
    const item = getItem(itemId);
    currentItemType = itemType || item?.type || "text";
    iconInput.value = "";
    iconPreview.src = item?.icon || `${currentItemType}.png`;
    title.textContent = item ? `Edit ${item.name}` : `Create new ${currentItemType}`;
    nameInput.value = item ? item.name : `New ${currentItemType}`;
    contentInput.classList.toggle("hidden", currentItemType === "folder");
    contentInput.value = item ? item.content : "";

    submitBtn.textContent = item ? "Update" : "Create";
    submitBtn.onclick = item
      ? async () => {
          updateItem(item.id, await createItemData(item));
          toggle();
        }
      : async () => {
          createItem(await createItemData());
          toggle();
        };
    deleteBtn.classList.toggle("hidden", item == null);
    deleteBtn.onclick = item ? () => {
      deleteItem(item.id)
      toggle()
    } : () => {};

    element.classList.toggle("hidden");
  }

  return { toggle };
})();

function toggleTheme(force = undefined) {
  const toggle = document.querySelector(".theme-toggle");
  force === undefined ? (darkTheme = !darkTheme) : (darkTheme = force);
  localStorage.setItem(`${projectName}_darkTheme`, darkTheme);
  document.body.classList.toggle("dark-theme", darkTheme);
  toggle.innerHTML = darkTheme ? `<i class="bi bi-sun"></i>` : `<i class="bi bi-moon"></i>`;
}

const Toast = (() => {
  const container = document.querySelector(".toast-container");
  let currentItems = [];

  function show(message) {
    if (!message) return;
    const item = crypto.randomUUID();
    currentItems.push(item);
    container.innerHTML += `
      <div class="toast" data-toast="${item}">
        ${message}
      </div>
    `;
    container.classList.remove("hidden");

    setTimeout(() => {
      const itemEl = container.querySelector(`[data-toast="${item}"]`);
      itemEl.remove();
      const itemToRemove = item;
      currentItems = currentItems.filter((item) => item !== itemToRemove);
      if (currentItems.length <= 0) container.classList.add("hidden");
    }, 3000);
  }

  return { show };
})();

function search(terms) {
  const items = currentItems.filter((item) => item.parentId === currentFolder.id);
  const query = terms.trim().toLowerCase();
  const filteredItems = query ? items.filter((item) => item.name.toLowerCase().includes(query)) : null;
  displayItems(filteredItems);
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
  const itemData = {
    id: crypto.randomUUID(),
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
  const blob = new Blob([item.content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${item.name}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function isFileSizeAllowed(file) {
  const maxSize = 5 * 1024 * 1024; // 5 MB in bytes
  return file.size > maxSize ? false : true;
}

function getFileName(file) {
  return decodeURIComponent(file.name).split("/").pop().split(".").slice(0, -1).join(".");
}
