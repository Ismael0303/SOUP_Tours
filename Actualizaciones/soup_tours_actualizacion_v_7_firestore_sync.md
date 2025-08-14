# SOUP Tours — Actualización v7 (Firestore Sync)

> Objetivo: **sincronización en tiempo real** entre dispositivos usando **Firebase Firestore** con **offline‑first**, manteniendo vanilla JS y la estructura actual de datos (`id`, `updatedAt`, `deletedAt`). Incluye **templates de código**, **reglas**, **migración desde LocalStorage**, **tests** y **debug logs**.

---

## 0) Requisitos

- Crear proyecto en **Firebase Console** → habilitar **Firestore** y **Authentication** (Email/Google).
- Hosting: cualquiera con HTTPS (Firebase Hosting, Vercel, Netlify, GitHub Pages).
- Mantener export/import JSON como respaldo.

---

## 1) Estructura de colecciones (por banda)

```
bands/{bandId}
  members/{memberId}
  shows/{showId}
    checklist/{itemId}
  moves/{moveId}
  merch_products/{productId}
    variants/{variantId}
  merch_stock/{stockId}
  merch_sales/{saleId}
  tasks/{taskId}
  contacts/{contactId}
```

- Cada doc conserva: `id, createdAt, updatedAt, deletedAt|null, originId`.

---

## 2) Reglas de seguridad (mínimas, por banda)

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isBandUser(bandId) {
      return request.auth != null
        && request.auth.token.bands != null
        && request.auth.token.bands[bandId] == true;
    }
    match /bands/{bandId}/{document=**} {
      allow read, write: if isBandUser(bandId);
    }
  }
}
```

> Alternativa sin custom claims: subcolección `bands/{bandId}/allowedUsers/{uid}` y regla que compare contra ese doc.

---

## 3) SDK e inicialización (módulos Web v10)

```html
<!-- index.html (en <head> o antes de cerrar body) -->
<script type="module">
  import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
  import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
  import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

  const firebaseConfig = {/* TU CONFIG */};
  const app = initializeApp(firebaseConfig);

  // Firestore con cache offline persistente
  initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
  window.DB = getFirestore(app);
  window.AUTH = getAuth(app);

  // Helpers de login/logout
  window.login = async () => { const prov=new GoogleAuthProvider(); await signInWithPopup(AUTH, prov); };
  window.logout = async () => { await signOut(AUTH); };

  onAuthStateChanged(AUTH, (user)=> {
    window.USER = user; // guarda el user actual
    if(user) { console.log('[AUTH] login', user.uid); }
    else { console.log('[AUTH] logout'); }
    // acá podrías renderizar pantalla de login si no hay user
  });
