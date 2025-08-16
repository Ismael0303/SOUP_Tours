# SOUP Tours — Guía de construcción con pseudocódigo y prompts IA

> Meta: App mínima (3 pantallas, sin backend) para tu banda. Construcción en una sola sesión con un agente de IA.

---

## 1) Pseudocódigo general

```pseudo
inicializar estado desde LocalStorage o vacío

func addMember(nombre, rol):
    id = generarId()
    estado.band.members.push({id, nombre, rol})
    guardarEstado()

func addShow(fecha, ciudad, venue, estadoInicial, cache):
    id = generarId()
    estado.shows.push({id, fecha, ciudad, venue, state: estadoInicial, cache})
    guardarEstado()

func addMove(tipo, scope, memberId, monto, nota, showId):
    id = generarId()
    ts = fechaActualTimestamp()
    estado.moves.push({id, ts, kind: tipo, scope, memberId, amount: monto, note: nota, showId})
    guardarEstado()

func computeBalances():
    comun = suma(ingresos_comun) - suma(gastos_comun)
    personales = para cada miembro:
        suma(ingresos_personales) - suma(gastos_personales)
    return {comun, personales}

func exportar():
    descargarJSON(estado)

func importar(json):
    estado = parse(json)
    guardarEstado()
    render()
```

---

## 2) Template de código base

**index.html**

```html
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app"></div>
  <script src="app.js"></script>
</body>
</html>
```

**styles.css**

```css
body { font-family: sans-serif; margin: 0; }
button, input, select { font-size: 1rem; }
.tabbar { position: fixed; bottom: 0; width: 100%; display: flex; }
.tabbar button { flex: 1; padding: 1rem; }
```

**app.js**

```javascript
let state = cargarEstado();

function renderInicio() { /* mostrar saldos y próximos shows */ }
function renderShows() { /* lista y formulario */ }
function renderCaja() { /* movimientos */ }

function guardarEstado() { localStorage.setItem('soupTours', JSON.stringify(state)); }
function cargarEstado() { return JSON.parse(localStorage.getItem('soupTours')||'{"band": {"name":"","members":[]},"shows":[],"moves":[]}'); }

function generarId() { return Date.now().toString(36)+Math.random().toString(36).substr(2); }
```

---

## 3) Prompts para un agente IA

**Prompt 1 — Scaffold**

```
Crea tres archivos: index.html, styles.css, app.js.
- index.html: layout móvil con tres tabs (Inicio, Shows, Caja) y un botón flotante.
- styles.css: estilos simples, adaptados a móviles.
- app.js: inicializa estado, renderiza cada tab, persiste en LocalStorage.
```

**Prompt 2 — Funciones de datos**

```
Agrega en app.js funciones addMember, addShow, addMove, setShowState, computeBalances.
Cada función actualiza el estado y lo guarda en LocalStorage.
```

**Prompt 3 — UI mínima**

```
En app.js, implementa renderInicio, renderShows y renderCaja.
Usa DOM vanilla. Cada render limpia y reconstruye la vista.
Incluye formularios mínimos para alta de show y movimiento.
```

**Prompt 4 — Exportar/Importar**

```
Agrega botones para exportar estado a JSON y para importar desde archivo.
Usa FileReader para importar y descarga automática para exportar.
```

**Prompt 5 — Pruebas**

```
Carga datos de ejemplo y verifica que:
- Se muestran saldos correctos.
- Cambiar estado de un show actualiza la vista.
- Movimientos se reflejan en balances.
- Exportar/Importar conserva datos.
```

---

# 13) Guía para construirlo en **1 sesión** con IA

> Usa estos bloques como **prompts**, **pseudocódigo** y **templates**. Copia/pega en tu agente (ChatGPT/Cursor/Copilot/etc). Todo es **vanilla JS**, sin build.

## 13.1 Prompt maestro (pégalo primero)

