¡Sí, es posible! Podés agregar un **merge “sin pisarse”** dentro del prototipo actual (LocalStorage + JSON) sin backend. La idea es convertir tu estado en un **log de registros con metadatos** y, al importar, **unir por `id`** con una política simple de conflictos: **Last‑Writer‑Wins (LWW)** por `updatedAt`. Si además querés que “eliminar” se propague entre dispositivos, usás **tombstones** (`deletedAt`).

Abajo te dejo un plan mínimo y los **templates** para integrar ya en tu `app.js`.

---

# Visión rápida

* **Cada registro** (miembro, show, movimiento) lleva:
  `id, createdAt, updatedAt, originId, deletedAt?`
* **Cada dispositivo** tiene un `deviceId` estable (guardado en LocalStorage).
* **Al mutar** (crear/editar/eliminar) se setea/actualiza `updatedAt` y `originId`.
* **Importar (MERGE)**:

  1. Validar y migrar el JSON entrante.
  2. Unir arrays **por `id`**:

     * Si no existe en local → agregar.
     * Si existe → ganar el que tenga mayor `updatedAt`.
  3. No “borrar” ítems de forma dura: se filtran si `deletedAt` existe.
* **UI**: al importar, ofrecer: **Reemplazar** (como hoy) o **Fusionar (merge)**.

> Esto te permite que los 3 integrantes registren ingresos/gastos y luego **fusionen** los backups sin pisarse, siempre que no editen **el mismo registro** a la vez. Si lo hacen, gana la edición **más nueva** (LWW).

---

# 1) Metadatos y helpers

Pegá esto cerca de tus constantes:

```js
// ====== Merge metadata ======
const META_KEY = 'soup_tours_meta';
function getDeviceId(){
  let meta = JSON.parse(localStorage.getItem(META_KEY)||'{}');
  if(!meta.deviceId){ meta.deviceId = 'dev_' + Math.random().toString(36).slice(2,10); localStorage.setItem(META_KEY, JSON.stringify(meta)); }
  return meta.deviceId;
}
const DEVICE_ID = getDeviceId();

function nowIso(){ return new Date().toISOString(); }
function stampNew(base){ 
  return { 
    ...base, 
    createdAt: base.createdAt || nowIso(), 
    updatedAt: nowIso(), 
    originId: DEVICE_ID, 
    deletedAt: base.deletedAt || null 
  };
}
function stampUpdate(obj, patch){
  return { ...obj, ...patch, updatedAt: nowIso(), originId: DEVICE_ID };
}
function markDeleted(obj){
  return { ...obj, deletedAt: nowIso(), updatedAt: nowIso(), originId: DEVICE_ID };
}
```

---

# 2) Usar los metadatos en tus mutaciones

Actualizá **solo la parte que cambia** en tus acciones:

```js
// Miembros
function addMember(name, role){
  mutateState(()=> STATE.band.members.push(stampNew({id:uid(), name, role})));
}
function removeMember(id){
  const i = STATE.band.members.findIndex(m=>m.id===id);
  if(i===-1) return;
  // en vez de borrar duro, marcá como eliminado
  mutateState(()=> STATE.band.members[i] = markDeleted(STATE.band.members[i]));
}

// Shows
function addShow(data){
  mutateState(()=> STATE.shows.push(stampNew({id:uid(), state:'pendiente', ...data})));
}
function updateShow(id, data){
  mutateState(()=>{
    const i = STATE.shows.findIndex(s=>s.id===id);
    if(i!==-1) STATE.shows[i] = stampUpdate(STATE.shows[i], data);
  });
}
function deleteShow(id){
  mutateState(()=>{
    const i = STATE.shows.findIndex(s=>s.id===id);
    if(i!==-1) STATE.shows[i] = markDeleted(STATE.shows[i]);
  });
}

// Movimientos
function addMove(data){
  mutateState(()=> STATE.moves.unshift(stampNew({id:uid(), ts:Date.now(), ...data})));
}
function updateMove(id, data){
  mutateState(()=>{
    const i = STATE.moves.findIndex(m=>m.id===id);
    if(i!==-1) STATE.moves[i] = stampUpdate(STATE.moves[i], data);
  });
}
function deleteMove(id){
  mutateState(()=>{
    const i = STATE.moves.findIndex(m=>m.id===id);
    if(i!==-1) STATE.moves[i] = markDeleted(STATE.moves[i]);
  });
}
```

> En el render, **filtrá** los elementos con `deletedAt`:
>
> ```js
> const alive = arr => arr.filter(x=>!x.deletedAt);
> // Ej.: STATE.shows → alive(STATE.shows)
> //      STATE.moves → alive(STATE.moves)
> ```

---

# 3) Merge (fusión) de estados

Agregá el motor de merge:

