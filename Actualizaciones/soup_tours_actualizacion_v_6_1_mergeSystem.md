# SOUP Tours — Actualización v6.1 (Merge extendido)

> Extiende el **sistema de merge sin backend** a todas las funciones nuevas de v6 (logística, merch, tareas, contactos, checklist), manteniendo **vanilla JS**. Política de conflictos: **LWW (Last‑Writer‑Wins)** por `updatedAt`, con **tombstones** (`deletedAt`) para que los borrados se propaguen.

---

## 0) Principios de merge

- **ID estable** por cada entidad (y sub‑entidad): `id: string`.
- **Metadatos** en *todas* las entidades mergeables: `{ createdAt, updatedAt, originId, deletedAt|null }`.
- **LWW**: ante conflicto, gana el que tenga `updatedAt` más reciente (ISO 8601). Si empatan, prevalece el local.
- **Borrado lógico**: `deletedAt` ≠ null oculta el item; el más nuevo gana.
- **Merge por colecciones**: unir por `id`, sin ordenar por índice.

### Entidades cubiertas

- `band.members`
- `shows` (+ campos `lat,lng,requerimientos,checklist[]`)
- `moves`
- `merch.products` (con `variants[]`), `merch.stock`, `merch.sales`
- `tasks`
- `contacts`

---

## 1) Utilidades de metadatos

```js
// ====== Merge metadata utils ======
const META_KEY = 'soup_tours_meta';
function getDeviceId(){
  let meta = JSON.parse(localStorage.getItem(META_KEY)||'{}');
  if(!meta.deviceId){ meta.deviceId = 'dev_' + Math.random().toString(36).slice(2,10); localStorage.setItem(META_KEY, JSON.stringify(meta)); }
  return meta.deviceId;
}
const DEVICE_ID = getDeviceId();
const nowIso = () => new Date().toISOString();

function stampNew(base){
  return { createdAt: nowIso(), updatedAt: nowIso(), originId: DEVICE_ID, deletedAt: null, ...base };
}
function stampUpdate(obj, patch){
  return { ...obj, ...patch, updatedAt: nowIso(), originId: DEVICE_ID };
}
function markDeleted(obj){
  return { ...obj, deletedAt: nowIso(), updatedAt: nowIso(), originId: DEVICE_ID };
}
```

---

## 2) Ayudantes de merge

```js
// ====== Merge helpers ======
const newer = (a,b)=>{ if(!a) return b; if(!b) return a; return (a.updatedAt||'') >= (b.updatedAt||'') ? a : b; };
const byId = arr => new Map((arr||[]).map(x=>[x.id, x]));

function mergeArrays(localArr=[], incomingArr=[]) {
  const res = new Map();
  for (const item of [...localArr, ...incomingArr]) {
    const prev = res.get(item.id);
    res.set(item.id, newer(prev, item));
  }
  return [...res.values()];
}

// subcolecciones anidadas (variants, checklist, items de sale)
function mergeNested(parentLocal=[], parentIncoming=[], nestedKey){
  // Une por id a nivel padre y también a nivel nestedKey por id
  const map = new Map();
  for(const p of [...parentLocal, ...parentIncoming]){
    const prev = map.get(p.id);
    const pick = newer(prev, p);
    // merge de nested
    const nest = mergeArrays(prev?.[nestedKey]||[], p[nestedKey]||[]);
    map.set(p.id, { ...pick, [nestedKey]: nest });
  }
  return [...map.values()];
}
```

---

## 3) Extensión del merge a todas las colecciones

```js
function mergeState(local, incoming){
  const band = {
    ...local.band,
    name: newer({updatedAt: local.updatedAt}, {updatedAt: incoming.updatedAt})===local ? local.band.name : (incoming.band?.name || local.band.name),
    // PIN se mantiene local por seguridad (ajustable si querés)
    pin: local.band.pin,
    members: mergeArrays(local.band?.members, incoming.band?.members)
  };

  // shows con checklist
  const shows = mergeNested(local.shows, incoming.shows, 'checklist');

  // moves
  const moves = mergeArrays(local.moves, incoming.moves);

  // merch: products (con variants), stock, sales
  const products = mergeNested(local.merch?.products||[], incoming.merch?.products||[], 'variants');
  const stock = mergeArrays(local.merch?.stock||[], incoming.merch?.stock||[]);
  const sales = mergeArrays(local.merch?.sales||[], incoming.merch?.sales||[]);

  // tasks
  const tasks = mergeArrays(local.tasks||[], incoming.tasks||[]);

  // contacts
  const contacts = mergeArrays(local.contacts||[], incoming.contacts||[]);

  return {
    ...local,
    band,
    shows,
    moves,
    merch: { products, stock, sales },
    tasks,
    contacts,
    lastMergedAt: nowIso(),
    updatedAt: nowIso(),
  };
}
```

