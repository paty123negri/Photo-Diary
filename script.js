const $ = (selector) => document.querySelector(selector);

const STORAGE_KEY = "photo-diary-memorias-v1";
const COLLECTION_KEY = "photo-diary-colecoes-v1";
let memories = loadJSON(STORAGE_KEY, []);
let collections = loadJSON(COLLECTION_KEY, []);
let selectedImage = "";
let editingId = null;
let activeMemoryId = null;
let toastTimer;

function loadJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
    localStorage.setItem(COLLECTION_KEY, JSON.stringify(collections));
    return true;
  } catch {
    showToast("O armazenamento está cheio. Tente usar uma imagem menor.");
    return false;
  }
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3000);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function formatDate(value) {
  if (!value) return "Data não informada";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric"
  });
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function updateStats() {
  $("#photo-count").textContent = memories.filter((memory) => memory.image).length;
  $("#memory-count").textContent = memories.length;
  $("#favorite-count").textContent = memories.filter((memory) => memory.favorite).length;
}

function memoryCard(memory) {
  const image = memory.image
    ? `<img src="${memory.image}" alt="${escapeHTML(memory.title)}" loading="lazy">`
    : `<span class="no-photo" aria-hidden="true">✿</span>`;
  return `<article class="memory-card" data-open-memory="${memory.id}" tabindex="0" role="button" aria-label="Ver memória: ${escapeHTML(memory.title)}">
    <div class="polaroid">
      <div class="photo-frame">${image}</div>
      <p>${escapeHTML(memory.title)}</p>
    </div>
    <div class="card-actions">
      <button class="icon-button" type="button" data-favorite="${memory.id}" aria-label="${memory.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}">${memory.favorite ? "♥" : "♡"}</button>
      <button class="icon-button" type="button" data-delete="${memory.id}" aria-label="Excluir memória">×</button>
    </div>
    <p class="card-meta">${escapeHTML(formatDate(memory.date))}${memory.location ? ` · ${escapeHTML(memory.location)}` : ""}</p>
  </article>`;
}

function renderGrid(container, items, empty, emptyMessage) {
  container.innerHTML = items.map(memoryCard).join("");
  empty.hidden = items.length > 0;
  empty.textContent = emptyMessage;
}

function renderMemories() {
  const search = $("#search-input").value.trim().toLocaleLowerCase("pt-BR");
  const category = $("#category-filter").value;
  const sort = $("#sort-order").value;
  let filtered = memories.filter((memory) => {
    const searchable = `${memory.title} ${memory.caption} ${memory.location} ${memory.category} ${memory.collection}`.toLocaleLowerCase("pt-BR");
    return searchable.includes(search) && (category === "todas" || memory.category === category);
  });
  filtered.sort((a, b) => {
    if (sort === "antigas") return a.date.localeCompare(b.date);
    if (sort === "titulo") return a.title.localeCompare(b.title, "pt-BR");
    return b.date.localeCompare(a.date);
  });
  renderGrid($("#photo-grid"), filtered, $("#empty-state"),
    search || category !== "todas" ? "Nenhuma memória encontrada com esses filtros." : "Ainda não há memórias por aqui. Que tal guardar a primeira? ♡");

  const timeline = [...memories].sort((a, b) => b.date.localeCompare(a.date));
  $("#timeline-list").innerHTML = timeline.map((memory) => `
    <article class="timeline-item">
      <div class="timeline-date">${escapeHTML(formatDate(memory.date))}</div>
      <div class="timeline-entry" data-open-memory="${memory.id}" tabindex="0" role="button">
        ${memory.image ? `<img class="timeline-thumb" src="${memory.image}" alt="">` : `<div class="timeline-thumb" aria-hidden="true"></div>`}
        <div><h3>${escapeHTML(memory.title)}</h3><p>${escapeHTML(memory.location || memory.category || "Uma lembrança especial")}</p></div>
      </div>
    </article>`).join("");
  $("#timeline-empty").hidden = timeline.length > 0;

  const favorites = memories.filter((memory) => memory.favorite);
  renderGrid($("#favorites-grid"), favorites, $("#favorites-empty"), "Você ainda não favoritou nenhuma memória.");
  updateStats();
  renderCollectionSelect();
}

function renderCollections() {
  const container = $("#collection-grid");
  container.innerHTML = collections.map((name) => {
    const count = memories.filter((memory) => memory.collection === name).length;
    return `<article class="collection-card"><div><strong>${escapeHTML(name)}</strong><p>${count} ${count === 1 ? "memória" : "memórias"}</p></div><button type="button" data-remove-collection="${escapeHTML(name)}" aria-label="Excluir coleção ${escapeHTML(name)}">×</button></article>`;
  }).join("");
  $("#collection-empty").hidden = collections.length > 0;
  renderCollectionSelect();
}

function renderCollectionSelect() {
  const select = $("#memory-collection");
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Sem coleção</option>' + collections.map((name) =>
    `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`).join("");
  if (collections.includes(current)) select.value = current;
}