```
Actuá como un Senior Frontend dev. Objetivo: construir en UNA SESIÓN una web-app móvil (index.html + styles.css + app.js) llamada "SOUP Tours" con 3 pantallas (Inicio, Shows, Caja), sin backend, datos en LocalStorage, exportar/importar JSON.

**Restricciones**:
- Sin frameworks ni bundlers. Solo HTML/CSS/JS.
- Optimizada para smartphone (tabs abajo, FAB, tipografías 16–18px).
- Accesible (44x44 touch, inputmode numeric, foco visible).
- Estado global en JS con persistencia inmediata.

**Entregables**:
1) index.html (estructura, tabs, modales)
2) styles.css (layout móvil simple)
3) app.js (modelo de datos, render, eventos, storage, export/import)
4) Datos seed para probar
5) Instrucciones para probar abriendo index.html

**Criterios de aceptación**:
- Crear banda, miembros, shows; registrar movimientos (ingreso/gasto, común/personal) y ver saldos.
- Cambiar estado de show (pendiente/confirmado/realizado/cancelado con motivo).
- Exportar/Importar JSON del estado completo.
- Recarga de página conserva datos.
```

## 13.2 Pseudocódigo del modelo y reglas

```pseudocode
STATE = {
  band: { name: string, members: [ {id, name, role} ] },
  shows: [ {id, date, city, venue?, state, cache?} ],
  moves: [ {id, ts, kind, scope, memberId?, amount, note?, showId?} ]
}

function loadState():
  json = localStorage.getItem('soup_tours')
  if json: STATE = parse(json) else: STATE = DEFAULT_STATE

function saveState():
  localStorage.setItem('soup_tours', stringify(STATE))

function addMember(name, role):
  STATE.band.members.push({ id: uid(), name, role })
  saveState(); render()

function addShow(date, city, venue, state='pendiente', cache=0):
  STATE.shows.push({ id: uid(), date, city, venue, state, cache })
  saveState(); render()

function setShowState(showId, newState, motivo?):
  show = findById(STATE.shows, showId)
  if show.state == 'realizado': return // inmutable hacia atrás
  if newState == 'cancelado' and not motivo: throw 'motivo requerido'
  show.state = newState; show.cancelReason = motivo
  saveState(); render()

function addMove(kind, scope, amount, note, memberId?, showId?):
  if scope == 'personal' and not memberId: throw 'memberId requerido'
  STATE.moves.unshift({ id: uid(), ts: now(), kind, scope, memberId, amount, note, showId })
  saveState(); render()

function computeBalances():
  comun = sum( moves where scope='comun' and kind='ingreso')
        - sum( moves where scope='comun' and kind='gasto' )
  personales = dict<memberId, number>
  for m in STATE.band.members:
    personales[m.id] = sum( moves where scope='personal' and memberId=m.id and kind='ingreso')
                      - sum( moves where scope='personal' and memberId=m.id and kind='gasto')
  return { comun, personales }

function exportJSON():
  download( JSON.stringify(STATE, null, 2), filenameWithDate() )

function importJSON(file):
  newState = JSON.parse(fileText)
  if isValid(newState): STATE = newState; saveState(); render()
```

## 13.3 Templates de código (copiar/pegar)

### a) `index.html`

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SOUP Tours</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="topbar">
    <h1 id="band-name">SOUP Tours</h1>
    <button id="btn-export" class="ghost">Exportar</button>
    <label class="ghost file">
      Importar <input id="input-import" type="file" accept="application/json" hidden>
    </label>
  </header>

  <main id="view">
    <!-- Vista se renderiza por JS: home|shows|cash -->
  </main>

  <button id="fab" class="fab" aria-label="Agregar">＋</button>

  <nav class="tabs">
    <button data-tab="home" class="active">Inicio</button>
    <button data-tab="shows">Shows</button>
    <button data-tab="cash">Caja</button>
  </nav>

  <!-- Modal genérico -->
  <dialog id="modal"></dialog>

  <script src="app.js"></script>
