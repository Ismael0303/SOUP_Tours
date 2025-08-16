# SOUP Tours — Actualización v4 UI

> Objetivo: pulir la **experiencia visual y de uso** manteniendo el stack **vanilla JS + HTML + CSS**. Esta actualización se centra en **modales**, **jerarquía visual**, **accesibilidad**, **espaciados**, **estados vacíos**, y **coherencia** de componentes.

---

## 0) Principios

- **Móvil primero**: controles táctiles (mín. 44×44 px), tipografías ≥16px.
- **Contraste AA** y foco visible.
- **Coherencia**: una sola escala de espaciados, radios y sombras.
- **Cero dependencias** y cambios acotados en HTML/JS.
- **Reutilizar** utilidades (tokens CSS) en toda la UI.

---

## 1) Tokens de diseño (CSS)

Pegar al inicio de `styles.css` o consolidar las variables existentes.

```css
:root{
  /* Paleta */
  --bg:#0b0b0c;           /* fondo app */
  --surface:#121316;      /* superficies */
  --surface-2:#171920;    /* superficies elevadas */
  --text:#eaeaea;         /* texto primario */
  --text-2:#b9bec7;       /* texto secundario */
  --accent:#22c55e;       /* acciones principales */
  --accent-2:#16a34a;     /* hover/active */
  --danger:#ef4444;       /* errores */
  --warn:#f59e0b;         /* advertencias */
  --info:#60a5fa;         /* informativo */
  --ok:#34d399;           /* ok/éxito */

  /* Dimensiones */
  --radii:16px;           /* radio estándar */
  --pad:16px;             /* padding base */
  --gap:12px;             /* gap base */
  --shadow:0 10px 30px rgba(0,0,0,.35);
}
```

---

## 2) Modales impecables (dialog)

### 2.1 Overlay + contenedor centrado

Añadir al final de `styles.css`:

```css
/* Overlay del dialog */
dialog::backdrop{ background:rgba(0,0,0,.55); backdrop-filter:saturate(1.1) blur(1.5px); }

/* Caja del modal */
dialog{ border:none; padding:0; background:transparent; }
.modal{ background:var(--surface-2); color:var(--text); width:min(92vw,520px); border-radius:var(--radii); box-shadow:var(--shadow); }
.modal header{ padding:var(--pad); font-weight:700; border-bottom:1px solid #2a2f3a; }
.modal .content{ padding:var(--pad); display:flex; flex-direction:column; gap:var(--gap); }
.modal footer{ display:flex; gap:var(--gap); justify-content:flex-end; padding:var(--pad); border-top:1px solid #2a2f3a; }

/* Inputs dentro de modal */
.modal .field label{ font-size:.95rem; color:var(--text-2); margin-bottom:4px; display:block; }
.modal input, .modal select, .modal textarea{ width:100%; background:#0f1116; color:var(--text); border:1px solid #2a2f3a; border-radius:10px; padding:10px 12px; }
.modal input:focus, .modal select:focus, .modal textarea:focus{ outline:2px solid #4fd1c5; outline-offset:2px; }

/* Botones modales */
.btn{ background:#22272f; color:var(--text); border:1px solid #2a2f3a; padding:10px 14px; border-radius:12px; }
.btn.primary{ background:var(--accent); color:#052b16; border:none; }
.btn.primary:active{ background:var(--accent-2); }
.btn.ghost{ background:transparent; border:1px solid #2a2f3a; }
```

### 2.2 Plantilla HTML unificada para todos los modales

Reemplazar el contenido que inyectan `openShowForm`, `openMoveForm`, `openMemberForm` por esta estructura base (ajustar campos según el modal):

```html
<dialog id="modal">
  <form method="dialog" class="modal" aria-labelledby="modal-title">
    <header><h3 id="modal-title">Nuevo movimiento</h3></header>
    <section class="content">
      <div class="field">
        <label for="f-kind">Tipo</label>
        <select id="f-kind"> ... </select>
      </div>
      <!-- más campos aquí -->
    </section>
    <footer>
      <button class="btn" value="cancel">Cancelar</button>
      <button class="btn primary" value="default">Guardar</button>
    </footer>
  </form>
</dialog>
```

### 2.3 Animación sutil y accesible

```css
@media (prefers-reduced-motion:no-preference){
  dialog[open] .modal{ animation:pop .15s ease-out; }
  @keyframes pop{ from{ transform:translateY(10px) scale(.98); opacity:0 } to{ transform:none; opacity:1 } }
}
```

---

## 3) Jerarquía en la topbar

Objetivo: que el Título respire y las acciones se lean rápido.

**Cambios**

- Agrupar acciones secundarias (CSV, Importar, Deshacer, Ajustes) en un **menu** de 3 puntos.
- Dejar visibles sólo **Exportar JSON** y **Buscar**.

**HTML**

```html
<header class="topbar">
  <h1 id="band-name">SOUP</h1>
  <input id="q" placeholder="Buscar…" oninput="setSearch(this.value)" />
  <div class="actions">
    <button class="btn ghost" onclick="exportJSON()">Exportar</button>
    <button class="btn ghost icon" onclick="openActionsMenu(this)" aria-label="Más opciones">⋮</button>
  </div>
</header>
```

**CSS**

```css
.topbar{ position:sticky; top:0; z-index:20; display:flex; gap:12px; align-items:center; justify-content:space-between; padding:10px 12px; background:#0f1013; border-bottom:1px solid #1d2027; }
.topbar h1{ margin:0 auto; letter-spacing:.04em; }
.topbar .actions{ display:flex; gap:8px; }
.topbar input#q{ flex:1; max-width:42vw; background:#0f1116; border:1px solid #2a2f3a; color:var(--text); border-radius:12px; padding:8px 12px; }
```

