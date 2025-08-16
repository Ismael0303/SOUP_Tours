# SOUP Tours — Actualización v6 (Funciones de gira)

> Paquete de **funciones nuevas** para giras, manteniendo el stack **vanilla JS + HTML + CSS**, sin dependencias. Incluye **templates de código**, **tests** y **debug logs** para robustecer.

---

## 0) Principios

- **Sin librerías**: sólo APIs nativas del navegador.
- **Móvil primero**: UI táctil, sin scroll lateral, 16–18px.
- **Compatibilidad**: migraciones no rompen backups viejos.
- **Debug activable** con `DEBUG=true` (consola agrupada + timestamps).

```js
// app.js (boot)
let DEBUG = true;
function log(evt, payload){ if(!DEBUG) return; console.groupCollapsed(`[SOUP] ${evt} @ ${new Date().toLocaleTimeString()}`); console.log(payload||'(sin payload)'); console.groupEnd(); }
```

---

## 1) Logística de gira (mapa + tiempos + checklist)

### 1.1 Ubicaciones y mapa (sin libs)

- Guardar `lat,lng` en cada show.
- Mostrar un **iframe** de OpenStreetMap con `bbox` centrado en la ciudad.

```js
// Modelo: shows[].lat, shows[].lng (opcionales)
function mapURL(lat,lng){
  const z=14; return `https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.02}%2C${lat-0.02}%2C${lng+0.02}%2C${lat+0.02}&layer=mapnik&marker=${lat}%2C${lng}`;
}
function renderShowMap(s){
  if(!(s.lat&&s.lng)) return '<em>Sin coordenadas</em>';
  return `<iframe title="Mapa" width="100%" height="220" style="border:0;border-radius:12px" src="${mapURL(s.lat,s.lng)}"></iframe>`;
}
```

**Formulario de show** (campos nuevos):

```html
<div class="row" style="gap:.5rem">
  <div class="field" style="flex:1"><label>Lat<input id="f-lat" type="number" step="0.000001"></label></div>
  <div class="field" style="flex:1"><label>Lng<input id="f-lng" type="number" step="0.000001"></label></div>
</div>
```

### 1.2 Tiempos y costos estimados

- **Haversine** + **velocidad promedio** (ej. 80 km/h).
- Combustible: `litros = (dist * consumo)/100`; `costo = litros * precio_litro`.

```js
function kmDistance(a,b){ const R=6371, toRad=x=>x*Math.PI/180; const dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng); const s1=Math.sin(dLat/2), s2=Math.sin(dLng/2); const zz = s1*s1 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*s2*s2; return 2*R*Math.asin(Math.sqrt(zz)); }
function travelEstimate(fromShowId, toShowId, vKmH=80, consumo=10, precio=1000){
  const A=STATE.shows.find(s=>s.id===fromShowId), B=STATE.shows.find(s=>s.id===toShowId);
  if(!A||!B||!(A.lat&&A.lng&&B.lat&&B.lng)) return null;
  const km = kmDistance({lat:A.lat,lng:A.lng},{lat:B.lat,lng:B.lng});
  const horas = km / vKmH; const litros = km * (consumo/100); const costo = litros * precio;
  return { km: Math.round(km), horas: +horas.toFixed(2), costo: Math.round(costo) };
}
```

**UI**: en `renderShows()`, botón "Ruta" entre dos shows seleccionados → muestra estimaciones.

### 1.3 Checklist por show

```js
// shows[].checklist: [{id,text,done}]
function addChecklistItem(showId, text){ mutateState(()=>{
  const s=STATE.shows.find(x=>x.id===showId); s.checklist=s.checklist||[]; s.checklist.push({id:uid(), text, done:false});
}); }
function toggleChecklist(showId, itemId){ mutateState(()=>{
  const s=STATE.shows.find(x=>x.id===showId); const it=s.checklist.find(i=>i.id===itemId); if(it) it.done=!it.done;
}); }
```

**HTML** (dentro del detalle de show):

```html
<section class="card"><h3>Checklist</h3>
  <div id="clist">(render de items)</div>
  <div class="row"><input id="cl-new" placeholder="Agregar tarea…"><button class="btn" onclick="addChecklistItem('$ID', document.getElementById('cl-new').value)">+ Agregar</button></div>
</section>
```

---

## 2) Merch avanzado (variantes + ventas rápidas)

### 2.1 Modelo

```js
// productos: variantes por talla/color/costo
STATE.merch = STATE.merch || { products: [], stock: [], sales: [] };
// products: {id, name, price, variants:[{id, size, color, cost}]}
// stock: {id, productId, variantId, qty}
// sales: {id, ts, items:[{productId, variantId, qty, price}]}
```

### 2.2 Alta y stock

```js
function addProduct(name, price){ mutateState(()=> STATE.merch.products.push({id:uid(), name, price:Number(price), variants:[]})); }
function addVariant(prodId, size, color, cost){ mutateState(()=>{
  const p=STATE.merch.products.find(p=>p.id===prodId); p.variants.push({id:uid(), size, color, cost:Number(cost)});
}); }
function addStock(prodId, varId, qty){ mutateState(()=> STATE.merch.stock.push({id:uid(), productId:prodId, variantId:varId, qty:Number(qty)})); }
```