</body>
</html>
```

### b) `styles.css`

```css
:root { --bg:#0b0b0c; --card:#15161a; --fg:#eaeaea; --muted:#a0a0a0; --acc:#4ade80; }
*{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--fg);font:16px system-ui}
.topbar{display:flex;gap:.5rem;align-items:center;justify-content:space-between;padding:.75rem 1rem;background:#0f1013;position:sticky;top:0}
.ghost{background:transparent;border:1px solid #333;color:var(--fg);padding:.4rem .6rem;border-radius:.6rem}
.file{cursor:pointer}
#view{padding:1rem 1rem 5rem}
.card{background:var(--card);border-radius:1rem;padding:1rem;margin:.75rem 0;box-shadow:0 2px 10px rgba(0,0,0,.2)}
.list{display:flex;flex-direction:column;gap:.5rem}
.row{display:flex;justify-content:space-between;align-items:center;gap:.75rem}
.badge{padding:.2rem .5rem;border-radius:.5rem;background:#222;color:var(--muted)}
.amount{font-weight:700}
.tabs{position:fixed;bottom:0;left:0;right:0;background:#0f1013;display:flex}
.tabs>button{flex:1;padding:.8rem;border:none;background:transparent;color:var(--fg)}
.tabs>button.active{border-top:2px solid var(--acc)}
.fab{position:fixed;right:1rem;bottom:4.5rem;background:var(--acc);color:#051; border:none;border-radius:999px;width:56px;height:56px;font-size:28px}
input,select,button,textarea{font:inherit}
input[type="number"]{width:100%}
label{display:block;margin:.25rem 0}
.field{display:flex;flex-direction:column;gap:.25rem;margin:.5rem 0}
.btn{background:#2a2d34;border:none;color:var(--fg);padding:.6rem .9rem;border-radius:.6rem}
.btn.primary{background:var(--acc);color:#041}
:focus{outline:2px solid #5eead4;outline-offset:2px}
@media (min-width:720px){ body{font-size:18px} }
```

### c) `app.js`

```js
// ====== Estado y persistencia ======
const KEY = 'soup_tours';
const DEFAULT_STATE = {
  band: { name: 'SOUP', members: [{id:'u1', name:'Ismael', role:'voz/guitarra'}] },
  shows: [],
  moves: []
};
let STATE = load();

function load(){ try{ return JSON.parse(localStorage.getItem(KEY)) || DEFAULT_STATE } catch { return DEFAULT_STATE } }
function save(){ localStorage.setItem(KEY, JSON.stringify(STATE)) }
const uid = () => Math.random().toString(36).slice(2,9);

// ====== Cálculos ======
function balances(){
  const sum = (f)=>STATE.moves.filter(f).reduce((a,m)=>a+m.amount*(m.kind==='ingreso'?1:-1),0);
  const comun = sum(m=>m.scope==='comun');
  const per = {}; STATE.band.members.forEach(mm=>{
    per[mm.id] = sum(m=>m.scope==='personal' && m.memberId===mm.id);
  });
  return { comun, per };
}

// ====== Render ======
const view = document.getElementById('view');
const tabs = document.querySelectorAll('.tabs>button');
let currentTab = 'home';

tabs.forEach(b=>b.addEventListener('click',()=>{ currentTab=b.dataset.tab; tabs.forEach(t=>t.classList.toggle('active', t===b)); render(); }));

document.getElementById('fab').onclick = ()=>{
  if(currentTab==='shows') openShowForm(); else openMoveForm();
};

document.getElementById('btn-export').onclick = ()=>{
  const blob = new Blob([JSON.stringify(STATE,null,2)], {type:'application/json'});
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `soup_tours_${new Date().toISOString().slice(0,10)}.json`});
  a.click(); URL.revokeObjectURL(a.href);
};

document.getElementById('input-import').onchange = (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader(); reader.onload = ()=>{
    try{ const next = JSON.parse(reader.result);
      if(confirm('Reemplazar datos actuales?')){ STATE = next; save(); render(); }
    }catch{ alert('JSON inválido'); }
  }; reader.readAsText(file);
};

function render(){
  document.getElementById('band-name').textContent = STATE.band.name || 'SOUP Tours';
  if(currentTab==='home') return renderHome();
  if(currentTab==='shows') return renderShows();
  renderCash();
}

function renderHome(){
  const {comun, per} = balances();
  const chips = STATE.band.members.map(m=>`<span class="badge">${m.name}: $${(per[m.id]||0).toLocaleString()}</span>`).join(' ');
  const upcoming = STATE.shows.slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5)
    .map(s=>`<div class="row"><div>${s.date} • ${s.city} • ${s.venue||''}</div><span class="badge">${s.state}</span></div>`).join('');
  view.innerHTML = `
    <section class="card"><div class="row"><div>Fondo Común</div><div class="amount">$${comun.toLocaleString()}</div></div><div>${chips}</div></section>
    <section class="card"><h3>Próximos shows</h3><div class="list">${upcoming||'<em>Sin shows</em>'}</div></section>
    <section class="card"><h3>Miembros</h3>
      <div class="list">${STATE.band.members.map(m=>`<div class="row"><div>${m.name} • ${m.role||''}</div><button class="ghost" onclick="removeMember('${m.id}')">Quitar</button></div>`).join('')}</div>
      <button class="btn" onclick="openMemberForm()">+ Integrante</button>
    </section>`;
}

function renderShows(){
  const rows = STATE.shows.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(s=>`
    <div class="card">
      <div class="row"><div><strong>${s.date}</strong> • ${s.city} • ${s.venue||''}</div><span class="badge">${s.state}</span></div>
      <div class="row">
        <div>Cache: $${(s.cache||0).toLocaleString()}</div>
        <div class="row" style="gap:.5rem">
          <button class="ghost" onclick="setState('${s.id}','confirmado')">Confirmar</button>
          <button class="ghost" onclick="setState('${s.id}','realizado')">Realizado</button>
          <button class="ghost" onclick="cancelShow('${s.id}')">Cancelar</button>
        </div>
      </div>
    </div>`).join('');
  view.innerHTML = `<button class="btn" onclick="openShowForm()">+ Show</button>${rows || '<p class="card">Sin shows</p>'}`;
}

function renderCash(){
  const rows = STATE.moves.map(m=>`
    <div class="row"><div>${m.kind==='ingreso'?'↑':'↓'} $${m.amount.toLocaleString()} • ${m.scope}${m.memberId?` (${memberName(m.memberId)})`:''} • ${m.note||''}</div><div class="muted">${m.showId||''}</div></div>
  `).join('');
  view.innerHTML = `<button class="btn" onclick="openMoveForm()">+ Movimiento</button><div class="card list">${rows||'<em>Sin movimientos</em>'}</div>`;
}

// ====== Helpers UI ======
const modal = document.getElementById('modal');
function open(html){ modal.innerHTML = html; modal.showModal(); }
function close(){ modal.close(); }

function input(name, attrs='') { return `<div class="field"><label>${name}<input ${attrs}></label></div>` }

// ====== Formularios ======
function openMemberForm(){
  open(`
    <form method="dialog" class="card">
      <h3>Nuevo integrante</h3>
      ${input('Nombre','id="f-name" required')}
      ${input('Rol','id="f-role"')}
      <menu><button class="btn" value="cancel">Cancelar</button><button class="btn primary" value="default">Guardar</button></menu>
    </form>`);
  modal.addEventListener('close',()=>{
    if(modal.returnValue==='default'){
      addMember(document.getElementById('f-name').value, document.getElementById('f-role').value)
    }
  }, {once:true});
}

function openShowForm(){
  open(`
    <form method="dialog" class="card">
      <h3>Nuevo show</h3>
      ${input('Fecha','id="f-date" type="date" required')}
      ${input('Ciudad','id="f-city" required')}
      ${input('Venue','id="f-venue"')}
      ${input('Cache','id="f-cache" type="number" inputmode="numeric" min="0"')}
      <menu><button class="btn" value="cancel">Cancelar</button><button class="btn primary" value="default">Guardar</button></menu>
    </form>`);
  modal.addEventListener('close',()=>{
    if(modal.returnValue==='default'){
      addShow(
        document.getElementById('f-date').value,
        document.getElementById('f-city').value,
        document.getElementById('f-venue').value,
        'pendiente',
        Number(document.getElementById('f-cache').value||0)
      )
    }
  }, {once:true});
}

function openMoveForm(){
  const memberOpts = STATE.band.members.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
  const showOpts = ['<option value="">(ninguno)</option>'].concat(STATE.shows.map(s=>`<option value="${s.id}">${s.date} ${s.city}</option>`)).join('');
  open(`
    <form method="dialog" class="card">
      <h3>Nuevo movimiento</h3>
      <div class="field"><label>Tipo<select id="f-kind"><option value="ingreso">Ingreso</option><option value="gasto">Gasto</option></select></label></div>
      <div class="field"><label>Alcance<select id="f-scope"><option value="comun">Común</option><option value="personal">Personal</option></select></label></div>
      <div class="field" id="f-member-wrap" style="display:none"><label>Integrante<select id="f-member">${memberOpts}</select></label></div>
      ${input('Monto','id="f-amount" type="number" inputmode="numeric" min="1" required')}
      ${input('Nota','id="f-note"')}
      <div class="field"><label>Show<select id="f-show">${showOpts}</select></label></div>
      <menu><button class="btn" value="cancel">Cancelar</button><button class="btn primary" value="default">Guardar</button></menu>
    </form>`);
  const scopeSel = document.getElementById('f-scope');
  const wrap = document.getElementById('f-member-wrap');
  scopeSel.onchange = ()=> wrap.style.display = scopeSel.value==='personal' ? 'block' : 'none';
  scopeSel.onchange();
  modal.addEventListener('close',()=>{
    if(modal.returnValue==='default'){
      const scope = document.getElementById('f-scope').value;
      const memberId = scope==='personal' ? document.getElementById('f-member').value : null;
      addMove(
        document.getElementById('f-kind').value,
        scope,
        Number(document.getElementById('f-amount').value),
        document.getElementById('f-note').value,
        memberId,
        document.getElementById('f-show').value || null
      )
    }
  }, {once:true});
}

// ====== Acciones ======
function removeMember(id){ STATE.band.members = STATE.band.members.filter(m=>m.id!==id); save(); render(); }
function addMember(name, role){ STATE.band.members.push({id:uid(), name, role}); save(); render(); }
function addShow(date, city, venue, state='pendiente', cache=0){ STATE.shows.push({id:uid(), date, city, venue, state, cache}); save(); render(); }
function setState(id, newState){ const s=STATE.shows.find(s=>s.id===id); if(!s) return; if(s.state==='realizado') return; s.state=newState; save(); render(); }
function cancelShow(id){ const motivo = prompt('Motivo de cancelación'); if(!motivo) return; const s=STATE.shows.find(s=>s.id===id); if(!s) return; s.state='cancelado'; s.cancelReason=motivo; save(); render(); }
function addMove(kind, scope, amount, note, memberId, showId){ if(scope==='personal' && !memberId) return alert('Elegí integrante'); STATE.moves.unshift({id:uid(), ts:Date.now(), kind, scope, memberId, amount, note, showId}); save(); render(); }
const memberName = id => (STATE.band.members.find(m=>m.id===id)||{}).name || '—';

// ====== Init ======
render();
```

## 13.4 Prompts de iteración rápida (copiar según necesidad)

**A. Agregar filtros en Caja**

```
Agregá en la vista Caja chips de filtro: Todos | Común | Personal | [por cada integrante]. Cuando un chip está activo, filtra STATE.moves antes de renderizar. Mantener estado del filtro en memoria.
```

**B. Validaciones mínimas**

```
Agregar validación visual en formularios: si falta un requerido, mostrar borde rojo y toast "Completa los campos obligatorios". Evitar agregar librerías.
```

**C. IndexedDB (opcional)**

```
Reemplazar LocalStorage por IndexedDB usando la API nativa (sin librerías). Crear objectStore 'state' con clave fija 'root'. Implementar getState/setState async y adaptar render() con await inicial.
```

**D. PWA (día 2)**

```
Convertir a PWA ligera: manifest.json, service worker para cache estático y offline. No incluir push. Criterio: app carga sin red y persiste datos.
```

## 13.5 Checklist de verificación (antes de cerrar la sesión)

- Crea yejecuta tests de validación para todas las funciones

## 13.6 Instrucciones para correr

1. Guardar los tres archivos en una carpeta.
2. Abrir `index.html` en el navegador del teléfono o PC.
3. (Opcional) Servir con `npx serve` y abrir la URL en el móvil.

