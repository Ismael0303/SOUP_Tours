# SOUP Tours — Actualización v2

> Documento operativo con **templates de código**, **instrucciones paso a paso**, **tests** y **debug logs** para implementar las próximas mejoras (V3 “Cierres y orden” + V4 “Comodidad en ruta”), manteniendo **vanilla JS / sin dependencias** y móvil‑first.

---

## 0) Alcance y principios

- Mantener `index.html`, `styles.css`, `app.js` como única base.
- Sin frameworks ni bundlers; sólo APIs nativas del navegador.
- Compatibilidad hacia atrás con backups JSON existentes (migraciones ligeras).
- **Debug activable** con flag `DEBUG=true` para trazas ricas en consola.

---

## 1) Cambios de modelo (migración ligera)

Agregar campos sin romper datos previos.

```js
// app.js — añadir en zona de constantes / boot
const CURRENT_VERSION = 2; // subir cuando cambie el esquema
let DEBUG = true; // poner en false para producción

function migrate(state){
  state.version ||= 1;
  if(state.version < 2){
    // V2 agrega: category en moves, tags[], currency, fx_rate, receiptDataUrl, templates[], quickActions[]
    state.moves.forEach(m=>{
      m.category ||= 'General';
      m.tags ||= [];
      m.currency ||= 'ARS';
      m.fx_rate ||= 1;
      m.receiptDataUrl ||= null;
    });
    state.templates ||= [];
    state.quickActions ||= [
      {label:'+ Venta merch $5000', kind:'ingreso', scope:'comun', amount:5000, category:'Merch', note:'Venta mesa'},
      {label:'+ Nafta $10000', kind:'gasto', scope:'comun', amount:10000, category:'Transporte', note:'Combustible'},
      {label:'+ Peaje $1500', kind:'gasto', scope:'comun', amount:1500, category:'Peajes', note:'Peaje'}
    ];
    state.shows.forEach(s=>{ s.closedAt ||= null; s.requerimientos ||= ''; });
    state.version = 2;
  }
  return state;
}

function load(){
  try{
    const raw = JSON.parse(localStorage.getItem(KEY)) || DEFAULT_STATE;
    return migrate(raw);
  }catch{ return DEFAULT_STATE }
}
```

---

## 2) Categorías, tags y multi‑moneda (UI y lógica)

### 2.1 Formulario de movimientos: nuevos campos

```js
// app.js — en openMoveForm() añadir inputs
// ...
<div class="field"><label>Categoría
  <input id="f-cat" list="cat-list" placeholder="General" />
</label></div>
<datalist id="cat-list">
  <option>Merch</option><option>Transporte</option><option>Comida</option>
  <option>Alojamiento</option><option>Peajes</option><option>Alquiler equipo</option>
</datalist>
<div class="field"><label>Tags (usa #)
  <input id="f-tags" placeholder="#peaje #ruta" />
</label></div>
<div class="row" style="gap:.5rem">
  <div class="field" style="flex:1"><label>Moneda
    <input id="f-cur" value="ARS" maxlength="3" />
  </label></div>
  <div class="field" style="flex:1"><label>FX (a base)
    <input id="f-fx" type="number" step="0.0001" value="1" />
  </label></div>
</div>
// al guardar
const category = document.getElementById('f-cat').value || 'General';
const tags = (document.getElementById('f-tags').value||'')
              .split(/\s+/).filter(Boolean).map(t=>t.startsWith('#')?t:`#${t}`);
