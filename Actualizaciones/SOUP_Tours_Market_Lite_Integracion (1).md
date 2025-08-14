
# SOUP Tours — **Integración Market Lite (en 1 sesión)**

> Documento operativo para integrar **Inventario y Ventas de Merch** en SOUP Tours (vanilla JS, sin dependencias). Incluye **migraciones**, **funciones**, **UI**, **merge**, **export**, **tests** y **debug logs**. Copiá/pegá los bloques en tu `app.js`, `index.html` y `styles.css`.  
> Requisitos previos: tu `app.js` actual (el que compartiste), con `migrate`, `mutateState`, `stampNew/Update`, `mergeState`, `render*`, `open/close`, `toast`, etc.

---

## 0) Resumen de alcance
- **Nuevo modelo:** `products[]` (inventario) y `sales[]` (ventas).
- **Funciones:** CRUD de productos; `addSale()` que descuenta stock y crea movimiento financiero.
- **UI:** pestaña **Merch**, modales **Producto** y **Venta**, resumen por **Show**.
- **Compatibilidad:** export/import/merge LWW incluidos.
- **Pruebas y debug:** `runMarketTests()` + logs `console.groupCollapsed` en puntos críticos.

---

## 1) Cambios de modelo (migración ligera)

🔧 **Pegá dentro de** `function migrate(state){ ... }` **antes del** `return state;`

```js
// ====== MARKET LITE: migración ======
state.products ||= []; // [{id,name,variant,price,photoDataUrl,stock,eventId,createdAt,updatedAt,originId,deletedAt}]
state.sales ||= [];    // [{id,productId,qty,price,method,eventId,createdAt,updatedAt,originId,deletedAt}]
```

**Notas:**
- `eventId` es opcional (para control por show). Si no se indica, el stock es general.
- `photoDataUrl` permite guardar una mini foto del producto (como recibos).

---

## 2) Merge LWW y Export/Import

🔧 **Pegá dentro de** `function mergeState(local, incoming){ return { ... } }`

```js
// ====== MARKET LITE: merge ======
products: mergeArrays(local.products||[], incoming.products||[]),
sales: mergeArrays(local.sales||[], incoming.sales||[]),
```

> **Export/Import JSON** ya funcionan porque guardan/restauran `STATE` completo; con lo anterior, `products` y `sales` también se fusionan.

---

## 3) Funciones de Inventario y Ventas

🔧 **Pegá en zona de Acciones** (cerca de `addMove`, `updateMove`, etc.). Incluye trazas DEBUG.

```js
// ====== MARKET LITE: helpers ======
function findProduct(id){ return STATE.products.find(p=>p.id===id); }
function salesByEvent(eventId){ return alive(STATE.sales).filter(s=>s.eventId===eventId); }
function totalSalesAmountByEvent(eventId){
  return salesByEvent(eventId).reduce((a,s)=> a + (s.price * s.qty), 0);
}

// ====== MARKET LITE: Productos ======
function addProduct(data){
  if(DEBUG) console.groupCollapsed('[Market] addProduct'); console.log(data);
  mutateState(()=> STATE.products.push(stampNew({id:uid('p_'), stock:0, ...data})));
  if(DEBUG) console.groupEnd();
}
function updateProduct(id, patch){
  if(DEBUG) console.groupCollapsed('[Market] updateProduct'); console.log({id, patch});
  mutateState(()=>{
    const i = STATE.products.findIndex(p=>p.id===id);
    if(i!==-1) STATE.products[i] = stampUpdate(STATE.products[i], patch);
  });
  if(DEBUG) console.groupEnd();
}
function deleteProduct(id){
  if(!confirm('¿Eliminar producto?')) return;
  if(DEBUG) console.groupCollapsed('[Market] deleteProduct'); console.log({id});
  mutateState(()=>{
    const i = STATE.products.findIndex(p=>p.id===id);
    if(i!==-1) STATE.products[i] = markDeleted(STATE.products[i]);
  });
  if(DEBUG) console.groupEnd();
}

// ====== MARKET LITE: Ventas ======
function addSale(data){
  // data: {productId, qty, price, method, eventId}
  const prod = findProduct(data.productId);
  if(!prod) return toast('Producto inválido');
  const qty = Number(data.qty||0); if(qty<=0) return toast('Cantidad inválida');
  const price = Number(data.price||0); if(price<0) return toast('Precio inválido');

  if(DEBUG) console.groupCollapsed('[Market] addSale');
  console.log({data, prod_before: {...prod}});

  mutateState(()=>{
    // 1) Registrar venta
    const sale = stampNew({id:uid('s_'), createdAt: nowIso(), ...data, price, qty});
    STATE.sales.unshift(sale);

    // 2) Descontar stock
    const p = findProduct(sale.productId);
    if(p){ p.stock = Math.max(0, Number(p.stock||0) - qty); }

    // 3) Crear movimiento financiero (ingreso comun)
    const note = `Venta ${p?.name||''}${p?.variant?` (${p.variant})`:''}`.trim();
    addMove('ingreso','comun', price * qty, note, null, sale.eventId, {category:'Merch'});
  });

  if(DEBUG) console.log({prod_after: {...findProduct(data.productId)}});
  if(DEBUG) console.groupEnd();
  toast('Venta registrada', 'success');
}
```

