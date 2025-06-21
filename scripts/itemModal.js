const ItemModal = (() => {
  const element = document.querySelector(".item-modal");
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
    iconPreview.src = URL.createObjectURL(file);
  };

  async function createItemData(item = {}) {
    const itemData = {
      id: item.id || generateId(),
      name: nameInput.value,
      type: item.type || currentItemType,
      parentId: item.parentId || currentFolder.id,
      path: item.path || [...currentFolder.path, { id: currentFolder.id, name: currentFolder.name }],
      content: contentInput.value,
      icon: iconInput.value ? await getFileDataUrl(iconInput.files[0]) : item.icon || null,
      lastModified: Date.now(),
    };
    return itemData;
  }

  function toggle(itemId, itemType) {
    const item = getItem(itemId);
    currentItemType = itemType || item?.type || "text";
    iconInput.value = "";
    iconPreview.src = item?.icon || `../images/${currentItemType}.png`;
    title.textContent = item ? `Edit ${item.name}` : `Create new ${currentItemType}`;
    nameInput.value = item ? item.name : getItemName(`New ${currentItemType}`);
    contentInput.classList.toggle("hidden", currentItemType === "folder");
    contentInput.value = item ? item.content : "";

    submitBtn.textContent = item ? "Update" : "Create";
    submitBtn.onclick = async () => {
      if (iconInput.value) {
        const file = iconInput.files[0]
        if (file.size > 5 * 1024 * 1024) {
          Toast.show("Upload failed: That file exceeds 5MB limit");
          return;
        }
      }
      const itemData = await createItemData(item || {});
      item ? updateItem(item.id, itemData) : createItem(itemData);
      toggle();
    };
    deleteBtn.classList.toggle("hidden", item == null);
    deleteBtn.onclick = item
      ? () => {
          deleteItem(item.id);
          toggle();
        }
      : () => {};

    element.classList.toggle("hidden");
  }

  function getItemName(baseName) {
    let count = 1;
    let name;
    do {
      name = `${baseName + (count > 1 ? ` (${count})` : "")}`;
      count++;
    } while (currentItems.some((item) => item.parentId === currentFolder.id && item.name === name));
    return name;
  }

  return { toggle };
})();