</script>
```

---

## 4) Adaptador de datos (listeners + writes)

Crea un módulo simple en `app.js` para aislar Firestore del resto.

```js
// ===== Firestore Adapter =====
import { collection, doc, setDoc, addDoc, getDoc, onSnapshot, serverTimestamp, query, where, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let BAND_ID = null; // setear tras login/selección
const col = (path) => collection(DB, `bands/${BAND_ID}/${path}`);
const ref = (path, id) => doc(DB, `bands/${BAND_ID}/${path}/${id}`);
const nowISO = () => new Date().toISOString();

// LWW + tombstones: siempre enviar updatedAt ISO y conservar deletedAt
async function upsert(path, obj){
  const r = ref(path, obj.id);
  const payload = { ...obj, updatedAt: nowISO() };
  await setDoc(r, payload, { merge: true });
}

// Listeners (realtime)
let unsub = {};
function listen(path, handler, opts={}){
  const q = query(col(path), ...(opts.where||[]), ...(opts.order||[orderBy('updatedAt','desc')]), ...(opts.limit? [limit(opts.limit)] : []));
  unsub[path]?.();
  unsub[path] = onSnapshot(q, snap => {
    const items = snap.docs.map(d=>({id:d.id, ...d.data()}));
    handler(items);
  });
}
function unlistenAll(){ Object.values(unsub).forEach(u=>u&&u()); unsub={}; }

// API específica (ejemplos)
export async function upsertMove(m){ return upsert('moves', m); }
export function listenMoves(handler){ listen('moves', handler, { order:[orderBy('updatedAt','desc')], limit: 1000 }); }
export async function upsertShow(s){ return upsert('shows', s); }
export function listenShows(handler){ listen('shows', handler, { order:[orderBy('date','asc')] }); }
// Repetir para tasks, contacts, merch_*
```

**Integración con el estado local**

```js
// En el boot de tu app, tras elegir BAND_ID válido
function attachRealtime(){
  listenShows(items=>{ STATE.shows = items; save(); render(); });
  listenMoves(items=>{ STATE.moves = items; save(); render(); });
  // ... tasks, contacts, merch_*
}
```

---

## 5) Escrituras desde la UI (ejemplos)

Adapta tus mutaciones para escribir en Firestore; mantené LocalStorage como cache inmediata.

```js
async function addMoveUI(data){
  const m = { id: uid(), createdAt: nowISO(), updatedAt: nowISO(), deletedAt: null, originId: DEVICE_ID, ts: Date.now(), ...data };
  // Optimistic update (opcional):
  STATE.moves.unshift(m); render();
  await upsertMove(m); // Firestore emitirá el cambio y quedará consistente
}

async function deleteMoveUI(id){
  const m = STATE.moves.find(x=>x.id===id); if(!m) return;
  const tomb = { ...m, deletedAt: nowISO(), updatedAt: nowISO() };
  await upsertMove(tomb);
}
```

---

## 6) Migración desde LocalStorage → Firestore

1. **Elegí BAND\_ID** (por ahora fija; luego podés tener selector).
2. **Subí** todo el `STATE` actual (solo `alive()` y con `id`/`updatedAt`):

```js
async function pushAllFromLocal(){
  for(const s of alive(STATE.shows)) await upsertShow(s);
  for(const m of alive(STATE.moves)) await upsertMove(m);
  // repetir para tasks, contacts, merch_* (products/variants/stock/sales)
}
```

3. **Activa listeners** (Sección 4) para comenzar a leer “desde la nube”.
4. **Backups**: mantené “Exportar JSON” como safety net.

> Consejo: Hacé una **prueba en banda de test** (BAND\_ID distinto) antes de usar la banda real.

---

## 7) Guardarraíles de costos

- **Siempre** usá `orderBy` + `limit` y/o `where`.
- Evitá `onSnapshot` a colecciones gigantes sin filtros; filtrá por fecha (`where('date','>=', hoy)`), por estado, o paginá.
- Consolidá escrituras (cuando puedas) y evitá updates “chatty”.
- Para reportes pesados, exportá CSV y calculá offline o usá un job puntual (Functions) solo cuando sea necesario.

---

## 8) Debug logs

```js
let DEBUG=true;
function dlog(evt,payload){ if(!DEBUG) return; console.groupCollapsed(`[SYNC] ${evt}`); console.log(payload||'(vacío)'); console.groupEnd(); }

// Puntos clave
listenMoves(items){ dlog('moves.onSnapshot', {count:items.length}); STATE.moves = items; save(); render(); }
await upsertMove(m); dlog('moves.upsert', m);
```

---

## 9) Tests (harness + manual)

### 9.1 Harness rápido

```js
async function runV7Tests(){
  console.group('[TEST v7 Firestore]');
  const id = uid();
  await upsertMove({ id, createdAt: nowISO(), updatedAt: nowISO(), deletedAt: null, originId: DEVICE_ID, ts: Date.now(), kind:'ingreso', scope:'comun', amount:1234, note:'test' });
  console.assert(true,'upsert ok');
  // esperar a snapshot
  setTimeout(()=>{
    const ok = STATE.moves.some(x=>x.id===id);
    console.assert(ok,'snapshot recibió el doc');
    console.groupEnd();
  }, 800);
}
```

### 9.2 Manual

-

---

## 10) Prompt para agente de IA

```
Implementá v7 Firestore Sync:
- Agregá el bloque de inicialización (app, auth, firestore con cache offline).
- Creá el adaptador (listen*/upsert* para moves/shows/tasks/contacts/merch_*).
- Modificá las mutaciones UI para usar upsert* conservando updatedAt/deletedAt.
- Sumá pushAllFromLocal() para migración inicial desde LocalStorage y luego activá listeners.
- Agregá logs y el test harness runV7Tests().
- No agregues dependencias ni cambies el diseño visual.
```

---

## 11) Roadmap a futuro (migración a Supabase)

- Encapsular todo acceso a datos en `datasource.*` (hoy Firestore; mañana Supabase).
- Mantener formato de entidades (id/updatedAt/deletedAt) para **upsert LWW** en SQL.
- Script de export JSON canónico → import SQL con `ON CONFLICT (id) DO UPDATE` y condición por `updated_at`.

