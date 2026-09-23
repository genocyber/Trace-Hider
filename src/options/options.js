let allHistory = [];
let filteredHistory = [];
let currentPage = 1;
const itemsPerPage = 30;
let currentPassword = "1234";

async function loadSettings() {
  try {
    const data = await browser.storage.local.get(["accessPassword", "retentionTTL"]);
    if (data.accessPassword) currentPassword = data.accessPassword;
    else await browser.storage.local.set({ accessPassword: "1234" });

    if (data.retentionTTL) {
      document.getElementById("ttl-select").value = data.retentionTTL;
      await applyTTL(data.retentionTTL);
    }
  } catch (e) {
    console.error("Error al cargar la configuración:", e);
  }
}

async function updateStorageMeter() {
  const storageInfo = document.getElementById("storage-info");
  const storageBar = document.getElementById("storage-bar");
  if (!storageInfo || !storageBar) return;

  try {
    let bytesUsed = 0;
    if (browser.storage.local.getBytesInUse) {
      bytesUsed = await browser.storage.local.getBytesInUse(null);
    } else {
      const data = await browser.storage.local.get(null);
      bytesUsed = new TextEncoder().encode(JSON.stringify(data)).length;
    }

    const kbUsed = (bytesUsed / 1024).toFixed(2);
    const mbUsed = (bytesUsed / (1024 * 1024)).toFixed(2);
    
    let displayText = `${kbUsed} KB`;
    if (bytesUsed > 1024 * 1024) {
      displayText = `${mbUsed} MB`;
    }

    const estimatedQuotaBytes = 10 * 1024 * 1024; 
    let percentage = Math.round((bytesUsed / estimatedQuotaBytes) * 100);
    if (percentage > 100) percentage = 100;
    if (percentage < 2 && bytesUsed > 0) percentage = 2;

    storageBar.style.width = `${percentage}%`;

    // Sugerencia aplicada: Alerta visual si supera el 80% de capacidad estimada
    if (percentage >= 80) {
      storageInfo.textContent = `¡Alerta! Ocupado: ${displayText} (${percentage}%)`;
      storageInfo.classList.add("warning");
      storageBar.classList.add("warning");
    } else {
      storageInfo.textContent = `Ocupado: ${displayText} (Local)`;
      storageInfo.classList.remove("warning");
      storageBar.classList.remove("warning");
    }

  } catch (e) {
    storageInfo.textContent = "No se pudo calcular el espacio.";
  }
}

async function applyTTL(days) {
  if (days <= 0) return;
  const limitTime = Date.now() - (days * 24 * 60 * 60 * 1000);
  const data = await browser.storage.local.get("customHistory");
  if (Array.isArray(data.customHistory)) {
    const validHistory = data.customHistory.filter(item => item && (item.pinned || item.timestamp >= limitTime));
    if (validHistory.length !== data.customHistory.length) {
      await browser.storage.local.set({ customHistory: validHistory });
    }
  }
}