---

## 4) UI — Formularios y nuevas pantallas

### 4.1 Formularios modales

🔧 **Pegá estas funciones cerca de** `openShowForm` y `openMoveForm`:

```js
function openProductForm(id){
  const prod = id ? findProduct(id) : {};
  const title = id ? 'Editar producto' : 'Nuevo producto';

  const showOpts = ['<option value="">(stock general)</option>']
    .concat(alive(STATE.shows).map(s=>`<option value="${s.id}" ${prod?.eventId===s.id?'selected':''}>${dayjs(s.date).format('DD/MM/YY')} ${s.city}</option>`)).join('');

  open(`<form method="dialog" class="card">
    <h3>${title}</h3>
    <div class="field"><label>Nombre<input id="f-name" required value="${prod?.name||''}"></label></div>
    <div class="field"><label>Variante/Talle<input id="f-var" value="${prod?.variant||''}"></label></div>
    <div class="row" style="gap:.5rem">
      <div class="field" style="flex:1"><label>Precio<input id="f-price" type="number" min="0" required value="${prod?.price||0}"></label></div>
      <div class="field" style="flex:1"><label>Stock<input id="f-stock" type="number" min="0" value="${prod?.stock||0}"></label></div>
    </div>
    <div class="field"><label>Stock asociado a show<select id="f-event">${showOpts}</select></label></div>
    <div class="field"><label>Foto<input id="f-photo" type="file" accept="image/*" capture="environment"></label></div>
    <menu><button class="btn" value="cancel">Cancelar</button><button class="btn primary" value="default">Guardar</button></menu>
  </form>`);

  modal.addEventListener('close', ()=>{
    if(modal.returnValue!=='default') return;
    const name = document.getElementById('f-name').value.trim();
    if(!name) return toast('El nombre es obligatorio.');
    const variant = document.getElementById('f-var').value.trim();
    const price = Number(document.getElementById('f-price').value||0);
    const stock = Number(document.getElementById('f-stock').value||0);
    const eventId = document.getElementById('f-event').value||null;
    const file = document.getElementById('f-photo').files?.[0];

    if(file){
      const r=new FileReader();
      r.onload = () => id
        ? updateProduct(id, {name, variant, price, stock, eventId, photoDataUrl:r.result})
        : addProduct({name, variant, price, stock, eventId, photoDataUrl:r.result});
      r.readAsDataURL(file);
    } else {
      id ? updateProduct(id, {name, variant, price, stock, eventId})
         : addProduct({name, variant, price, stock, eventId});
    }
  }, {once:true});
}

function openSaleForm(productId=null, eventId=null){
  const prods = alive(STATE.products);
  if(!prods.length) return toast('Primero agregá un producto.');
  const prodOpts = prods.map(p=>`<option value="${p.id}" ${productId===p.id?'selected':''}>${p.name}${p.variant?` (${p.variant})`:''}</option>`).join('');
  const showOpts = ['<option value="">(sin show)</option>']
    .concat(alive(STATE.shows).map(s=>`<option value="${s.id}" ${eventId===s.id?'selected':''}>${dayjs(s.date).format('DD/MM/YY')} ${s.city}</option>`)).join('');

  open(`<form method="dialog" class="card">
    <h3>Nueva venta</h3>
    <div class="field"><label>Producto<select id="f-prod">${prodOpts}</select></label></div>
    <div class="row" style="gap:.5rem">
      <div class="field" style="flex:1"><label>Cantidad<input id="f-qty" type="number" min="1" value="1"></label></div>
      <div class="field" style="flex:1"><label>Precio unitario<input id="f-price" type="number" min="0" value="${findProduct(productId||prods[0].id)?.price||0}"></label></div>
    </div>
    <div class="field"><label>Método<select id="f-method"><option>efectivo</option><option>QR</option><option>link</option></select></label></div>
    <div class="field"><label>Show<select id="f-event">${showOpts}</select></label></div>
    <menu><button class="btn" value="cancel">Cancelar</button><button class="btn primary" value="default">Guardar</button></menu>
  </form>`);

  modal.addEventListener('close', ()=>{
    if(modal.returnValue!=='default') return;
    const productId = document.getElementById('f-prod').value;
    const qty = Number(document.getElementById('f-qty').value||1);
    const price = Number(document.getElementById('f-price').value||0);
    const method = document.getElementById('f-method').value;
    const eventId = document.getElementById('f-event').value || null;
    addSale({productId, qty, price, method, eventId});
  }, {once:true});
}
```

