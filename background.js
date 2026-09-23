const SENSITIVE_KEYWORDS = [
  "login", "signin", "auth", "token", "password", "checkout",
  "payment", "bank", "account", "billing", "paypal", "stripe"
];

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

// Abrir opciones directamente al pulsar Enter tras usar la clave del Omnibox
browser.omnibox.onInputEntered.addListener(() => {
  browser.runtime.openOptionsPage();
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
    const img = new Image();
    img.onload = () => {
      const aspectRatio = img.height / img.width;
      const targetHeight = Math.round(targetWidth * aspectRatio);

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      resolve(canvas.toDataURL("image/jpeg", 0.5));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function getStoredHistory() {
  const data = await browser.storage.local.get("customHistory");
  return data.customHistory || [];
}

async function saveStoredHistory(historyList) {
  await browser.storage.local.set({ customHistory: historyList });
}

// Guardar datos enviados desde content.js
browser.runtime.onMessage.addListener(async (message) => {
  if (!message || (message.type !== "FORM_SUBMITTED" && message.type !== "FORM_INPUT_CHANGED")) return;
  if (isSensitiveUrl(message.url)) return;

  let historyList = await getStoredHistory();
  const targetIndex = historyList.findIndex(item => item.url === message.url);

  if (targetIndex !== -1) {
    const currentFormData = historyList[targetIndex].formData || {};
    historyList[targetIndex].formData = { ...currentFormData, ...message.formData };
  } else {
    historyList.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      title: message.title || message.url,
      url: message.url,
      searchQuery: getSearchQuery(message.url),
      thumbnail: null,
      formData: message.formData,
      timestamp: Date.now()
    });
  }

  await saveStoredHistory(historyList);
});

// Listener de navegación
browser.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (isSensitiveUrl(details.url)) return;

  try {
    const tab = await browser.tabs.get(details.tabId);
    if (tab.incognito) return;

    let thumbnailData = null;
    try {
      const fullScreenshot = await browser.tabs.captureVisibleTab(tab.windowId, {
        format: "jpeg",
        quality: 35
      });
      thumbnailData = await createThumbnail(fullScreenshot, 200);
    } catch (err) {
      // Ignorar si la pestaña no está enfocada
    }

    const searchQuery = getSearchQuery(details.url);
    let historyList = await getStoredHistory();

    if (historyList.length === 0 || historyList[0].url !== details.url) {
      const newEntry = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
        title: tab.title || details.url,
        url: details.url,
        searchQuery: searchQuery || null,
        thumbnail: thumbnailData,
        formData: null,
        timestamp: Date.now()
      };

      historyList.unshift(newEntry);
      if (historyList.length > 500) historyList = historyList.slice(0, 500);

      await saveStoredHistory(historyList);
    }
  } catch (e) {
    console.error("Error al registrar navegación:", e);
  }
});