### 2.3 Venta rápida y descuento de stock

```js
function stockQty(varId){ return STATE.merch.stock.filter(s=>s.variantId===varId).reduce((a,s)=>a+s.qty,0); }
function sell(items){ // items: [{variantId, qty}]
  mutateState(()=>{
    const sale={id:uid(), ts:Date.now(), items:[]};
    for(const it of items){
      const pVar = findVariant(it.variantId); const price = pVar ? findProductByVar(it.variantId).price : 0;
      sale.items.push({productId: findProductByVar(it.variantId).id, variantId: it.variantId, qty: it.qty, price});
      // descontar stock (FIFO simple)
      let rest = it.qty; for(const lot of STATE.merch.stock.filter(s=>s.variantId===it.variantId)){
        const take = Math.min(lot.qty, rest); lot.qty -= take; rest -= take; if(rest<=0) break;
      }
    }
    STATE.merch.sales.unshift(sale);
  });
}
function findProductByVar(variantId){ return STATE.merch.products.find(p=>p.variants.some(v=>v.id===variantId)); }
function findVariant(variantId){ const p=findProductByVar(variantId); return p?.variants.find(v=>v.id===variantId); }
```

**UI**: grilla simple por producto con botones `-1 / +1` por variante.

---

## 3) Tareas y recordatorios (ligero)

### 3.1 Tareas

```js
STATE.tasks = STATE.tasks || []; // {id, text, dueAt?, assigneeId?, done}
function addTask(text, dueAt=null, assigneeId=null){ mutateState(()=> STATE.tasks.push({id:uid(), text, dueAt, assigneeId, done:false})); }
function toggleTask(id){ mutateState(()=>{ const t=STATE.tasks.find(x=>x.id===id); if(t) t.done=!t.done; }); }
```

### 3.2 Recordatorios (Notifications API)

- Pedir permiso al abrir Ajustes.
- Programar con `setTimeout` (mientras la app esté abierta).

```js
async function enableNotifs(){ if(!('Notification' in window)) return alert('Sin soporte'); const perm = await Notification.requestPermission(); if(perm!=='granted') alert('Notificaciones denegadas'); }
function remindTask(task){ if(Notification.permission==='granted') new Notification('SOUP Tours', { body: task.text }); }
function scheduleReminder(task){ if(!task.dueAt) return; const ms = new Date(task.dueAt) - Date.now(); if(ms>0) setTimeout(()=> remindTask(task), ms); }
```

---

## 4) Reportes y análisis (canvas + print)

### 4.1 Serie de tiempo (ingresos vs gastos)

```html
<canvas id="chart-cash" width="600" height="240"></canvas>
```

```js
function seriesByDay(){
  const by = {}; for(const m of STATE.moves){ const d=new Date(m.ts).toISOString().slice(0,10); by[d]=by[d]||{inc:0, gas:0}; if(m.kind==='ingreso') by[d].inc+=m.amount; else by[d].gas+=m.amount; }
  return Object.entries(by).sort(([a],[b])=>a.localeCompare(b)).map(([d,v])=>({d, ...v}));
}
function renderChart(){
  const ctx=document.getElementById('chart-cash').getContext('2d'); const data=seriesByDay();
  const W=ctx.canvas.width, H=ctx.canvas.height, pad=24; ctx.clearRect(0,0,W,H);
  const max = Math.max(1, ...data.flatMap(x=>[x.inc,x.gas]));
  const x=(i)=> pad + i*( (W-2*pad)/Math.max(1,data.length-1) );
  const y=(v)=> H-pad - (v/max)*(H-2*pad);
  ctx.fillStyle='#eaeaea'; ctx.font='12px system-ui';
  // ejes
  ctx.strokeStyle='#333'; ctx.beginPath(); ctx.moveTo(pad,pad); ctx.lineTo(pad,H-pad); ctx.lineTo(W-pad,H-pad); ctx.stroke();
  // lineas ingreso/gasto
  ctx.strokeStyle='#22c55e'; ctx.beginPath(); data.forEach((p,i)=>{ const X=x(i), Y=y(p.inc); i?ctx.lineTo(X,Y):ctx.moveTo(X,Y); }); ctx.stroke();
  ctx.strokeStyle='#ef4444'; ctx.beginPath(); data.forEach((p,i)=>{ const X=x(i), Y=y(p.gas); i?ctx.lineTo(X,Y):ctx.moveTo(X,Y); }); ctx.stroke();
}
```

### 4.2 Print nativo a PDF

```js
function printReport(){ window.print(); }
```

---

## 5) Contactos y proveedores

```js
STATE.contacts = STATE.contacts || []; // {id, name, role, phone?, email?, notes?}
function addContact(name, role, phone='', email='', notes=''){ mutateState(()=> STATE.contacts.push({id:uid(), name, role, phone, email, notes})); }
function findContacts(q){ q=(q||'').toLowerCase(); return STATE.contacts.filter(c=>[c.name,c.role,c.phone,c.email,c.notes].join(' ').toLowerCase().includes(q)); }
```

