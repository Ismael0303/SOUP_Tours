# SOUP Tours · Modales (UX/UI Hotfix)

Correcciones de diseño y comportamiento para los diálogos/modal forms (Nuevo integrante, Ajustes, Nuevo movimiento, Nuevo show).

---

## 1) Problemas detectados (según capturas)
- **Inputs/selects angostos** y con halo de enfoque verdoso que desentona.
- **Labels con bajo contraste** (gris muy oscuro sobre fondo oscuro).
- **Botones desbalanceados** (Cancelar domina demasiado / Guardar no resalta lo suficiente en dark mode).
- **Padding interno insuficiente** en tarjetas del modal.
- **Diálogo muy "flotado"**: sombra intensa + borde verde del focus produce ruido visual.
- **Elementos desalineados** en filas de formularios (FX vs Moneda, etc.).
- **Scroll dentro del modal** sin contención en móviles altos.
- **Falta de enfoque inicial y de cierre con ESC** seguro.

---

## 2) Parche CSS (añadir al final de `styles.css`)

```css
/* === Modales · Hotfix UI (v1) === */

/* Card base del modal */
#modal::backdrop { background: rgba(0,0,0,.55); }
#modal .card {
  background: var(--card);
  border-radius: 1rem;
  padding: 1.25rem;
  box-shadow: 0 20px 60px rgba(0,0,0,.5);
  max-width: min(640px, 92vw);
  max-height: min(84vh, 820px);
  overflow: auto;
}

/* Tipografía y contraste */
#modal h3 { margin: .25rem 0 1rem; font-size: 1.2rem; }
#modal label { color: #d7d7d7; } /* subir contraste */
#modal .muted { color: var(--muted); }

/* Campos de formulario dentro del modal */
#modal .field input,
#modal .field select,
#modal .field textarea {
  width: 100%;
  background: #1c1e23;
  border: 1px solid #3a3d45;
  color: var(--fg);
  padding: .6rem .7rem;
  border-radius: .6rem;
}

/* Estado focus más discreto y consistente */
#modal .field input:focus,
#modal .field select:focus,
#modal .field textarea:focus {
  outline: 2px solid #5eead4; /* ya usado en :focus global */
  outline-offset: 1px;
  border-color: #4c9;
}

/* Fila dos columnas pareja (p.ej. Moneda vs FX) */
#modal .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
@media (max-width: 420px) { #modal .row-2 { grid-template-columns: 1fr; } }

/* Chips de presets más compactos */
#modal .chip-bar { gap: .5rem; margin: .5rem 0 1rem; }
#modal .chip { background:#24272e; border:1px solid #3a3d45; }

/* Botonera del modal */
#modal menu { display: flex; gap: .5rem; justify-content: flex-end; margin-top: 1rem; }
#modal .btn { padding: .55rem .9rem; }
#modal .btn.primary { background: var(--acc); color: #051; font-weight: 700; }
#modal .btn.alt { background: #2b2f36; color: #cfd3da; }

/* Listas de menú en modales (Ajustes, ⋮) */
#modal .menu { display: grid; gap: .25rem; }
#modal .menu button {
  width: 100%; text-align: left; padding: .6rem .7rem; border-radius: .5rem;
  background: #1c1e23; border: 1px solid #30323a; color: var(--fg);
}
#modal .menu button:hover { background:#22262d; }

/* Evitar que el modal quede oculto tras el teclado móvil */
@supports (height: 100dvh) {
  #modal .card { max-height: min(84dvh, 820px); }
}
```

> **Nota:** Se usa `#modal` como id del `<dialog>` (ya presente en el proyecto). El estilo afecta únicamente al contenido renderizado dentro del diálogo.

---

## 3) Micro-ajustes en HTML de formularios (referencia)

A modo de guía para la estructura dentro de `openShowForm()` y `openMoveForm()`, se recomienda agrupar campos en filas de dos columnas con `.row-2` cuando aplique:

```html
<div class="row-2">
  <div class="field"><label>Moneda
    <input id="f-cur" value="ARS" maxlength="3" />
  </label></div>
  <div class="field"><label>FX (a base)
    <input id="f-fx" type="number" step="0.0001" value="1" />
  </label></div>
</div>
```

No es obligatorio cambiar el HTML existente si ya insertás `row-2` en los contenedores que corresponden (en `app.js` ya hay un `<div class="row" style="gap:.5rem">`; podés reemplazar esa clase inline por `class="row-2"`).

---

## 4) Mejora de comportamiento (JS)

Añadir en `app.js`, **dentro** del helper `open(html)` justo después de `modal.innerHTML = html;`:

```js
// Enfocar el primer campo interactivo al abrir
document.querySelector('#modal input, #modal select, #modal textarea, #modal button')?.focus({preventScroll:true});

// Cerrar con ESC sin perder estado
document.getElementById('modal').addEventListener('cancel', (e)=>{ e.preventDefault(); modal.close('cancel'); }, { once:true });

// Evitar scroll del body cuando el modal está abierto
document.body.style.overflow = 'hidden';
modal.addEventListener('close', ()=>{ document.body.style.overflow = ''; }, { once:true });
```

Esto mejora accesibilidad y UX en móvil (teclado, foco y bloqueo de scroll de fondo).

---

## 5) QA checklist rápida
- [ ] Inputs/selects ocupan 100% del ancho.
- [ ] Labels legibles en fondo oscuro.
- [ ] Botones con jerarquía clara: **Guardar** (primario) vs **Cancelar** (alterno).
- [ ] Columnas pares alineadas con `.row-2` (se apilan en <420px).
- [ ] El diálogo no se sale de pantalla; scroll interno suave.
- [ ] Foco inicial en el primer campo.
- [ ] `ESC` cierra; el body no hace scroll mientras está abierto.

---

## 6) Prompt para agente de IA

```
Contexto: SOUP Tours (PWA). Corregir UI/UX de modales.

Tareas:
1) En styles.css, append del bloque "Modales · Hotfix UI (v1)" (ver sección 2).
2) En app.js, en la función open(html), tras modal.innerHTML, añadir el bloque JS de foco/ESC/scroll (sección 4).
3) Reemplazar las filas inline de Moneda/FX por <div class="row-2">…</div> en openMoveForm().
4) Verificar que botones de <menu> usen .btn y .btn primary / .btn alt.
5) QA con viewport 360x740 y 412x915 (teclado móvil), y escritorio.

No modificar: lógica de negocio, merge, storage, tests.

Entregables: diffs de styles.css y app.js + notas de verificación.
```

---

## 7) Resultado esperado
Modales más limpios, legibles y consistentes con dark mode; navegación por teclado correcta; sin superposiciones ni desbordes en móvil.