const currency = (document.getElementById('f-cur').value||'ARS').toUpperCase();
const fx_rate = Number(document.getElementById('f-fx').value||1);
addMove(kind, scope, amount, note, memberId, showId, {category, tags, currency, fx_rate});
```

### 2.2 Modelo de movimientos actualizado

```js
// app.js — actualizar addMove
function addMove(kind, scope, amount, note, memberId, showId, extra={}){
  if(scope==='personal' && !memberId) return alert('Elegí integrante');
  const base = {id:uid(), ts:Date.now(), kind, scope, memberId, amount:Number(amount), note, showId};
  const withExtra = Object.assign(base, {
    category: 'General', tags: [], currency: 'ARS', fx_rate: 1, receiptDataUrl: null
  }, extra);
  snapshot();
  STATE.moves.unshift(withExtra); save(); render();
}
```

### 2.3 Totales por categoría y equivalente en moneda base

```js
function amountBase(m){ return m.amount * (m.kind==='ingreso'?1:-1) * (m.fx_rate||1); }
function totalsByCategory(list){
  const map = {};
  list.forEach(m=>{ const k=m.category||'General'; map[k]=(map[k]||0)+amountBase(m); });
  return map; // {Categoria: netoBase}
}
```

---

## 3) Plantillas y acciones rápidas

### 3.1 Plantillas de movimiento

```js
// Estructura: {id,label,kind,scope,category,amount,note,tags,currency,fx_rate}
function addTemplate(t){ t.id = uid(); STATE.templates.push(t); save(); render(); }
function useTemplate(tid){
  const t = STATE.templates.find(x=>x.id===tid); if(!t) return;
  openMoveForm();
  // precarga campos
  setTimeout(()=>{
    document.getElementById('f-kind').value = t.kind;
    document.getElementById('f-scope').value = t.scope; document.getElementById('f-scope').onchange();
    document.getElementById('f-amount').value = t.amount;
    document.getElementById('f-note').value = t.note||'';
    document.getElementById('f-cat').value = t.category||'General';
    document.getElementById('f-tags').value = (t.tags||[]).join(' ');
    document.getElementById('f-cur').value = t.currency||'ARS';
    document.getElementById('f-fx').value = t.fx_rate||1;
  },0);
}
```

### 3.2 Acciones rápidas en Inicio

```js
function renderHome(){
  const {comun, per} = balances();
  const quick = (STATE.quickActions||[]).slice(0,3).map(q=>
    `<button class="btn" onclick="quickAction('${q.label}')">${q.label}</button>`
  ).join(' ');
  // ... resto igual
  view.innerHTML = `
    <section class="card">${quick}</section>
    <!-- resto del dashboard -->`;
}
function quickAction(label){
  const q = STATE.quickActions.find(x=>x.label===label); if(!q) return;
  addMove(q.kind, q.scope, q.amount, q.note||'', null, null, q);
}
```

---

## 4) Cierre/Reapertura de show y requerimientos

```js
function closeShow(id){ const s=STATE.shows.find(x=>x.id===id); if(!s) return; if(!confirm('Cerrar show?')) return; snapshot(); s.closedAt = Date.now(); save(); render(); }
function reopenShow(id){ const s=STATE.shows.find(x=>x.id===id); if(!s) return; if(!confirm('Reabrir show?')) return; snapshot(); s.closedAt = null; save(); render(); }
function isClosed(s){ return !!s.closedAt; }

// En addMove: bloquear si show cerrado
if(showId){ const s=STATE.shows.find(x=>x.id===showId); if(s && isClosed(s)) return alert('Show cerrado. Reabrí para cargar.'); }

// En tarjetas de show (renderShows)
<button class="ghost" onclick="closeShow('${s.id}')" ${'${isClosed(s)?'disabled':''}'}>Cerrar</button>
<button class="ghost" onclick="reopenShow('${s.id}')" ${'${!isClosed(s)?'disabled':''}'}>Reabrir</button>

// Requerimientos (rider) - textarea en edición de show
document.getElementById('f-rider').value = s.requerimientos||''; // y guardar en s.requerimientos
```

---

## 5) Liquidación por integrante (CSV)

```js
function liquidationCSV(){
  const members = STATE.band.members;
  const comunes = STATE.moves.filter(m=>m.scope==='comun');
  const personales = STATE.moves.filter(m=>m.scope==='personal');
  const sum = arr => arr.reduce((a,m)=> a + (m.kind==='ingreso'? m.amount : -m.amount)*(m.fx_rate||1), 0);
  const totalGastoComun = sum(comunes.filter(m=>m.kind==='gasto'));
  const prorrateo = totalGastoComun / Math.max(1, members.length);
  const rows = [['integrante','aportes_personales','gastos_personales','parte_gastos_comunes','saldo_final']];
  members.forEach(mem=>{
    const ap = sum(personales.filter(m=>m.memberId===mem.id && m.kind==='ingreso'));
    const ga = sum(personales.filter(m=>m.memberId===mem.id && m.kind==='gasto'));
    const saldo = ap - ga - prorrateo;
    rows.push([mem.name, ap, ga, prorrateo, saldo]);
  });
  const csv = rows.map(r=>r.join(',')).join('\n');
  const a = Object.assign(document.createElement('a'), {href:URL.createObjectURL(new Blob([csv],{type:'text/csv'})), download:'liquidacion.csv'});
  a.click(); URL.revokeObjectURL(a.href);
}
```

---

## 6) Undo stack (3 niveles)

```js
let LASTS = [];
function snapshot(){ LASTS.push(JSON.stringify(STATE)); if(LASTS.length>3) LASTS.shift(); if(DEBUG) log('snapshot', {depth: LASTS.length}); }
function undo(){ if(!LASTS.length) return; STATE = JSON.parse(LASTS.pop()); save(); render(); }
```

---

## 7) Adjuntar foto de recibo (opcional)

```js
// En openMoveForm():
<div class="field"><label>Recibo (foto)
  <input id="f-rec" type="file" accept="image/*" capture="environment" />
