const EXCLUDED_FIELDS = [
  "password", "pass", "pwd", "token", "auth", "secret", 
  "card", "cvv", "cc", "creditcard", "ssn", "iban", "pin"
];

function isSensitiveField(element) {
  if (!element) return true;
  if (element.type === "password" || element.type === "hidden") return true;
  
  const autocomplete = (element.getAttribute("autocomplete") || "").toLowerCase();
  if (autocomplete.includes("cc-") || autocomplete.includes("one-time-code") || autocomplete.includes("current-password")) return true;

  const nameOrId = (element.name || "") + " " + (element.id || "") + " " + (element.getAttribute("aria-label") || "");
  const lower = nameOrId.toLowerCase();
  
  return EXCLUDED_FIELDS.some(keyword => lower.includes(keyword));
}

function extractFormData(form) {
  const formData = {};
  if (!form || typeof form.querySelectorAll !== "function") return null;
  
  const elements = form.querySelectorAll("input, textarea, select");

  elements.forEach(el => {
    if (isSensitiveField(el) || !el.value || el.value.trim() === "") return;

    let label = el.name || el.id || el.placeholder;
    if (!label) {
      const parentLabel = el.closest("label");
      if (parentLabel) label = parentLabel.innerText.trim();
    }
    if (!label) label = "Campo";

    label = label.replace(/[\r\n]+/g, " ").trim();
    const value = el.value.length > 300 ? el.value.substring(0, 300) + "..." : el.value;
    
    formData[label] = value;
  });

  return Object.keys(formData).length > 0 ? formData : null;
}

// Escuchar envío de formularios con validación defensiva
document.addEventListener("submit", (e) => {
  if (!e.target || e.target.tagName !== "FORM") return;

  try {
    const capturedData = extractFormData(e.target);
    if (capturedData) {
      browser.runtime.sendMessage({
        type: "FORM_SUBMITTED",
        url: window.location.href,
        title: document.title,
        formData: capturedData
      }).catch(() => {});
    }
  } catch (err) {
    // Manejo silencioso de excepciones en contexto de contenido
  }
}, true);

// Debounce para limitar envíos continuos mientras el usuario escribe
let changeTimeout = null;
document.addEventListener("input", (e) => {
  const el = e.target;
  if (!el || !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
  if (isSensitiveField(el) || !el.value || el.value.trim() === "") return;

  clearTimeout(changeTimeout);
  changeTimeout = setTimeout(() => {
    try {
      let label = el.name || el.id || el.placeholder || "Campo";
      label = label.replace(/[\r\n]+/g, " ").trim();
      const value = el.value.length > 300 ? el.value.substring(0, 300) + "..." : el.value;

      browser.runtime.sendMessage({
        type: "FORM_INPUT_CHANGED",
        url: window.location.href,
        title: document.title,
        formData: { [label]: value }
      }).catch(() => {});
    } catch (err) {
      // Ignorar fallos de comunicación con el background
    }
  }, 600);
}, true);