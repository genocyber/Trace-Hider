const SENSITIVE_KEYWORDS = [
  "login", "signin", "auth", "token", "password", "checkout",
  "payment", "bank", "account", "billing", "paypal", "stripe", "cart"
];

// Establecer la contraseña por defecto "1234" al instalar la extensión por primera vez
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    await browser.storage.local.set({ accessPassword: "1234" });
  }
});

function isSensitiveUrl(urlString) {
  try {
    const url = new URL(urlString);
    if (!url.protocol.startsWith("http")) return true;
    const lowerUrl = urlString.toLowerCase();
    return SENSITIVE_KEYWORDS.some(keyword => lowerUrl.includes(keyword));
  } catch (e) {
    return true;
  }
}

browser.omnibox.onInputEntered.addListener(() => {
  browser.runtime.openOptionsPage();
});

browser.commands.onCommand.addListener((command) => {
  if (command === "_execute_action") {
    browser.runtime.openOptionsPage();
  }
});

function getSearchQuery(urlString) {
  try {
    const url = new URL(urlString);
    const host = url.hostname.toLowerCase();

    if (host.includes("google.") || host.includes("bing.") || host.includes("ecosia.") || host.includes("duckduckgo.")) {
      return url.searchParams.get("q");
    }
    if (host.includes("yahoo.")) return url.searchParams.get("p");
    if (host.includes("baidu.")) return url.searchParams.get("wd");
  } catch (e) {
    return null;
  }
  return null;
}

async function createThumbnail(dataUrl, targetWidth = 200) {
  return new Promise((resolve) => {
    if (!dataUrl) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const aspectRatio = img.height / img.width;
        const targetHeight = Math.round(targetWidth * (isNaN(aspectRatio) ? 0.75 : aspectRatio));

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight > 0 ? targetHeight : 150;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL("image/jpeg", 0.5));
      } catch (err) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/**
 * Transacción atómica segura para manipular el historial y prevenir condiciones de carrera.
 */
async function atomicUpdateHistory(updaterFn) {
  try {
    const data = await browser.storage.local.get(["customHistory", "retentionDays", "maxItems"]);
    let historyList = Array.isArray(data.customHistory) ? data.customHistory : [];
    
    historyList = updaterFn(historyList);

    const retentionDays = parseInt(data.retentionDays, 10);
    const maxItems = parseInt(data.maxItems, 10) || 500;

    if (!isNaN(retentionDays) && retentionDays > 0) {
      const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
      historyList = historyList.filter(item => item && (item.pinned || (typeof item.timestamp === 'number' && item.timestamp >= cutoffTime)));
    }

    historyList = historyList.slice(0, maxItems);
    await browser.storage.local.set({ customHistory: historyList });
    return historyList;
  } catch (e) {
    console.error("Error crítico en actualización atómica del historial:", e);
    return [];
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

(async function initCleanup() {
  await atomicUpdateHistory(list => list);
})();

browser.runtime.onMessage.addListener(async (message) => {
  if (!message || (message.type !== "FORM_SUBMITTED" && message.type !== "FORM_INPUT_CHANGED")) return;
  if (isSensitiveUrl(message.url)) return;

  await atomicUpdateHistory(historyList => {
    const targetIndex = historyList.findIndex(item => item && item.url === message.url);

    if (targetIndex !== -1) {
      const currentFormData = historyList[targetIndex].formData || {};
      historyList[targetIndex].formData = { ...currentFormData, ...message.formData };
      historyList[targetIndex].timestamp = Date.now();
    } else {
      historyList.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
        title: message.title || message.url,
        url: message.url,
        searchQuery: getSearchQuery(message.url),
        thumbnail: null,
        formData: message.formData,
        pinned: false,
        timestamp: Date.now()
      });
    }
    return historyList;
  });
});

browser.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (isSensitiveUrl(details.url)) return;

  try {
    const tab = await browser.tabs.get(details.tabId);
    if (!tab || tab.incognito) return;

    const config = await browser.storage.local.get("disableThumbnails");
    let thumbnailData = null;

    if (!config.disableThumbnails) {
      try {
        if (tab.url && !tab.url.startsWith("about:") && !tab.url.startsWith("moz-extension:")) {
          const fullScreenshot = await browser.tabs.captureVisibleTab(tab.windowId, {
            format: "jpeg",
            quality: 35
          });
          thumbnailData = await createThumbnail(fullScreenshot, 200);
        }
      } catch (err) {
        // Ventana sin foco o restringida
      }
    }

    const searchQuery = getSearchQuery(details.url);

    await atomicUpdateHistory(historyList => {
      if (historyList.length === 0 || historyList[0].url !== details.url) {
        const newEntry = {
          id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
          title: tab.title || details.url,
          url: details.url,
          searchQuery: searchQuery || null,
          thumbnail: thumbnailData,
          formData: null,
          pinned: false,
          timestamp: Date.now()
        };
        historyList.unshift(newEntry);
      }
      return historyList;
    });
  } catch (e) {
    console.error("Error al registrar navegación:", e);
  }
});