async function getStoredHistory() {
  try {
    const data = await browser.storage.local.get("customHistory");
    return Array.isArray(data.customHistory) ? data.customHistory : [];
  } catch (e) {
    return [];
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function getTimelineCategory(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  
  if (date.toDateString() === today.toDateString()) {
    return "Hoy";
  }
  
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Ayer";
  }
  
  return date.toLocaleDateString("es-ES", { year: 'numeric', month: 'long', day: 'numeric' });
}

function renderHistoryPage() {
  const container = document.getElementById("history-container");
  if (!container) return;
  container.innerHTML = "";

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageItems = filteredHistory.slice(startIndex, endIndex);

  if (pageItems.length === 0) {
    container.innerHTML = `<p class="empty-msg">No hay registros que mostrar.</p>`;
    renderPaginationControls();
    return;
  }

  const fragment = document.createDocumentFragment();
  let lastCategory = "";

  pageItems.forEach(item => {
    const currentCategory = getTimelineCategory(item.timestamp);
    if (currentCategory !== lastCategory) {
      const timelineHeader = document.createElement("div");
      timelineHeader.className = "timeline-header";
      timelineHeader.textContent = currentCategory;
      fragment.appendChild(timelineHeader);
      lastCategory = currentCategory;
    }

    const card = document.createElement("div");
    card.className = `history-card ${item.pinned ? 'pinned' : ''}`;
    
    let formDataText = "";
    if (item.formData && typeof item.formData === "object" && Object.keys(item.formData).length > 0) {
      const summary = Object.entries(item.formData).map(([k, v]) => `${k}: ${v}`).join(" | ");
      formDataText = `<span class="card-form">Formulario: ${escapeHtml(summary)}</span>`;
    }

    card.innerHTML = `
      <div class="card-thumb">
        ${item.thumbnail ? `<img src="${item.thumbnail}" alt="Miniatura">` : `<div class="no-thumb">Sin captura</div>`}
      </div>
      <div class="card-info">
        <h3><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title || item.url)}</a></h3>
        <span class="card-url">${escapeHtml(item.url)}</span>
        <span class="card-date">${new Date(item.timestamp).toLocaleTimeString()}</span>
        ${item.searchQuery ? `<span class="card-query">Búsqueda: <strong>${escapeHtml(item.searchQuery)}</strong></span>` : ''}
        ${formDataText}
      </div>
      <div class="card-actions">
        <button class="btn-pin ${item.pinned ? 'pinned' : ''}" data-id="${item.timestamp}">${item.pinned ? '📌 Fijado' : '📍 Fijar'}</button>
        <button class="btn-delete-row" data-id="${item.timestamp}">🗑️ Borrar</button>
      </div>
    `;
    fragment.appendChild(card);
  });

  container.appendChild(fragment);
  attachRowListeners();
  renderPaginationControls();
}

function attachRowListeners() {
  document.querySelectorAll(".btn-pin").forEach(button => {
    button.addEventListener("click", async (e) => {
      const id = Number(e.target.getAttribute("data-id"));
      const item = allHistory.find(h => h.timestamp === id);
      if (item) {
        item.pinned = !item.pinned;
        await browser.storage.local.set({ customHistory: allHistory });
        applyFilters();
        updateStorageMeter();
      }
    });
  });

  document.querySelectorAll(".btn-delete-row").forEach(button => {
    button.addEventListener("click", async (e) => {
      const id = Number(e.target.getAttribute("data-id"));
      const item = allHistory.find(h => h.timestamp === id);
      if (item && item.pinned) {
        if (!confirm("Este registro está fijado. ¿Deseas desanclarlo y borrarlo de todos modos?")) {
          return;
        }
      }
      
      allHistory = allHistory.filter(h => h.timestamp !== id);
      await browser.storage.local.set({ customHistory: allHistory });
      applyFilters();
      updateStorageMeter();
    });
  });
}

function renderPaginationControls() {
  let paginationContainer = document.getElementById("pagination-controls");
  if (!paginationContainer) {
    paginationContainer = document.createElement("div");
    paginationContainer.id = "pagination-controls";
    const container = document.getElementById("history-container");
    if (container) container.after(paginationContainer);
  }

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;

  paginationContainer.innerHTML = `
    <button id="prev-page" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>
    <span>Página ${currentPage} de ${totalPages}</span>
    <button id="next-page" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente</button>
  `;

  document.getElementById("prev-page")?.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderHistoryPage();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  document.getElementById("next-page")?.addEventListener("click", () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderHistoryPage();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

function applyFilters() {
  const searchInput = document.getElementById("search-filter");
  const query = searchInput ? searchInput.value.toLowerCase() : "";

  filteredHistory = allHistory.filter(item => {
    if (!item) return false;
    const titleMatch = (item.title || "").toLowerCase().includes(query);
    const urlMatch = (item.url || "").toLowerCase().includes(query);
    const searchMatch = (item.searchQuery || "").toLowerCase().includes(query);
    const formMatch = item.formData ? JSON.stringify(item.formData).toLowerCase().includes(query) : false;
    return titleMatch || urlMatch || searchMatch || formMatch;
  });

  currentPage = 1;
  renderHistoryPage();
}

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptData(data, password) {
  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv }, key, enc.encode(JSON.stringify(data))
  );
  
  const packageBuffer = new Uint8Array(salt.byteLength + iv.byteLength + encrypted.byteLength);
  packageBuffer.set(salt, 0);
  packageBuffer.set(iv, salt.byteLength);
  packageBuffer.set(new Uint8Array(encrypted), salt.byteLength + iv.byteLength);
  return packageBuffer;
}

async function decryptData(fileBuffer, password) {
  const dataView = new Uint8Array(fileBuffer);
  const salt = dataView.slice(0, 16);
  const iv = dataView.slice(16, 28);
  const encrypted = dataView.slice(28);
  const key = await deriveKey(password, salt);
  
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv }, key, encrypted
  );
  const dec = new TextDecoder();
  return JSON.parse(dec.decode(decrypted));
}

