document.addEventListener("DOMContentLoaded", async () => {
  const lockScreen = document.getElementById("lock-screen");
  const passInput = document.getElementById("pass-input");
  const passError = document.getElementById("pass-error");
  const unlockBtn = document.getElementById("unlock-btn");

  const settingsPanel = document.getElementById("settings-panel");
  const toggleSettingsBtn = document.getElementById("toggle-settings-btn");
  const newPassInput = document.getElementById("new-pass");
  const savePassBtn = document.getElementById("save-pass-btn");

  const searchInput = document.getElementById("search-input");
  const typeFilter = document.getElementById("type-filter");
  const historyContainer = document.getElementById("history-container");
  const clearBtn = document.getElementById("clear-btn");
  const loadMoreBtn = document.getElementById("load-more-btn");
  const themeBtn = document.getElementById("theme-btn");

  let allHistory = [];
  let filteredHistory = [];
  let currentPage = 1;
  const ITEMS_PER_PAGE = 40;

  // 1. Obtener configuración de tema y contraseña (clave por defecto: 1234)
  const config = await browser.storage.local.get(["theme", "accessPassword"]);
  let currentPassword = config.accessPassword || "1234";

  if (config.theme === "light") {
    document.body.classList.add("light-theme");
    themeBtn.textContent = "☀️ Modo Claro";
  } else {
    themeBtn.textContent = "🌙 Modo Oscuro";
  }

  // 2. Lógica de Desbloqueo
  function checkPassword() {
    if (passInput.value === currentPassword) {
      lockScreen.style.display = "none";
      passError.style.display = "none";
      loadHistory();
    } else {
      passError.style.display = "block";
      passInput.value = "";
      passInput.focus();
    }
  }

  unlockBtn.addEventListener("click", checkPassword);
  passInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") checkPassword();
  });

  // 3. Configuración de nueva clave
  toggleSettingsBtn.addEventListener("click", () => {
    const isVisible = settingsPanel.style.display === "block";
    settingsPanel.style.display = isVisible ? "none" : "block";
  });

  savePassBtn.addEventListener("click", async () => {
    const newPass = newPassInput.value.trim();
    if (newPass.length < 1) {
      alert("Por favor, introduce una clave válida.");
      return;
    }
    await browser.storage.local.set({ accessPassword: newPass });
    currentPassword = newPass;
    newPassInput.value = "";
    settingsPanel.style.display = "none";
    alert("¡Clave de acceso actualizada correctamente!");
  });

  // 4. Cargar y renderizar historial
  async function loadHistory() {
    const data = await browser.storage.local.get("customHistory");
    allHistory = data.customHistory || [];
    applyFilters();
  }

  themeBtn.addEventListener("click", async () => {
    const isLight = document.body.classList.toggle("light-theme");
    const newTheme = isLight ? "light" : "dark";
    themeBtn.textContent = isLight ? "☀️ Modo Claro" : "🌙 Modo Oscuro";
    await browser.storage.local.set({ theme: newTheme });
  });

  function applyFilters() {
    const text = searchInput.value.trim().toLowerCase();
    const filterType = typeFilter.value;

    filteredHistory = allHistory.filter(item => {
      let formMatch = false;
      if (item.formData) {
        formMatch = Object.entries(item.formData).some(([key, val]) => 
          key.toLowerCase().includes(text) || String(val).toLowerCase().includes(text)
        );
      }

      const matchesText = item.title.toLowerCase().includes(text) ||
                          item.url.toLowerCase().includes(text) ||
                          (item.searchQuery && item.searchQuery.toLowerCase().includes(text)) ||
                          formMatch;

      const matchesType = filterType === "all" || 
                         (filterType === "searches" && item.searchQuery) ||
                         (filterType === "forms" && item.formData && Object.keys(item.formData).length > 0);

      return matchesText && matchesType;
    });

    currentPage = 1;
    renderList();
  }

  function getDateLabel(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Hoy";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Ayer";
    } else {
      return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
    }
  }

  function renderList() {
    historyContainer.innerHTML = "";

    const visibleItems = filteredHistory.slice(0, currentPage * ITEMS_PER_PAGE);

    if (visibleItems.length === 0) {
      historyContainer.innerHTML = `<div class="empty-state">No se encontraron registros.</div>`;
      loadMoreBtn.style.display = "none";
      return;
    }

    const groups = {};
    visibleItems.forEach(item => {
      const label = getDateLabel(item.timestamp);
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    });

    for (const [dateLabel, items] of Object.entries(groups)) {
      const groupDiv = document.createElement("div");
      groupDiv.className = "date-group";

      const header = document.createElement("div");
      header.className = "date-header";
      header.textContent = dateLabel;
      groupDiv.appendChild(header);

      const ul = document.createElement("ul");
      ul.className = "history-list";

      items.forEach(item => {
        const li = document.createElement("li");
        li.className = "history-item";

        const timeStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let searchBadge = "";
        if (item.searchQuery) {
          searchBadge = `<span class="search-badge">🔍 Búsqueda: "${escapeHtml(item.searchQuery)}"</span>`;
        }

        let thumbHtml = `<div class="no-thumbnail">Sin captura</div>`;
        if (item.thumbnail) {
          thumbHtml = `<img src="${item.thumbnail}" class="item-thumbnail" alt="Vista previa">`;
        }

        let formDataHtml = "";
        if (item.formData && Object.keys(item.formData).length > 0) {
          const fields = Object.entries(item.formData)
            .map(([k, v]) => `<div class="form-data-item"><span class="form-data-key">${escapeHtml(k)}:</span> ${escapeHtml(v)}</div>`)
            .join("");

          formDataHtml = `
            <div class="form-data-container">
              <div class="form-data-title">📝 Datos introducidos en la página:</div>
              ${fields}
            </div>
          `;
        }

        li.innerHTML = `
          ${thumbHtml}
          <div class="item-content">
            ${searchBadge}
            <a class="item-title" href="${item.url}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a>
            <span class="item-url">${escapeHtml(item.url)}</span>
            ${formDataHtml}
            <div class="item-meta">🕒 ${timeStr}</div>
          </div>
          <div class="item-actions">
            <button class="icon-btn copy-btn" data-url="${escapeHtml(item.url)}" title="Copiar URL">📋</button>
            <button class="icon-btn delete-btn" data-id="${item.id}" title="Eliminar este registro">🗑️</button>
          </div>
        `;

        ul.appendChild(li);
      });

      groupDiv.appendChild(ul);
      historyContainer.appendChild(groupDiv);
    }

    if (visibleItems.length < filteredHistory.length) {
      loadMoreBtn.style.display = "block";
    } else {
      loadMoreBtn.style.display = "none";
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, match => {
      const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
      return map[match];
    });
  }

  historyContainer.addEventListener("click", async (e) => {
    if (e.target.classList.contains("copy-btn")) {
      const url = e.target.getAttribute("data-url");
      await navigator.clipboard.writeText(url);
      const originalText = e.target.textContent;
      e.target.textContent = "✓";
      setTimeout(() => e.target.textContent = originalText, 1200);
    }

    if (e.target.classList.contains("delete-btn")) {
      const id = e.target.getAttribute("data-id");
      allHistory = allHistory.filter(item => item.id !== id);
      await browser.storage.local.set({ customHistory: allHistory });
      applyFilters();
    }
  });

  clearBtn.addEventListener("click", async () => {
    if (confirm("¿Estás seguro de que deseas eliminar TODOS los registros guardados?")) {
      await browser.storage.local.remove("customHistory");
      allHistory = [];
      applyFilters();
    }
  });

  loadMoreBtn.addEventListener("click", () => {
    currentPage++;
    renderList();
  });

  searchInput.addEventListener("input", applyFilters);
  typeFilter.addEventListener("change", applyFilters);

  browser.storage.onChanged.addListener((changes) => {
    if (changes.customHistory) {
      allHistory = changes.customHistory.newValue || [];
      applyFilters();
    }
  });
});