**JS (menu simple)**

```js
function openActionsMenu(btn){
  const html = `
  <ul class="menu">
    <li><button onclick="undo()">Deshacer</button></li>
    <li><button onclick="exportCSV()">Exportar CSV</button></li>
    <li><button onclick="document.getElementById('input-import').click()">Importar</button></li>
    <li><button onclick="openSettings()">Ajustes</button></li>
  </ul>`;
  openMenu(btn, html); // reutiliza tu helper
}
```

**CSS menú**

```css
.menu{ background:var(--surface-2); border:1px solid #2a2f3a; border-radius:12px; box-shadow:var(--shadow); }
.menu button{ display:block; width:100%; padding:10px 14px; background:transparent; color:var(--text); text-align:left; }
.menu button:hover{ background:#20242b; }
```

---

## 4) Componentes coherentes

### 4.1 Cards + espaciado

```css
.card{ background:var(--surface); color:var(--text); border-radius:var(--radii); padding:16px; margin:12px 0; box-shadow:0 1px 0 #1d2027; }
.list{ display:flex; flex-direction:column; gap:10px; }
.row{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.section-title{ font-weight:700; margin:16px 0 8px; }
```

### 4.2 Badges de estado (shows)

```css
.badge{ padding:4px 10px; border-radius:999px; font-size:.8rem; border:1px solid #2a2f3a; }
.badge.pendiente{ background:#222; color:#bbb; }
.badge.confirmado{ background:#052a16; color:#7df29e; border-color:#144b2a; }
.badge.realizado{ background:#0b2344; color:#9cc9ff; border-color:#1f3a68; }
.badge.cancelado{ background:#3b0c0c; color:#ffb4b4; border-color:#5a1717; }
.badge.cerrado{ background:#2d2431; color:#d6c5ee; border-color:#3c2f44; }
```

### 4.3 Chips / Filtros

```css
.chips{ display:flex; gap:8px; flex-wrap:wrap; }
.chip{ background:#20242b; color:var(--text); border:1px solid #2a2f3a; padding:6px 10px; border-radius:999px; }
.chip.active{ background:var(--accent); color:#052b16; border:none; }
```

### 4.4 Estados vacíos

```css
.empty{ background:var(--surface); border:1px dashed #2a2f3a; color:var(--text-2); border-radius:var(--radii); padding:20px; text-align:center; }
```

**Uso**

```html
<div class="empty">No hay movimientos aún. Cargá tu primero con el botón “+”.</div>
```

---

## 5) Formularios rápidos y claros

- Etiquetas visibles arriba de inputs.
- Placeholders informativos (no reemplazan la etiqueta).
- `inputmode="numeric"` para montos en móviles.

**Snippet**

```html
<div class="field">
  <label for="f-amount">Monto</label>
  <input id="f-amount" type="number" inputmode="numeric" min="1" required>
</div>
<div class="row" style="gap:8px">
  <button type="button" class="chip" onclick="preset(2000)">$2k</button>
  <button type="button" class="chip" onclick="preset(5000)">$5k</button>
  <button type="button" class="chip" onclick="preset(10000)">$10k</button>
</div>
<script>
function preset(v){ const el=document.getElementById('f-amount'); el.value=v; el.focus(); }
</script>
```

---

## 6) Barra de tabs y FAB (móvil)

```css
.tabs{ position:fixed; bottom:0; left:0; right:0; display:flex; background:#0f1013; border-top:1px solid #1d2027; }
.tabs>button{ flex:1; padding:12px 8px; background:transparent; color:var(--text-2); border:none; }
.tabs>button.active{ color:var(--accent); border-top:2px solid var(--accent); }
.fab{ position:fixed; right:16px; bottom:84px; width:56px; height:56px; border-radius:999px; background:var(--accent); color:#052b16; border:none; box-shadow:var(--shadow); font-size:28px; }
```

---

## 7) Accesibilidad

- `role="status" aria-live="polite"` en el toast.
- `aria-labelledby` para títulos de modal.
- Estados `:focus` en todos los elementos interactivos.
- Soporte `prefers-reduced-motion` para desactivar animaciones.

**Toast**

```html
<div id="toast" role="status" aria-live="polite"></div>
```

---

## 8) Diagnóstico visual (DevTools)

- **Layers**: inspeccionar sombras y z-index.
- **Rendering → Emulate vision deficiencies** (probar deuteranopia/protanopia).
- **Mobile viewport**: iPhone 14 / Pixel 7 para ajustar breakpoints.

---

## 9) Tests UI (manuales rápidos)

-

---

## 10) Roadmap de aplicación (orden sugerido)

1. **Modales**: overlay + plantilla + estilos (Sección 2).
2. **Topbar**: agrupar acciones secundarias (Sección 3).
3. **Cards/Badges/Chips**: aplicar estilos coherentes (Sección 4).
4. **Formularios**: etiquetas y presets (Sección 5).
5. **Tabs/FAB**: revisar posiciones y estados (Sección 6).
6. **Accesibilidad**: toasts y focus (Sección 7).
7. **Estados vacíos**: mensajes y CTA (Sección 4.4).

---

## 11) Prompt para tu agente de IA

```
Actuá como Senior Frontend/UI. Aplicá la "Actualización v4 UI" en index.html, styles.css y app.js sin agregar librerías.
- Implementá los estilos de dialog (overlay, contenedor, animación accesible) y usá la plantilla .modal.
- Limpia la topbar y mové acciones secundarias a un menú.
- Uniformá cards, badges, chips y estados vacíos según los snippets.
- Mantené el comportamiento de la app. Probá los tests UI manuales.
- Respetá móvil-first y contraste AA.
```