function validateImportedHistory(data) {
  if (!Array.isArray(data)) return false;
  return data.every(item => 
    item && typeof item === 'object' &&
    typeof item.url === 'string' &&
    typeof item.timestamp === 'number'
  );
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  await updateStorageMeter();

  const lockScreen = document.getElementById("lock-screen");
  const mainContent = document.getElementById("main-content");
  const accessButton = document.getElementById("btn-acceder");
  const passwordInput = document.getElementById("input-password");

  if (accessButton && passwordInput && lockScreen && mainContent) {
    const handleLogin = () => {
      if (passwordInput.value === currentPassword) {
        lockScreen.style.display = "none";
        mainContent.style.display = "block";
      } else {
        alert("Clave incorrecta.");
        passwordInput.value = "";
      }
    };

    accessButton.addEventListener("click", handleLogin);
    passwordInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") handleLogin();
    });
  }

  document.getElementById("btn-refresh-storage")?.addEventListener("click", updateStorageMeter);

  document.getElementById("btn-save-password")?.addEventListener("click", async () => {
    const newPass = document.getElementById("new-password").value;
    if (!newPass || newPass.trim() === "") {
      alert("Introduce una contraseña válida.");
      return;
    }
    await browser.storage.local.set({ accessPassword: newPass });
    currentPassword = newPass;
    document.getElementById("new-password").value = "";
    alert("¡Contraseña actualizada con éxito!");
  });

  document.getElementById("btn-save-ttl")?.addEventListener("click", async () => {
    const ttlValue = document.getElementById("ttl-select").value;
    await browser.storage.local.set({ retentionTTL: ttlValue });
    await applyTTL(parseInt(ttlValue, 10));
    allHistory = await getStoredHistory();
    applyFilters();
    updateStorageMeter();
    alert("¡Configuración de retención guardada!");
  });

  document.getElementById("btn-export")?.addEventListener("click", async () => {
    try {
      const encryptedBuffer = await encryptData(allHistory, currentPassword);
      const blob = new Blob([encryptedBuffer], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement("a");
      downloadAnchor.href = url;
      downloadAnchor.download = `trace_hider_backup_${Date.now()}.enc`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Error al cifrar el respaldo: " + e.message);
    }
  });

  const fileInput = document.getElementById("import-file-input");
  document.getElementById("btn-import")?.addEventListener("click", () => fileInput.click());
  fileInput?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      let importedHistory = [];
      try {
        importedHistory = await decryptData(buffer, currentPassword);
      } catch (err) {
        const dec = new TextDecoder();
        importedHistory = JSON.parse(dec.decode(buffer));
      }
      
      if (validateImportedHistory(importedHistory)) {
        await browser.storage.local.set({ customHistory: importedHistory });
        allHistory = importedHistory;
        filteredHistory = [...allHistory];
        renderHistoryPage();
        updateStorageMeter();
        alert("¡Respaldo importado correctamente!");
      } else {
        alert("El archivo no tiene un formato o estructura de datos válida.");
      }
    } catch (err) {
      alert("No se pudo descifrar o leer el archivo. Comprueba tu clave.");
    }
    fileInput.value = "";
  });

  document.getElementById("btn-clear")?.addEventListener("click", async () => {
    if (confirm("¿Deseas borrar todos los registros no fijados? Los elementos marcados como 'Fijados' se mantendrán intactos.")) {
      const preservedHistory = allHistory.filter(h => h.pinned);
      await browser.storage.local.set({ customHistory: preservedHistory });
      allHistory = preservedHistory;
      applyFilters();
      updateStorageMeter();
    }
  });

  allHistory = await getStoredHistory();
  filteredHistory = [...allHistory];
  renderHistoryPage();
  updateStorageMeter();

  document.getElementById("search-filter")?.addEventListener("input", applyFilters);
});