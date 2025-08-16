# SOUP Tours · Hotfix de UI para Móviles (v1)

Este documento resume las correcciones de interfaz propuestas, el parche CSS correspondiente, las modificaciones opcionales de HTML/JS y un prompt de implementación para un agente de IA.

---

## 1. Problemas de UI detectados
- **Topbar saturada:** demasiados botones en fila, se superponen en móvil.
- **Search bar angosta:** input limitado a 30% del ancho.
- **FAB superpuesto con tabs:** en algunas pantallas se pisa con la barra inferior.
- **Tabs inferiores poco diferenciadas:** apenas visibles en pantallas pequeñas.
- **Toasts muy bajos:** quedan tapados por nav o FAB.
- **Tipografía e inputs pequeños:** sin ajuste para pantallas <400px.

---

## 2. Parche CSS
Agregar al final de `styles.css`:

```css
/* === SOUP Tours · Hotfix UI móvil (v1) === */

/* Topbar más flexible */
.topbar { gap: .5rem; row-gap: .4rem; padding: .6rem .8rem; }
.topbar h1 { font-size: 1.25rem; margin: 0; }

/* Buscador ancho completo */
.topbar input#q, #search-input { max-width: 100%; flex: 1 1 100%; min-width: 0; }

/* Ocultar acciones secundarias en pantallas angostas */
@media (max-width: 480px) {
  #btn-csv, #btn-exp-liq, #btn-export, .topbar .file { display: none; }
}

/* Tabs inferiores más visibles */
.tabs { height: 56px; }
.tabs>button { font-weight: 500; opacity: .7; }
.tabs>button.active { opacity: 1; border-top: 2px solid var(--acc); background: linear-gradient(to top, rgba(74,222,128,.10), transparent); }

/* FAB con margen de safe area */
.fab { bottom: calc(5.5rem + env(safe-area-inset-bottom, 0px)); box-shadow: 0 8px 24px rgba(0,0,0,.35); }

/* Toast más arriba */
#toast { bottom: calc(8rem + env(safe-area-inset-bottom, 0px)); }

/* Ajustes tipográficos */
@media (max-width: 380px) { body { font-size: 15px; } .amount-lg { font-size: 1.1em; } }
```

---

## 3. Botón de menú opcional en Topbar

### HTML (en `index.html`, dentro de `<header class="topbar">`):
```html
<button id="btn-more" class="ghost" aria-label="Más">⋯</button>
```

### JS (en `app.js`, dentro del `DOMContentLoaded`):
```js
const btnMore = document.getElementById('btn-more');
if (btnMore) {
  btnMore.onclick = () => {
    open(`<form method="dialog" class="card">
      <h3>Acciones</h3>
      <ul class="menu">
        <li><button value="csv">Exportar CSV (Movimientos)</button></li>
        <li><button value="liq">Exportar CSV (Liquidación)</button></li>
        <li><button value="backup">Exportar Backup JSON</button></li>
        <li><button value="tests">Correr Tests</button></li>
      </ul>
      <menu><button class="btn" value="cancel">Cerrar</button></menu>
    </form>`);
    modal.addEventListener('close', () => {
      if (modal.returnValue === 'csv') exportCSV?.();
      else if (modal.returnValue === 'liq') liquidationCSV?.();
      else if (modal.returnValue === 'backup') {
        const blob = new Blob([JSON.stringify(STATE,null,2)], {type:'application/json'});
        const a = Object.assign(document.createElement('a'), {
          href: URL.createObjectURL(blob),
          download: `soup_tours_${new Date().toISOString().slice(0,10)}.json`
        });
        a.click(); URL.revokeObjectURL(a.href);
        toast('Backup exportado.', 'success');
      } else if (modal.returnValue === 'tests') runTests?.();
    }, { once:true });
  };
}
```

---

## 4. Prompt para agente de IA

```
Contexto:
- Proyecto: SOUP Tours (PWA con index.html, styles.css, app.js).
- Objetivo: mejorar UI móvil.

Tareas:
1) Añadir el bloque CSS al final de styles.css (ver sección 2).
2) Insertar el botón <button id="btn-more">⋯</button> en la topbar de index.html.
3) Agregar en app.js el manejador JS (ver sección 3).
4) Verificar en móvil:
   - Topbar no desborda.
   - Buscador ocupa ancho completo.
   - Acciones secundarias ocultas en ≤480px.
   - FAB y toast no se solapan con tabs.
5) Mantener intactas las funciones de negocio (mergeState, storage, tests).

Entregables:
- Diff de styles.css, index.html y app.js.
- Nota de verificación (captura o descripción del estado final).
```

---

## 5. Resultado esperado
- Interfaz mucho más limpia en pantallas chicas.
- Acciones avanzadas centralizadas en el menú “⋯”.
- Navegación clara, sin elementos superpuestos.
- Mejor legibilidad de tabs, toasts y formularios en móvil.