> **Nota**: el render debe filtrar elementos con `deletedAt` (tombstones) para que no aparezcan.

```js
const alive = arr => (arr||[]).filter(x=>!x.deletedAt);
// Ej.: listar shows → alive(STATE.shows)
```

---

## 4) Mutaciones con metadatos (ejemplos clave)

```js
// Ejemplos: adaptar tus funciones actuales
function addMove(data){ mutateState(()=> STATE.moves.unshift(stampNew({ id:uid(), ts:Date.now(), ...data }))); }
function updateMove(id, patch){ mutateState(()=>{ const i=STATE.moves.findIndex(m=>m.id===id); if(i>-1) STATE.moves[i]=stampUpdate(STATE.moves[i], patch); }); }
function deleteMove(id){ mutateState(()=>{ const i=STATE.moves.findIndex(m=>m.id===id); if(i>-1) STATE.moves[i]=markDeleted(STATE.moves[i]); }); }

function addShow(data){ mutateState(()=> STATE.shows.push(stampNew({ id:uid(), state:'pendiente', checklist:[], ...data }))); }
function addChecklistItem(showId, text){ mutateState(()=>{ const s=STATE.shows.find(x=>x.id===showId); s.checklist=s.checklist||[]; s.checklist.push(stampNew({ id:uid(), text, done:false })); }); }
function toggleChecklist(showId, itemId){ mutateState(()=>{ const s=STATE.shows.find(x=>x.id===showId); const it=s.checklist.find(i=>i.id===itemId); if(it) Object.assign(it, stampUpdate(it, {done:!it.done})); }); }

function addProduct(name, price){ mutateState(()=> STATE.merch.products.push(stampNew({ id:uid(), name, price:Number(price), variants:[] }))); }
function addVariant(prodId, size, color, cost){ mutateState(()=>{ const p=STATE.merch.products.find(p=>p.id===prodId); p.variants.push(stampNew({ id:uid(), size, color, cost:Number(cost) })); }); }
function addStock(prodId, varId, qty){ mutateState(()=> STATE.merch.stock.push(stampNew({ id:uid(), productId:prodId, variantId:varId, qty:Number(qty) }))); }
function sell(items){ mutateState(()=>{ const sale=stampNew({ id:uid(), ts:Date.now(), items:[] }); /* ... */ STATE.merch.sales.unshift(sale); }); }

function addTask(text, dueAt=null, assigneeId=null){ mutateState(()=> STATE.tasks.push(stampNew({ id:uid(), text, dueAt, assigneeId, done:false }))); }
function addContact(name, role, phone='', email='', notes=''){ mutateState(()=> STATE.contacts.push(stampNew({ id:uid(), name, role, phone, email, notes }))); }
```

---

## 5) Import con opción **Merge** (UI)

```js
// Handler de import
btnImport.onchange = (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader(); reader.onload = ()=>{
    try{
      const incoming = JSON.parse(reader.result);
      // Validación mínima
      if(!incoming || !incoming.band || !Array.isArray(incoming.shows) || !Array.isArray(incoming.moves)) return toast('Backup inválido');
      const choice = prompt('Escribí: R = Reemplazar | M = Fusionar');
      if(!choice) return;
      if(choice.toUpperCase()==='R'){
        mutateState(()=>{ STATE = incoming; }); toast('Estado reemplazado','success');
      } else if(choice.toUpperCase()==='M'){
        const merged = mergeState(STATE, incoming);
        mutateState(()=>{ STATE = merged; }); toast('Estados fusionados','success');
      }
    }catch(err){ console.error(err); toast('JSON inválido'); }
  }; reader.readAsText(file);
};
```

---

## 6) Migración a v6.1 (metadatos en nuevas colecciones)