function resetForm() {
  $("#memory-form").reset();
  selectedImage = "";
  editingId = null;
  $("#image-preview").hidden = true;
  $("#image-preview").removeAttribute("src");
  $("#remove-preview").hidden = true;
  $("#form-title").textContent = "Nova memória";
  $("#save-memory-button").textContent = "Guardar memória";
  $("#memory-date").value = todayISO();
  $("#form-message").textContent = "";
}

function openMemory(id) {
  const memory = memories.find((item) => item.id === id);
  if (!memory) return;
  activeMemoryId = id;
  $("#dialog-content").innerHTML = `
    ${memory.image ? `<img class="dialog-photo" src="${memory.image}" alt="${escapeHTML(memory.title)}">` : ""}
    <h2 class="dialog-title">${escapeHTML(memory.title)}</h2>
    <p class="muted">${escapeHTML(formatDate(memory.date))}${memory.location ? ` · ${escapeHTML(memory.location)}` : ""}</p>
    <p class="muted">${escapeHTML(memory.category || "Outros")}${memory.collection ? ` · Coleção: ${escapeHTML(memory.collection)}` : ""}</p>
    <p class="dialog-caption">${escapeHTML(memory.caption || "Nenhuma legenda foi adicionada.")}</p>
    <div class="dialog-buttons">
      <button class="button" type="button" data-edit="${memory.id}">Editar memória</button>
      <button class="button button-quiet" type="button" data-favorite="${memory.id}">${memory.favorite ? "♥ Remover dos favoritos" : "♡ Adicionar aos favoritos"}</button>
      <button class="button button-quiet" type="button" data-delete="${memory.id}">Excluir</button>
    </div>`;
  $("#memory-dialog").showModal();
}

function editMemory(id) {
  const memory = memories.find((item) => item.id === id);
  if (!memory) return;
  editingId = id;
  selectedImage = memory.image || "";
  $("#memory-title").value = memory.title;
  $("#memory-caption").value = memory.caption || "";
  $("#memory-date").value = memory.date || todayISO();
  $("#memory-location").value = memory.location || "";
  $("#memory-category").value = memory.category || "Outros";
  renderCollectionSelect();
  $("#memory-collection").value = memory.collection || "";
  $("#memory-favorite").checked = Boolean(memory.favorite);
  if (selectedImage) {
    $("#image-preview").src = selectedImage;
    $("#image-preview").hidden = false;
    $("#remove-preview").hidden = false;
  } else {
    $("#image-preview").hidden = true;
    $("#remove-preview").hidden = true;
  }
  $("#form-title").textContent = "Editar memória";
  $("#save-memory-button").textContent = "Salvar alterações";
  $("#memory-dialog").close();
  $("#nova-memoria").scrollIntoView({ behavior: "smooth" });
}

function deleteMemory(id) {
  const memory = memories.find((item) => item.id === id);
  if (!memory) return;
  if (!confirm(`Deseja mesmo excluir a memória "${memory.title}"? Essa ação não pode ser desfeita.`)) return;
  memories = memories.filter((item) => item.id !== id);
  saveData();
  renderMemories();
  renderCollections();
  if ($("#memory-dialog").open) $("#memory-dialog").close();
  showToast("Memória excluída.");
}

$("#menu-toggle").addEventListener("click", () => {
  const isOpen = $("#main-nav").classList.toggle("open");
  $("#menu-toggle").setAttribute("aria-expanded", String(isOpen));
  $("#menu-toggle").setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
  $("#menu-toggle").textContent = isOpen ? "×" : "☰";
});
$("#main-nav").addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    $("#main-nav").classList.remove("open");
    $("#menu-toggle").setAttribute("aria-expanded", "false");
    $("#menu-toggle").setAttribute("aria-label", "Abrir menu");
    $("#menu-toggle").textContent = "☰";
  }
});

function loadTheme() {
  const isDark = localStorage.getItem("photo-diary-theme") === "dark";
  document.body.classList.toggle("dark-theme", isDark);
  $("#theme-toggle").textContent = isDark ? "☀ Ativar modo claro" : "☾ Ativar modo escuro";
  $("#theme-toggle").setAttribute("aria-pressed", String(isDark));
}
$("#theme-toggle").addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark-theme");
  localStorage.setItem("photo-diary-theme", isDark ? "dark" : "light");
  loadTheme();
  showToast(isDark ? "Tema escuro ativado." : "Tema claro ativado.");
});

$("#memory-image").addEventListener("change", () => {
  const file = $("#memory-image").files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    $("#memory-image").value = "";
    showToast("Escolha um arquivo de imagem válido.");
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    $("#memory-image").value = "";
    showToast("Escolha uma imagem de até 2 MB para evitar lotar o armazenamento.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    selectedImage = reader.result;
    $("#image-preview").src = selectedImage;
    $("#image-preview").hidden = false;
    $("#remove-preview").hidden = false;
  };
  reader.readAsDataURL(file);
});

$("#remove-preview").addEventListener("click", () => {
  selectedImage = "";
  $("#memory-image").value = "";
  $("#image-preview").removeAttribute("src");
  $("#image-preview").hidden = true;
  $("#remove-preview").hidden = true;
  showToast("Fotografia removida.");
});