### 4.2 Pestaña “Merch” (lista y acciones)

🔧 **Añadí una pestaña** en tu `index.html` (tabs). Después, en `app.js`, **pegá**:

```js
function renderMerch(){
  if(DEBUG) console.log('renderMerch');
  const prods = alive(STATE.products).sort((a,b)=> (a.name||'').localeCompare(b.name||''));
  const rows = prods.map(p=>`
    <div class="card">
      <div class="row">
        <div>
          <strong>${p.name}</strong> ${p.variant?`• ${p.variant}`:''}<br>
          <small class="muted">Precio: ${p.price?.toLocaleString() || 0} • Stock: ${Number(p.stock||0)}</small>
        </div>
        <div class="row" style="gap:.5rem">
          <button class="ghost" onclick="openSaleForm('${p.id}', null)">Vender</button>
          <button class="ghost" onclick="openProductForm('${p.id}')">Editar</button>
          <button class="ghost" onclick="deleteProduct('${p.id}')">Eliminar</button>
        </div>
      </div>
    </div>
  `).join('');
  view.innerHTML = `<button class="btn" onclick="openProductForm()">+ Producto</button>${rows || '<p class="card">Sin productos</p>'}`;
}
```

🔧 **Hook en router de tabs** (donde hacés `if(currentTab==='home') ...`):  
Agregá una línea:

```js
if(currentTab==='merch') return renderMerch();
```

### 4.3 Resumen de Merch por Show

🔧 **Dentro de `renderShows()`**, agregá al markup de cada show:

```js
<div class="row">
  <div>Ventas merch: ${totalSalesAmountByEvent(s.id).toLocaleString()}</div>
  <button class="ghost" onclick="openSaleForm(null, '${s.id}')">+ Venta</button>
</div>
```

> Esto permite registrar ventas vinculadas al show y ver el total por evento.

---

## 5) Export CSV (opcional) — Ventas

🔧 **Función opcional para CSV de ventas**:

```js
function exportSalesCSV(){
  try{
    const header = 'fecha_iso,evento,producto,variante,cantidad,precio_unitario,metodo,total';
    const rows = alive(STATE.sales).map(s=>{
      const p = findProduct(s.productId)||{};
      const show = s.eventId ? STATE.shows.find(x=>x.id===s.eventId) : null;
      const iso = s.createdAt || new Date().toISOString();
      const tot = (s.price||0) * (s.qty||0);
      return [iso, show?`${dayjs(show.date).format('YYYY-MM-DD')} ${show.city}`:'', p.name||'', p.variant||'', s.qty||0, s.price||0, s.method||'', tot].join(',');
    });
    const blob = new Blob([ ['\uFEFF', header, ...rows].join('\n') ], {type:'text/csv;charset=utf-8'});
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `soup_tours_sales.csv`});
    a.click(); URL.revokeObjectURL(a.href);
    toast('CSV de ventas exportado', 'success');
  }catch(e){ console.error('[SOUP] Error export sales CSV:', e); alert('Error exportando ventas.'); }
}
```