**Asociar contacto a show**: `shows[].contactIds: string[]`.

---

## 6) Modo offline robusto (IndexedDB opcional)

- Guardar **imágenes** (recibos) y estados grandes en **IndexedDB**.
- API nativa: `indexedDB.open('soup',1)`; objectStore `files` con `keyPath:'id'`.

```js
// Módulo mínimo de archivos
const DB_NAME='soup', DB_STORE='files';
function dbOpen(){ return new Promise((res,rej)=>{ const r=indexedDB.open(DB_NAME,1); r.onupgradeneeded=()=> r.result.createObjectStore(DB_STORE,{keyPath:'id'}); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function filePut(id, blob){ const db=await dbOpen(); return new Promise((res,rej)=>{ const tx=db.transaction(DB_STORE,'readwrite'); tx.objectStore(DB_STORE).put({id, blob}); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); }); }
async function fileGet(id){ const db=await dbOpen(); return new Promise((res,rej)=>{ const tx=db.transaction(DB_STORE); const g=tx.objectStore(DB_STORE).get(id); g.onsuccess=()=>res(g.result?.blob||null); g.onerror=()=>rej(g.error); }); }
```

---

## 7) Migración de datos (versión v6)

```js
const CURRENT_VERSION = 6;
function migrate(state){
  state.version ||= 1;
  if(state.version < 6){
    state.shows = (state.shows||[]).map(s=>({ checklist:[], ...s }));
    state.merch = state.merch || { products:[], stock:[], sales:[] };
    state.tasks = state.tasks || [];
    state.contacts = state.contacts || [];
    state.version = 6;
  }
  return state;
}
```

---

## 8) Tests (harness + checklists)

### 8.1 Harness embebido

```js
function assert(cond,msg){ if(!cond){ console.error('ASSERT FAIL:',msg); throw new Error(msg);} }
function runV6Tests(){
  const snap = JSON.stringify(STATE);
  try{
    console.group('[TEST v6]');
    // Logística
    STATE.shows.push({id:'a', date:'2025-09-01', city:'C1', lat:-31.4, lng:-64.2});
    STATE.shows.push({id:'b', date:'2025-09-02', city:'C2', lat:-31.6, lng:-63.9});
    const est = travelEstimate('a','b'); assert(est&&est.km>0,'travelEstimate');
    addChecklistItem('a','Cargar merch'); toggleChecklist('a', STATE.shows[0].checklist[0].id);
    assert(STATE.shows[0].checklist[0].done===true,'checklist toggle');

    // Merch
    addProduct('Remera',5000); const p=STATE.merch.products[0]; addVariant(p.id,'M','Negra',2000);
    const v=p.variants[0]; addStock(p.id, v.id, 10); sell([{variantId:v.id, qty:3}]);
    assert(stockQty(v.id)===7,'stock after sell');

    // Tareas
    addTask('Llamar a prensa', new Date(Date.now()+1000).toISOString(), null); assert(STATE.tasks.length>0,'task add');

    // Contactos
    addContact('Juan Sonido','Sonido','123','',''); assert(findContacts('sonido').length===1,'contact search');

    console.log('OK v6');
  } finally { STATE = JSON.parse(snap); save(); console.groupEnd(); render(); }
}
```

### 8.2 Checklists manuales

-

---

## 9) Debug logs (puntos clave)

```js
// Al vender
log('merch.sell', {items, stock:STATE.merch.stock});
// Al estimar viaje
log('travel.estimate', {from:fromShowId, to:toShowId, est});
// Al crear tarea y programar recordatorio
log('task.add', {task}); log('task.schedule', {ms});
// Al guardar/leer archivo en IndexedDB
log('idb.put', {id}); log('idb.get', {id});
```

---

## 10) Prompts para el agente de IA

**A. Aplicar v6 completo**

```
Implementá las secciones 1–7 en app.js (modelo, funciones y UI mínima), agregá los campos nuevos en los formularios de show y merch, y asegurá la migración a version 6. Incluí el harness runV6Tests() y los debug logs. Sin dependencias.
```

**B. Añadir reporte con canvas**

```
Pegá los snippets de renderChart() y seriesByDay(); agregá <canvas id="chart-cash"> en la vista de reportes y un botón "Imprimir" que llame a printReport().
```

**C. IndexedDB para recibos**

```
Insertá el módulo filePut/fileGet y usalo al adjuntar/mostrar recibos de movimientos grandes. Dejá LocalStorage para el resto del estado.
```

---

## 11) Criterios de aceptación

- Migración automática a `version: 6` sin pérdida de datos.
- Mapa visible si el show tiene lat/lng; estimador de viaje arrojando valores razonables.
- Checklist por show funcional y persistente.
- Merch con variantes: stock descuenta en ventas rápidas.
- Tareas con toggle y recordatorios básicos.
- Reporte canvas renderiza y `window.print()` genera PDF.
- Contactos buscables por nombre/rol/nota.
- Tests `runV6Tests()` pasan sin romper el estado real.
- Debug logs útiles para diagnosticar flujos clave.