$("#memory-form").addEventListener("reset", () => {
  setTimeout(resetForm, 0);
});

$("#memory-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const title = $("#memory-title").value.trim();
  const date = $("#memory-date").value;
  if (!title || !date) {
    $("#form-message").textContent = "Preencha o título e a data da memória.";
    return;
  }
  const oldMemory = memories.find((item) => item.id === editingId);
  const memory = {
    id: editingId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    title,
    caption: $("#memory-caption").value.trim(),
    date,
    location: $("#memory-location").value.trim(),
    category: $("#memory-category").value,
    collection: $("#memory-collection").value,
    favorite: $("#memory-favorite").checked,
    image: selectedImage || "",
    createdAt: oldMemory?.createdAt || new Date().toISOString()
  };
  const oldMemories = [...memories];
  if (editingId) memories = memories.map((item) => item.id === editingId ? memory : item);
  else memories.push(memory);
  if (!saveData()) {
    memories = oldMemories;
    return;
  }
  renderMemories();
  renderCollections();
  resetForm();
  showToast(editingId ? "Alterações salvas!" : "Memória guardada com carinho!");
  $("#diario").scrollIntoView({ behavior: "smooth" });
});

$("#search-input").addEventListener("input", renderMemories);
$("#category-filter").addEventListener("change", renderMemories);
$("#sort-order").addEventListener("change", renderMemories);

document.addEventListener("click", (event) => {
  const favoriteButton = event.target.closest("[data-favorite]");
  if (favoriteButton) {
    event.stopPropagation();
    const id = favoriteButton.dataset.favorite;
    memories = memories.map((memory) => memory.id === id ? { ...memory, favorite: !memory.favorite } : memory);
    saveData();
    renderMemories();
    renderCollections();
    if ($("#memory-dialog").open) openMemory(id);
    showToast(memories.find((memory) => memory.id === id)?.favorite ? "Adicionada aos favoritos." : "Removida dos favoritos.");
    return;
  }
  const deleteButton = event.target.closest("[data-delete]");
  if (deleteButton) {
    event.stopPropagation();
    deleteMemory(deleteButton.dataset.delete);
    return;
  }
  const editButton = event.target.closest("[data-edit]");
  if (editButton) {
    editMemory(editButton.dataset.edit);
    return;
  }
  const card = event.target.closest("[data-open-memory]");
  if (card) openMemory(card.dataset.openMemory);
  const removeCollection = event.target.closest("[data-remove-collection]");
  if (removeCollection) {
    const name = removeCollection.dataset.removeCollection;
    if (!confirm(`Excluir a coleção "${name}"? As memórias continuarão no diário, mas ficarão sem essa coleção.`)) return;
    collections = collections.filter((item) => item !== name);
    memories = memories.map((memory) => memory.collection === name ? { ...memory, collection: "" } : memory);
    saveData();
    renderCollections();
    renderMemories();
    showToast("Coleção excluída.");
  }
});

document.addEventListener("keydown", (event) => {
  const card = event.target.closest?.("[data-open-memory]");
  if (card && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    openMemory(card.dataset.openMemory);
  }
});
$("#close-dialog").addEventListener("click", () => $("#memory-dialog").close());
$("#memory-dialog").addEventListener("click", (event) => {
  if (event.target === $("#memory-dialog")) $("#memory-dialog").close();
});

$("#collection-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = $("#collection-name");
  const name = input.value.trim();
  if (!name) return;
  if (collections.some((item) => item.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) {
    showToast("Essa coleção já existe.");
    return;
  }
  collections.push(name);
  if (!saveData()) {
    collections.pop();
    return;
  }
  input.value = "";
  renderCollections();
  showToast("Coleção criada!");
});

$("#export-data").addEventListener("click", () => {
  const backup = { app: "Photo Diary", version: 1, exportedAt: new Date().toISOString(), memories, collections };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "photo-diary-backup.json";
  link.click();
  URL.revokeObjectURL(url);
  $("#settings-message").textContent = "Backup exportado. Guarde o arquivo em um lugar seguro.";
});

$("#import-data").addEventListener("change", async () => {
  const file = $("#import-data").files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.memories) || !Array.isArray(data.collections)) {
      throw new Error("Formato inválido");
    }
    if (!confirm("A importação substituirá as memórias e coleções atuais. Deseja continuar? Exporte um backup antes, se necessário.")) return;
    const previousMemories = memories;
    const previousCollections = collections;
    memories = data.memories;
    collections = data.collections.filter((name) => typeof name === "string");
    if (!saveData()) {
      memories = previousMemories;
      collections = previousCollections;
      return;
    }
    renderMemories();
    renderCollections();
    $("#settings-message").textContent = "Dados importados com sucesso.";
    showToast("Backup importado!");
  } catch {
    $("#settings-message").textContent = "Não foi possível importar. Selecione um backup JSON válido do Photo Diary.";
  } finally {
    $("#import-data").value = "";
  }
});

$("#memory-date").value = todayISO();
loadTheme();
renderMemories();
renderCollections();