Podés agregar un botón en la topbar para llamar a `exportSalesCSV()`.

---

## 6) Tests y Debug

🔧 **Pegá al final del archivo** (cerca de `runTests()`):

```js
function runMarketTests(){
  console.group('[TEST] Market Lite');
  const st = JSON.parse(JSON.stringify(STATE));
  try{
    DEBUG = true;

    // 1) Crear producto
    addProduct({name:'Remera SOUP', variant:'M', price:10000, stock:10});
    const p = STATE.products.find(x=>x.name==='Remera SOUP' && x.variant==='M');
    console.assert(!!p, 'Producto no creado');

    // 2) Registrar venta de 2 unidades
    addSale({productId:p.id, qty:2, price:10000, method:'efectivo', eventId:null});
    const sOK = STATE.sales.find(s=>s.productId===p.id && s.qty===2);
    console.assert(!!sOK, 'Venta no registrada');

    // 3) Verificar descuento de stock
    console.assert((findProduct(p.id).stock||0) === 8, 'Stock no descontado correctamente');

    // 4) Verificar que se creó movimiento de ingreso
    const mv = STATE.moves.find(m=>m.note?.includes('Remera SOUP'));
    console.assert(!!mv && mv.kind==='ingreso' && mv.scope==='comun', 'Movimiento no creado correctamente');

    // 5) Merge: simular otro estado con update más nuevo
    const other = JSON.parse(JSON.stringify(STATE));
    other.products[0] = {...other.products[0], price:12000, updatedAt: new Date(Date.now()+2000).toISOString()};
    const merged = mergeState(STATE, other);
    console.assert(merged.products[0].price===12000, 'Merge LWW productos falló');

    console.log('OK Market Lite');
    toast('Tests Market Lite OK', 'success');
  }catch(e){
    console.error('Fallo test Market Lite', e);
    alert('Fallo test Market Lite - ver consola');
  }finally{
    STATE = st; save(); render();
    console.groupEnd();
  }
}
```

> Ejecutá `runMarketTests()` desde la consola para validar el módulo en segundos.

---

## 7) Estilos mínimos (opcional)

🔧 **En `styles.css`** (si necesitás pequeños ajustes):

```css
/* MARKET LITE */
.card .row .ghost { white-space: nowrap; }
```

---

## 8) Checklist de aceptación (QA en 15 minutos)

1. **Inventario:** crear/editar/eliminar producto; foto opcional; stock inicial.
2. **Venta:** desde Merch o Show → registrar venta (efectivo/QR/link).  
   - Descarga stock.  
   - Crea movimiento ingreso común categoría **Merch**.
3. **Resumen por show:** ver total vendido y stock restante por show.
4. **Merge:** exportar JSON → editar copia → importar con **M**erge; verificar que productos/ventas se fusionan.
5. **CSV:** exportar ventas (`exportSalesCSV`) y movimientos (`exportCSV`) sin errores.
6. **Tests:** `runMarketTests()` OK (sin romper `runTests()` original).
7. **Debug:** logs `[Market]` visibles y útiles en consola.

---

## 9) Prompts rápidos (si usás un agente de IA)

**Aplicar Market Lite completamente**
```
Agregá el módulo Market Lite en app.js: migración products/sales, funciones addProduct/updateProduct/deleteProduct, addSale (descuenta stock y crea movimiento), renderMerch, openProductForm/openSaleForm, resumen en renderShows, exportSalesCSV, runMarketTests y logs DEBUG. Ajustá mergeState para productos/ventas. No agregues dependencias.
```

**Endurecer validaciones**
```
En openProductForm/openSaleForm validar: price >=0; qty>=1; name obligatorio; si stock <0, normalizalo a 0. Mostrar toast en errores.
```

**Tratamiento de stock por show (opcional simple)**
```
Si eventId existe en producto, interpretá stock como perteneciente a ese show. En renderShows mostrá stock de productos filtrados por eventId.
```

---

**Listo.** Con estos bloques podés integrar Market Lite en una única sesión y testearlo al instante.