```js
const CURRENT_VERSION = 61; // 6.1
function ensureMeta(x){
  if(!x) return x; x.createdAt ||= nowIso(); x.updatedAt ||= nowIso(); x.originId ||= DEVICE_ID; x.deletedAt = x.deletedAt ?? null; return x;
}
function migrate(state){
  state.version ||= 1;
  if(state.version < 61){
    // moves
    state.moves = (state.moves||[]).map(ensureMeta);
    // shows + checklist
    state.shows = (state.shows||[]).map(s=>({ ...ensureMeta(s), checklist:(s.checklist||[]).map(ensureMeta) }));
    // band.members
    state.band.members = (state.band?.members||[]).map(ensureMeta);
    // merch
    const merch = state.merch || { products:[], stock:[], sales:[] };
    merch.products = (merch.products||[]).map(p=>({ ...ensureMeta(p), variants:(p.variants||[]).map(ensureMeta) }));
    merch.stock = (merch.stock||[]).map(ensureMeta);
    merch.sales = (merch.sales||[]).map(s=>ensureMeta(s));
    state.merch = merch;
    // tasks & contacts
    state.tasks = (state.tasks||[]).map(ensureMeta);
    state.contacts = (state.contacts||[]).map(ensureMeta);

    state.version = 61;
  }
  return state;
}
```

---

## 7) Tests de merge (harness)

```js
function runMergeTests(){
  const snap = JSON.stringify(STATE);
  try{
    console.group('[TEST merge 6.1]');
    // 1) Crear base local
    const mA = stampNew({id:'mA', ts:Date.now(), kind:'ingreso', scope:'comun', amount:1000, note:'Mesa'});
    const sA = stampNew({id:'sA', date:'2025-09-01', city:'C1', checklist:[]});
    const pA = stampNew({id:'pA', name:'Remera', price:5000, variants:[stampNew({id:'vA', size:'M', color:'Negra', cost:2000})]});
    const tA = stampNew({id:'tA', text:'Llamar prensa'});
    const cA = stampNew({id:'cA', name:'Juan', role:'Sonido'});
    STATE.moves.unshift(mA); STATE.shows.push(sA); STATE.merch={products:[pA],stock:[],sales:[]}; STATE.tasks=[tA]; STATE.contacts=[cA];
    save();

    // 2) Simular backup externo más nuevo para mA y que crea mB y sB
    const incoming = JSON.parse(JSON.stringify(STATE));
    // editar mA con más nuevo updatedAt
    incoming.moves[0] = { ...incoming.moves[0], amount:1200, updatedAt: new Date(Date.now()+2000).toISOString() };
    // nuevo move mB
    incoming.moves.push(stampNew({id:'mB', ts:Date.now(), kind:'gasto', scope:'personal', memberId:STATE.band.members[0]?.id, amount:300, note:'Bebidas'}));
    // nuevo show sB con checklist
    incoming.shows.push(stampNew({id:'sB', date:'2025-09-02', city:'C2', checklist:[stampNew({id:'chk1', text:'Cargar merch', done:false})]}));

    // 3) Merge
    const merged = mergeState(STATE, incoming);

    // 4) Asserts
    const mA_merged = merged.moves.find(x=>x.id==='mA');
    console.assert(mA_merged.amount===1200,'LWW en moves');
    console.assert(merged.moves.some(x=>x.id==='mB'),'Nuevo move incorporado');
    console.assert(merged.shows.some(x=>x.id==='sB') && merged.shows.find(x=>x.id==='sB').checklist.length===1,'Show+checklist incorporados');

    console.log('OK merge 6.1');
  } finally { STATE = JSON.parse(snap); save(); console.groupEnd(); render(); }
}
```

---

## 8) Debug logs sugeridos

```js
log('merge.start', {localUpdatedAt: STATE.updatedAt, incomingUpdatedAt: incoming?.updatedAt});
log('merge.result', {counts: {moves: merged.moves.length, shows: merged.shows.length, products: merged.merch.products.length}});
log('delete.tombstone', {entity:'move', id});
```

---

## 9) Checklist de aceptación

-

---

## 10) Prompt para el agente de IA

```
Implementá la Actualización v6.1 (Merge extendido):
- Agregá metadatos (createdAt, updatedAt, originId, deletedAt) a todas las entidades nuevas.
- Adaptá las mutaciones a stampNew/stampUpdate/markDeleted.
- Insertá mergeState() con mergeNested() para variants y checklist.
- Modificá el import para ofrecer Reemplazar/Merge.
- Añadí migrate() v6.1 y el harness runMergeTests().
- Filtrá tombstones en los renders con alive().
Sin dependencias y manteniendo compatibilidad con export/import JSON.
```

