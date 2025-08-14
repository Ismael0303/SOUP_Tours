# Informe de Situación: Problema con dayjs.tz.names

## Descripción del Problema

El error `TypeError: dayjs.tz.names is not a function` persiste en la aplicación, impidiendo el correcto funcionamiento del selector de zona horaria en la sección de "Ajustes". Este error indica que la función `dayjs.tz.names()` está siendo llamada antes de que el plugin de `timezone` de `dayjs` haya sido correctamente extendido y esté disponible.

## Contexto de la Aplicación

*   **Tipo de Aplicación:** PWA (Progressive Web App) para la gestión de giras de bandas.
*   **Tecnologías Principales:** JavaScript vanilla, HTML, CSS.
*   **Librerías Externas:**
    *   `dayjs` (para manejo de fechas y horas).
    *   `Tom Select` (para el selector de zona horaria con búsqueda/autocompletado).
    *   `Frappe Charts` (planeado para visualizaciones, actualmente con error 404 al cargar).
*   **Entorno de Ejecución:** Servida localmente a través de `http-server` en `localhost:8000`.

## Acciones Tomadas Hasta Ahora (Cronología Inversa)

1.  **Última Modificación (`app.js`):**
    *   Se movieron las llamadas a `dayjs.extend(window.dayjs_plugin_utc);` y `dayjs.extend(window.dayjs_plugin_timezone);` al *inicio* del archivo `app.js`, justo después de `dayjs.locale('es');`.
    *   Se revirtió la inicialización de `DEFAULT_STATE.settings.timezone` para que use directamente `dayjs.tz.guess()`.
    *   Se revirtió la lógica de `migrate` para que también use `dayjs.tz.guess()` directamente para `state.settings.timezone`.
    *   Se eliminó la lógica de inicialización de `STATE.settings.timezone` del listener `DOMContentLoaded`.
    *   **Objetivo:** Asegurar que los plugins de `dayjs` se extiendan lo antes posible y que `STATE.settings.timezone` se inicialice con un valor válido desde el principio.

2.  **Intentos Anteriores de Solución:**
    *   Se movieron las llamadas a `dayjs.extend` dentro del listener `DOMContentLoaded`.
    *   Se modificó `DEFAULT_STATE` para inicializar `settings.timezone` como una cadena vacía (`''`) y se añadió lógica en `DOMContentLoaded` para asignar `dayjs.tz.guess()` si estaba vacío.
    *   Se modificó la función `migrate` para asegurar que `state.settings` fuera un objeto y que `state.settings.timezone` se inicializara a `''` si no existía.
    *   Se modificó la función `load` para asegurar que siempre pasara un objeto válido a `migrate`.

## Estado Actual de `app.js` (Partes Relevantes)

```javascript
// --- Inicio de app.js ---
let DEBUG = true;
dayjs.locale('es');

dayjs.extend(window.dayjs_plugin_utc);
dayjs.extend(window.dayjs_plugin_timezone);

// ====== Estado y persistencia ======
const KEY = 'soup_tours';
const DEFAULT_STATE = {
  band: { name: 'SOUP', members: [{id:'u1', name:'Ismael', role:'voz/guitarra'}], pin: null },
  shows: [],
  moves: [],
  settings: { timezone: dayjs.tz.guess() } // <-- Aquí se llama dayjs.tz.guess()
};
let STATE = load(); // <-- load() llama a migrate()

// ... otras funciones ...

function migrate(state){
  state.version ||= 1;
  // ... lógica de migración de versiones anteriores ...
  state.settings ||= { timezone: dayjs.tz.guess() }; // <-- Aquí también se llama dayjs.tz.guess()
  return state;
}

// ... otras funciones ...

function openSettings() {
  // ...
  const timezones = dayjs.tz.names().map(tz => ({ value: tz, text: tz })); // <-- Aquí se llama dayjs.tz.names()
  // ...
}

// ... resto del código ...

window.addEventListener('DOMContentLoaded', () => {
  // ...
  // Ya no hay llamadas a dayjs.extend o inicialización de timezone aquí
  // ...
});
```

## Comportamiento Observado

*   El error `TypeError: dayjs.tz.names is not a function` sigue apareciendo en la consola cuando se hace clic en el botón de "Ajustes" (que llama a `openSettings`).
*   También se observan errores persistentes de `TypeError: Cannot read properties of undefined (reading 'timezone')` en `updateClock` y `renderCash`, lo que sugiere que `STATE.settings.timezone` sigue siendo `undefined` en algún momento, a pesar de los intentos de inicialización.
*   Errores secundarios:
    *   `frappe-charts.min.iife.js` no se carga (404).
    *   Icono de PWA (`icon-192.png`) y `favicon.ico` no se cargan (errores de descarga/404).
    *   Mensaje "JSON inválido" al intentar importar un JSON guardado previamente (posiblemente relacionado con la estructura del JSON antiguo o el momento de la migración).

## Hipótesis

La hipótesis principal es que, a pesar de colocar `dayjs.extend` al inicio de `app.js`, el objeto global `dayjs` o sus plugins no están completamente inicializados o disponibles en el momento exacto en que `DEFAULT_STATE` o `migrate` intentan acceder a `dayjs.tz.guess()` o `openSettings` intenta acceder a `dayjs.tz.names()`. Esto es un problema de *timing* muy sutil en la carga de scripts en el navegador.

Podría ser que:
1.  El script `app.js` se ejecuta tan rápido que, aunque `dayjs.min.js` se carga antes en `index.html`, sus plugins no están listos para ser extendidos por `dayjs.extend` en el momento en que se evalúan las constantes globales como `DEFAULT_STATE`.
2.  Existe alguna interacción o conflicto con la forma en que los módulos de `dayjs` se exponen globalmente o con el entorno de ejecución del navegador.

## Solicitud

Se solicita a otra IA que analice este informe y sugiera soluciones para el error `dayjs.tz.names is not a function` y los problemas relacionados con la inicialización del estado, teniendo en cuenta la cronología de las acciones ya realizadas y la naturaleza del problema de timing. También se agradecerían soluciones para los errores secundarios (carga de recursos y JSON inválido).