</label></div>
// Al guardar:
const file = document.getElementById('f-rec').files[0];
if(file){ const r=new FileReader(); r.onload = () => addMove(kind, scope, amount, note, memberId, showId, {category, tags, currency, fx_rate, receiptDataUrl:r.result}); r.readAsDataURL(file); return; }
// si no hay archivo, seguir flujo normal (addMove(...))
```

---

## 8) Búsqueda por texto y por #tags

```js
let UI = { cashFilter:{scope:'todos', memberId:null}, search:'' };
function setSearch(q){ UI.search=(q||'').toLowerCase(); render(); }
function matchesSearch(text){ return !UI.search || (text||'').toLowerCase().includes(UI.search); }
function hasTag(m){
  if(!UI.search.startsWith('#')) return true;
  const tag = UI.search.trim(); return (m.tags||[]).includes(tag);
}
// Aplicar en listados de shows y movimientos junto al resto de filtros
```

---

## 9) UI: botones y estilos mínimos

```html
<!-- index.html — topbar: añadir búsqueda, CSV, Undo y Liquidación -->
<header class="topbar">
  <h1 id="band-name">SOUP Tours</h1>
  <input id="q" placeholder="Buscar…" oninput="setSearch(this.value)" />
  <button id="btn-csv" class="ghost" onclick="exportCSV()">CSV</button>
  <button id="btn-undo" class="ghost" onclick="undo()">Deshacer</button>
  <button id="btn-exp-liq" class="ghost" onclick="liquidationCSV()">Liquidación</button>
  <button id="btn-export" class="ghost">Exportar</button>
  <label class="ghost file">Importar <input id="input-import" type="file" accept="application/json" hidden></label>
