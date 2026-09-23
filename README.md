# 🕵️ Lanzador Oculto & Registro Privado Persistente (Trace Hider)

[![Firefox Add-on](https://img.shields.io/badge/Firefox-WebExtension%20Manifest%20V3-orange.svg)](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Repository](https://img.shields.io/badge/GitHub-genocyber%2FTrace--Hider-blueviolet.svg)](https://github.com/genocyber/Trace-Hider)[cite: 8]

Una extensión ligera y discreta para **Mozilla Firefox** desarrollada por **José** bajo la arquitectura **Manifest V3**. Permite registrar de forma privada la actividad de navegación, búsquedas realizadas y datos no sensibles introducidos en formularios web, manteniendo las capturas de pantalla extremadamente optimizadas. 

Se activa de manera rápida desde la barra de direcciones de Firefox (Omnibox) o mediante un atajo de teclado global.

---

## ✨ Características Principales

- **Versión del Add-on:** 1.2.1
- **Creador:** José
- **Repositorio Oficial:** [GitHub - Trace-Hider](https://github.com/genocyber/Trace-Hider)[cite: 8]
- **Acceso Discreto (Omnibox):** Actívate escribiendo la palabra clave asignada (`secreto` por defecto) en la URL + `Espacio` / `Tab` + `Enter`.
- **Modo Oculto:** Diseñada para funcionar en segundo plano sin necesidad de mantener un icono visible en la barra de herramientas.
- **Capturas Ultra Compactas (~5–10 KB):** Procesa cada vista previa con un `<canvas>` en un tamaño optimizado de $200\text{ px}$ en formato JPEG comprimido para ahorrar espacio en la base de datos local.
- **Captura Inteligente de Formularios:** Registra entradas de texto e interacciones con formularios web, filtrando y excluyendo automáticamente campos sensibles (contraseñas, PINs, tarjetas de crédito, tokens, etc.).
- **Buscador y Filtros en Tiempo Real:** Filtra registros por texto, consultas de motores de búsqueda (*Google, Bing, DuckDuckGo, Ecosia*) o páginas con datos de formulario.
- **Organización Cronológica:** Agrupa automáticamente las visitas por periodos temporales (*Hoy*, *Ayer*, o fechas específicas).
- **Interfaz Personalizable:** Soporte para modo oscuro / claro y paginación para mantener un rendimiento fluido.
- **Cifrado Local Avanzado (AES-GCM):** Permite exportar e importar copias de respaldo seguras de todos los registros cifradas con claves protegidas (`.enc`).
- **Bloqueo por Contraseña:** Pantalla de acceso restringido en el panel de control para proteger la privacidad de los registros frente a terceros.
- **Control de Retención Automática (TTL):** Configura los días de retención automática de registros para optimizar el espacio de almacenamiento local.
- **Medidor Dinámico de Almacenamiento:** Controla el espacio consumido con alertas visuales automáticas cuando se supera el 80% de la cuota estimada.

---

## 📂 Estructura del Proyecto

```text
trace-hider/
├── manifest.json         # Configuración global, permisos y palabra clave del Omnibox[cite: 8, 12]
├── README.md             # Documentación oficial del proyecto[cite: 8]
├── src/
│   ├── background.js     # Script de fondo: capturas, miniaturas y eventos de navegación[cite: 8]
│   ├── content.js        # Script de contenido: captura segura de datos de formularios[cite: 8]
│   └── options/
│       ├── options.html  # Interfaz gráfica del panel de control y pantalla de bloqueo[cite: 8, 13]
│       └── options.js    # Lógica de cifrado AES, TTL, filtrado, paginación y gestión de datos[cite: 8, 14]
└── assets/
    └── icon.png          # Icono principal de la extensión (48x48 PNG)[cite: 8, 11]

```

---

## 🛠️ Instalación Local en Firefox

1. Clona este repositorio o descarga los archivos en una carpeta local:
```bash
git clone [https://github.com/tu-usuario/lanzador-oculto.git](https://github.com/tu-usuario/lanzador-oculto.git)

```


2. Abre Firefox y navega a la siguiente dirección:
```text
about:debugging#/runtime/this-firefox

```


3. Haz clic en el botón **Cargar complemento temporal...** (*Load Temporary Add-on...*).
4. Selecciona el archivo `manifest.json` ubicado en la carpeta del proyecto.
5. *(Opcional)* Si deseas ocultarla totalmente, ve al menú de extensiones (🧩), haz clic derecho sobre el complemento y selecciona **Desanclar de la barra de herramientas**.

---

## 🔑 Cómo Modificar la Palabra Clave y Contraseña

### 1. Modificar la Palabra Clave del Omnibox

Por restricciones de arquitectura de seguridad en la API WebExtensions de Firefox, la palabra clave (`omnibox.keyword`) **debe definirse directamente dentro del archivo `manifest.json**`. No es posible modificarla en tiempo de ejecución desde los ajustes JS de la extensión.

Para personalizar tu palabra clave de acceso:

1. Abre el archivo `manifest.json` en tu editor de texto.
2. Modifica la propiedad `"keyword"` dentro del bloque `"omnibox"`:
```json
"omnibox": {
  "keyword": "tu_palabra_secreta"
}

```


3. Guarda los cambios.

### 2. Contraseña de Acceso al Panel

Al instalar la extensión por primera vez, el sistema asigna de forma automática una clave predeterminada para proteger el panel privado:

* **Contraseña inicial:** `1234`

*Nota: Se recomienda encarecidamente actualizar esta contraseña desde la sección de seguridad de la interfaz de opciones tras el primer inicio.*

### 3. Recargar la Extensión

Vuelve a `about:debugging#/runtime/this-firefox` y haz clic en **Recargar** (*Reload*) en la tarjeta de la extensión para aplicar los cambios.

---

## 🚀 Modo de Uso

1. Presiona `Ctrl + L` (o `Cmd + L` en macOS) para seleccionar la barra de direcciones de Firefox.
2. Escribe tu palabra clave (ejemplo: `secreto`) y presiona `Espacio` o `Tab`.
3. Presiona `Enter` para abrir la interfaz del historial privado e introduce tu contraseña (`1234`).

---

## 🔒 Privacidad y Seguridad

* **100% Local:** Todos los datos registrados se conservan únicamente en el almacenamiento local del navegador (`browser.storage.local`). Ninguna información se envía a servidores externos.
* **Filtro de Seguridad Activo:** La extensión se ignora automáticamente en sesiones de navegación de incógnito, dominios sensibles (`login`, `bank`, `paypal`, `stripe`, etc.) y excluye entradas con atributo `type="password"`.

---

## 📄 Licencia

Este proyecto está bajo la Licencia [MIT]