```js
// ====== Merge engine ======
function byId(arr){ return new Map(arr.map(x=>[x.id, x])); }
function newer(a, b){
  // devuelve el más nuevo por updatedAt (ISO); si empatan, preferí el local (a)
  if(!a) return b;
  if(!b) return a;
  return (a.updatedAt||'') >= (b.updatedAt||'') ? a : b;
}
function mergeArrays(localArr, incomingArr){
  const res = new Map();
  const all = [...localArr, ...incomingArr];
  for(const item of all){
    const prev = res.get(item.id);
    res.set(item.id, newer(prev, item));
  }
  return Array.from(res.values());
}

function mergeState(local, incoming){
  // NO toques campos sensibles como PIN si no querés
  const band = {
    ...local.band,
    name: newer({updatedAt: local.updatedAt}, {updatedAt: incoming.updatedAt}) === local ? local.band.name : (incoming.band?.name || local.band.name),
    pin: local.band.pin // mantené el PIN local
  };

  return {
    band: {
      ...band,
      members: mergeArrays(local.band.members||[], incoming.band?.members||[])
    },
    shows: mergeArrays(local.shows||[], incoming.shows||[]),
    moves: mergeArrays(local.moves||[], incoming.moves||[]),
    // marcas de sincronización (opcionales)
    lastMergedAt: nowIso(),
    updatedAt: nowIso()
  };
}
```

---

# 4) Importar con opción “Fusionar (merge)”

Reemplazá tu handler de import:

```js
btnImport.onchange = (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader(); 
  reader.onload = ()=>{
    try{ 
      const incoming = JSON.parse(reader.result);
      if(!incoming || !incoming.band || !Array.isArray(incoming.moves)) return toast('Backup inválido');

      const choice = prompt('Escribí:\nR = Reemplazar todo\nM = Fusionar (merge)');
      if(!choice) return;

      if(choice.toUpperCase()==='R'){
        mutateState(()=>{ STATE = incoming; });
        toast('Estado reemplazado.', 'success');
      } else if(choice.toUpperCase()==='M'){
        const merged = mergeState(STATE, incoming);
        mutateState(()=>{ STATE = merged; });
        toast('Estados fusionados.', 'success');
      } else {
        toast('Opción cancelada.');
      }
    }catch(err){ console.error(err); toast('JSON inválido'); }
  }; 
  reader.readAsText(file);
};
```

---

# 5) Deleciones que se propagan

Ya que ahora “eliminar” marca `deletedAt`, esa marca **viaja en el JSON** y, al importar‑fusionar, el registro con `deletedAt` **más nuevo** gana (se oculta en todos los dispositivos).

* **Para “borrar duro”** (purgar tombstones), podés agregar un botón oculto de mantenimiento que limpie registros con `deletedAt` más viejos de X días.

---

# 6) Tests rápidos (consola)

```js
// 1) Crear dos movimientos locales
const m1 = { kind:'ingreso', scope:'comun', amount:1000, note:'Mesa' };
const m2 = { kind:'gasto', scope:'personal', memberId: STATE.band.members[0]?.id, amount:300, note:'Bebidas' };
addMove(m1); addMove(m2);

// 2) Simular otro dispositivo exportando su JSON
const other = JSON.parse(JSON.stringify(STATE));
// editar el primero en "other"
other.moves[0] = { ...other.moves[0], amount:1200, updatedAt: new Date(Date.now()+1000).toISOString() };
// y agregar uno nuevo
other.moves.push({ id: 'x123', ts:Date.now(), kind:'ingreso', scope:'comun', amount:500, note:'Promo', createdAt: nowIso(), updatedAt: nowIso(), originId:'dev_fake', deletedAt:null });

// 3) Merge local + other
const merged = mergeState(STATE, other);

// 4) Verificar: 
// - el movimiento común debe quedar en 1200 por ser más nuevo
// - el nuevo 'x123' debe existir
console.assert(merged.moves.find(m=>m.id===STATE.moves[0].id).amount === 1200, 'LWW falló');
console.assert(merged.moves.some(m=>m.id==='x123'), 'Nuevo no se incorporó');
console.log('Merge tests OK');
```

---

# 7) Limitaciones y tips

* **Conflicto de edición del mismo registro** en dos teléfonos: gana el que tenga `updatedAt` más nuevo (**LWW**). Si querés ver “quién” editó, mirá `originId`.
* **Requiere IDs estables**: tus `id` ya lo son (usás `uid()`).
* **No resuelve merges “campo a campo”** (sería un CRDT). Para el prototipo móvil y sin dependencias, LWW es el mejor equilibrio simplicidad/valor.
* **Protocolo humano**: sigan usando “Importar antes / Exportar después”; el merge ayuda mucho, pero no hace magia si trabajan 3 al mismo tiempo editando lo mismo.

---

# 8) (Opcional) Vista previa de merge

Podés mostrar un **diff** antes de confirmar:

```js
function diffCounts(local, incoming){
  const add = (arrL, arrI) => Math.max(0, (arrI?.length||0) - (arrL?.length||0));
  return {
    movesNew: add(local.moves, incoming.moves),
    showsNew: add(local.shows, incoming.shows),
    membersNew: add(local.band.members, incoming.band?.members)
  };
}
// Usalo para renderizar un modal: “Se agregarán N movimientos, M shows, etc.”
```

---

## TL;DR

* **Sí, se puede** sin backend: agregá `createdAt/updatedAt/originId/deletedAt`, y un **merge por `id` con LWW**.
* Cambiá “Eliminar” por **tombstones** para que la eliminación se propague.
* Al **importar**, ofrecé **Reemplazar** o **Fusionar**.
* Con esto, los 3 pueden capturar gastos/ingresos en paralelo y **unir** sin pisarse (salvo que editen el mismo registro: gana el más nuevo).