</header>
```

```css
/* styles.css — mejoras ligeras */
.topbar input#q{ flex:1; max-width: 30vw; background:#0e0f12; border:1px solid #333; color:var(--fg); padding:.35rem .5rem; border-radius:.5rem }
.chips{ display:flex; gap:.5rem; flex-wrap:wrap; margin:.5rem 0 }
.chip{ background:#222; color:var(--fg); border:1px solid #333; padding:.3rem .6rem; border-radius:999px; font-size:.9em }
.thumb{ width:48px; height:48px; object-fit:cover; border-radius:.5rem; border:1px solid #333 }
.badge.closed{ background:#442; color:#fbb }
```

---

## 10) Exportar CSV de movimientos (plantilla)

```js
function exportCSV(){
  const header = 'fecha_iso,tipo,scope,integrante,monto,moneda,fx,nota,categoria,tags,show';
  const rows = STATE.moves.map(m=>{
    const iso = new Date(m.ts||Date.now()).toISOString();
    const name = m.memberId ? memberName(m.memberId) : '';
    const nota = (m.note||'').replace(/"/g,'""');
    return `${iso},${m.kind},${m.scope},${name},${m.amount},${m.currency||'ARS'},${m.fx_rate||1},"${nota}","${m.category||'General'}","${(m.tags||[]).join(' ')}",${m.showId||''}`;
  });
  const blob = new Blob([ ['\uFEFF', header, ...rows].join('\n') ], {type:'text/csv;charset=utf-8'});
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `soup_tours_moves.csv`});
  a.click(); URL.revokeObjectURL(a.href);
}
```

---

## 11) Debug logs (Web DevTools)

Añadí un **logger** con grupos y tiempos para seguir mutaciones y errores.

```js
function log(evt, payload){ if(!DEBUG) return; console.groupCollapsed(`[SOUP] ${evt} @ ${new Date().toLocaleTimeString()}`); console.log(payload||'(sin payload)'); console.groupEnd(); }

// Ejemplos de uso
snapshot = (function(orig){ return function(){ if(DEBUG) log('snapshot(before)', STATE); orig.apply(this, arguments); if(DEBUG) log('snapshot(after)', {depth:LASTS?.length||0}); }; })(snapshot);

// En puntos críticos
try{ /* ... */ } catch(e){ console.error('[SOUP] Error:', e); alert('Ocurrió un error. Revisá la consola.'); }

// Redefinir save() con tracing
const _save = save; save = function(){ if(DEBUG) log('save', STATE); _save(); };
```

**Guía DevTools (Chrome):**

- *Preserve log* (✓) para no perder trazas en navegación.
- *Network* → *Offline* para test PWA (ver sección 13).
- *Application* → Local Storage/IndexedDB para inspeccionar datos.
- *Lighthouse* → medir PWA/Performance.

---

## 12) Pruebas (checklists + test harness)

### 12.1 Checklists manuales

- **Movimientos:** crear común/personal; editar; eliminar; deshacer x3.
- **Filtros y búsqueda:** combinar scope + integrante + #tag + texto.
- **Totales y categorías:** verificar sumas y totales por categoría.
- **Shows:** confirmar/realizar/cancelar; cerrar y bloquear carga; reabrir.
- **CSV:** abrir en Sheets y validar columnas/acentos.
- **Liquidación:** revisar prorrateo; verificar totales contra Caja.
- **Recibos:** adjuntar imagen y ver thumbnail; persistencia tras reload.

### 12.2 Test harness embebido (dev‑only)

```js
// app.js — al final del archivo
function assertEq(a,b,msg){ if(a!==b){ console.error('ASSERT FAIL:', msg, {a,b}); throw new Error(msg); } }
function runTests(){
  const st = JSON.parse(JSON.stringify(STATE));
  try{
    DEBUG=true; console.group('[TEST]');
    const before = STATE.moves.length;
    addMove('ingreso','comun',1000,'test',null,null,{category:'Merch',currency:'ARS',fx_rate:1});
    assertEq(STATE.moves.length, before+1, 'addMove should push');
    const id = STATE.moves[0].id; updateMove ? updateMove(id,{amount:2000}) : 0;
    assertEq(STATE.moves[0].amount, 2000, 'updateMove should patch');
    const t = totalsByCategory(STATE.moves.slice(0,1));
    assertEq(!!t['Merch'], true, 'totalsByCategory returns key');
    console.log('OK');
  } finally {
    STATE = st; save(); console.groupEnd(); render();
  }
}
// para ejecutar: en consola `runTests()`
```

---

## 13) PWA mínima (día 2)

### 13.1 `manifest.json`

```json
{
  "name": "SOUP Tours",
  "short_name": "SOUP Tours",
  "display": "standalone",
  "start_url": ".",
  "background_color": "#0b0b0c",
  "theme_color": "#15161a",
  "icons": [
    {"src":"icons/icon-192.png","sizes":"192x192","type":"image/png"},
    {"src":"icons/icon-512.png","sizes":"512x512","type":"image/png"}
  ]
}
```

### 13.2 `service-worker.js`

```js
const CACHE = 'soup-tours-v1';
const ASSETS = ['/', '/index.html','/styles.css','/app.js','/manifest.json'];
self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))); });
self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); });
self.addEventListener('fetch', e=>{ e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request))); });
```

### 13.3 `index.html` (hooks PWA)

```html
<link rel="manifest" href="manifest.json" />
<script>
if('serviceWorker' in navigator){ navigator.serviceWorker.register('service-worker.js'); }
</script>
```

**Tests PWA:**

- “Add to Home Screen” disponible.
- Modo *Offline* en DevTools → la app aún carga y funciona con datos locales.

---

## 14) Prompts rápidos para el agente IA

**A. Aplicar todo el V2 de este doc**

```
Implementá en app.js los bloques de: migración, categorías/tags/moneda, plantillas/quickActions, cierre/reapertura de show, liquidación CSV, undo stack 3 niveles, recibos y búsqueda por #tags; y en index.html/styles.css agregá los botones, inputs y estilos indicados. No agregues dependencias nuevas.
```

**B. Endurecer validaciones**

```
Agregá helper must(value,msg) y usalo en addShow/addMove. Si scope es personal exigir memberId; si fx_rate <= 0, bloquear; si currency tiene longitud != 3, normalizar a 3 letras.
```

**C. Telemetría de errores**

```
En DEBUG, logueá todas las mutaciones con console.groupCollapsed y payloads. En catch de import/export, mostrar alert y console.error con stack.
```

---

## 15) Criterios de aceptación (V2 completo)

- Migración automática de estados previos sin pérdidas.
- Filtro + búsqueda + tags operan combinados.
- Totales por categoría y equivalentes en moneda base correctos.
- Plantillas y acciones rápidas crean movimientos válidos.
- Cierre de show bloquea nuevos movimientos asociados; reapertura permite carga.
- CSV de liquidación y CSV de movimientos abren bien en Sheets.
- Undo con 3 niveles funciona en todas las mutaciones.
- Recibos se previsualizan y persisten en JSON exportado.
- PWA instala y carga *offline*.

