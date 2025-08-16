# SOUP Tours — Refactor mínimo imprescindible (app.js) + Prompt para Gemini CLI

> Objetivo: aplicar un **parche pequeño y seguro** que corrige cálculos, merge y formularios sin cambiar la UX. Deja el proyecto listo para uso en gira y para sincronizar datos entre dispositivos mediante backups/merge.

---

## Checklist de cambios (rápidos)

-

> Sugerencia operativa: pega **cada bloque completo** sustituyendo la función existente en `app.js`. Si alguna función no existe igual, agrega el bloque tal cual.

---

## 1) Helper de saneado (XSS) — **nuevo**

Agrega cerca de otros helpers (`nowIso`, `alive`, etc.):

```js
function esc(s) {
  if (s == null) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
```

---

## 2) `CURRENT_VERSION` en estados nuevos

En la sección donde se define `DEFAULT_STATE` o cuando se inicializa un estado vacío, **asegúrate** de establecer:

```js
const CURRENT_VERSION = 1; // si ya existe, conserva su valor actual
// ...
const DEFAULT_STATE = {
  // ... lo que ya tengas
  version: CURRENT_VERSION,
  createdAt: nowIso(),
  updatedAt: nowIso()
};
```

Si tu `DEFAULT_STATE` ya existe, solo agrega/ajusta `version`, `createdAt`, `updatedAt`.

---

## 3) `balances()` — **reemplazar por completo**

Usa `alive()` para excluir soft-deleted y separar común/personal correctamente.

```js
function balances(){
  const moves = alive(STATE.moves || []);
  const sum = (cond) => moves
    .filter(cond)
    .reduce((a, m) => a + (m.kind === 'ingreso' ? m.amount : -m.amount), 0);

  const comun = sum(m => m.scope === 'comun');

  const per = {};
  for (const mm of alive(STATE.band?.members || [])) {
    per[mm.id] = sum(m => m.scope === 'personal' && m.memberId === mm.id);
  }

  return { comun, per };
}
```

---

## 4) `getShowBalance(showId)` — **reemplazar por completo**

```js
function getShowBalance(showId){
  const moves = alive(STATE.moves || []).filter(m => m.showId === showId);
  const sum = (cond) => moves
    .filter(cond)
    .reduce((a, m) => a + (m.kind === 'ingreso' ? m.amount : -m.amount), 0);

  const comun = sum(m => m.scope === 'comun');
  const per = {};
  for (const mm of alive(STATE.band?.members || [])) {
    per[mm.id] = sum(m => m.scope === 'personal' && m.memberId === mm.id);
  }
  return { comun, per };
}
```

---

## 5) `exportCSV()` — **reemplazar por completo**

```js
function exportCSV(){
  const membersById = Object.fromEntries(alive(STATE.band?.members || []).map(m => [m.id, m]));
  const rows = [
    ['fecha', 'tipo', 'monto', 'scope', 'miembro', 'show', 'nota']
  ];

  for (const m of alive(STATE.moves || [])){
    rows.push([
      m.date || '',
      m.kind || '',
      String(m.amount ?? ''),
      m.scope || '',
      membersById[m.memberId]?.name || '',
      (STATE.shows?.find(s => s.id === m.showId)?.name) || '',
      (m.note ? m.note.replaceAll('\n',' ').trim() : '')
    ]);
  }

  const csv = rows.map(r => r.map(x => '"' + String(x ?? '').replaceAll('"','""') + '"').join(',')).join('\n');
  downloadText('soup_tours_export.csv', csv);
}
```

---

## 6) `liquidationCSV()` — **reemplazar por completo**

Prorratea por cantidad de **miembros vivos** y usa solo movimientos vivos.

```js
function liquidationCSV(){
  const members = alive(STATE.band?.members || []);
  const memberIds = members.map(m => m.id);

  const comunes = alive(STATE.moves || []).filter(m => m.scope === 'comun');
  const personales = alive(STATE.moves || []).filter(m => m.scope === 'personal');

  const rows = [['miembro','saldo_personal','cuota_comun','saldo_total']];

  const totalComun = comunes.reduce((a,m)=> a + (m.kind==='ingreso'? m.amount : -m.amount), 0);
  const cuotaComun = members.length ? totalComun / members.length : 0;

  for (const mm of members){
    const saldoPersonal = personales
      .filter(m => m.memberId === mm.id)
      .reduce((a,m)=> a + (m.kind==='ingreso'? m.amount : -m.amount), 0);
    const saldoTotal = saldoPersonal + cuotaComun; // ajustar si tu convención resta/añade distinto
    rows.push([mm.name, String(saldoPersonal), String(cuotaComun), String(saldoTotal)]);
  }

  const csv = rows.map(r => r.map(x => '"' + String(x ?? '').replaceAll('"','""') + '"').join(',')).join('\n');
  downloadText('soup_tours_liquidacion.csv', csv);
}
```

> Nota: si tu convención para la cuota común es repartir **neto** por cabeza con signos inversos, ajusta la última línea del cálculo `saldoTotal` en consecuencia.

---

## 7) `memberName(id)` — **reemplazar por completo**

```js
function memberName(id){
  const mm = alive(STATE.band?.members || []).find(x => x.id === id);
  return mm ? mm.name : '';
}
```

---

## 8) Select de miembro en formularios — **editar dentro de **``

Cuando construyas las `<option>`, usa solo miembros vivos y **escapa** el nombre:

```js
const memberOpts = alive(STATE.band?.members || [])
  .map(m => `<option value="${m.id}">${esc(m.name)}</option>`) // usa esc()
  .join('');
```

Reemplaza cualquier uso previo de `STATE.band.members.map(...)` por este bloque.

---

## 9) Timestamps en `addMove()` / `updateMove()` — **reemplazar por completo**

Garantiza `createdAt/updatedAt` para que `mergeArrays()` decida correctamente.

```js
function addMove(data){
  const move = stampNew({
    id: crypto.randomUUID(),
    kind: data.kind,
    amount: Number(data.amount || 0),
    scope: data.scope || 'comun',
    memberId: data.memberId || null,
    showId: data.showId || null,
    date: data.date || new Date().toISOString().slice(0,10),
    note: data.note || ''
  });

  mutateState(() => {
    STATE.moves = [...(STATE.moves||[]), move];
  });
}

function updateMove(id, patch){
  const i = (STATE.moves||[]).findIndex(m => m.id === id);
  if (i < 0) return;
  mutateState(() => {
    STATE.moves[i] = stampUpdate(STATE.moves[i], {
      ...patch,
      amount: patch.amount != null ? Number(patch.amount) : STATE.moves[i].amount
    });
  });
}
```

> Si ya existen `stampNew`/`stampUpdate`, mantenlas; si no, crea estas helpers con `createdAt`/`updatedAt`.

---

## 10) `mergeState(local, incoming)` — **reemplazar por completo**

Incluye `templates`, `quickActions`, versionado y timestamps. Respeta el nombre más nuevo de banda comparando `updatedAt` del propio `band` (si existe) y, si no, cae al `updatedAt` de raíz.

```js
function mergeState(local, incoming){
  const newerObj = (a, b) => {
    const au = a?.updatedAt || a?.band?.updatedAt || a?.createdAt || '';
    const bu = b?.updatedAt || b?.band?.updatedAt || b?.createdAt || '';
    return au >= bu ? a : b;
  };

  const mergedBand = {
    ...(local.band || {}),
    ...(incoming.band || {}),
  };

  // name según el objeto más nuevo que tenga nombre
  const bandNewer = newerObj(local.band || local, incoming.band || incoming);
  if (bandNewer?.band?.name || bandNewer?.name){
    mergedBand.name = (bandNewer.band?.name) ?? bandNewer.name;
  }

  return {
    band: {
      ...mergedBand,
      members: mergeArrays(local.band?.members || [], incoming.band?.members || [])
    },
    shows: mergeArrays(local.shows || [], incoming.shows || []),
    moves: mergeArrays(local.moves || [], incoming.moves || []),
    templates: mergeArrays(local.templates || [], incoming.templates || []),
    quickActions: mergeArrays(local.quickActions || [], incoming.quickActions || []),
    version: Math.max(local.version || 1, incoming.version || 1, CURRENT_VERSION || 1),
    createdAt: (local.createdAt && incoming.createdAt) ? (local.createdAt <= incoming.createdAt ? local.createdAt : incoming.createdAt) : (local.createdAt || incoming.createdAt || nowIso()),
    updatedAt: nowIso(),
    lastMergedAt: nowIso()
  };
}
```

---

## 11) Usos de `innerHTML` con datos de usuario (varios lugares)

Cuando interpolas contenido controlado por el usuario (ej. `note`, `name`) en HTML:

```js
// antes
html += `<div class="note">${m.note}</div>`;
// después
html += `<div class="note">${esc(m.note)}</div>`;
```

> Busca los puntos con notas y nombres en listas/tablas/modal y usa `esc()`.

---

## 12) Limpieza menor

- Si `btnExportCsv` quedó sin uso, elimínalo o alinéalo con el id real del botón (según `index.html`).
- Normaliza a `const` para funciones utilitarias y evita variables muertas.

---

## 13) Pruebas sugeridas (añadir a `tests.js`)

Copia estas pruebas o adáptalas a tu pequeño runner actual:

```js
function _fakeState(){
  const A = { id: 'A', name: 'Ana', deletedAt: null };
  const B = { id: 'B', name: 'Beto', deletedAt: nowIso() }; // borrado
  const S1 = { id: 'S1', name: 'Cordoba 10/10', deletedAt: null };
  return {
    band: { name: 'SOUP', members: [A, B] },
    shows: [S1],
    moves: [
      stampNew({ id: 'm1', kind: 'ingreso', amount: 1000, scope: 'comun', showId: 'S1' }),
      stampNew({ id: 'm2', kind: 'egreso', amount: 200, scope: 'personal', memberId: 'A' }),
      { id: 'm3', kind: 'ingreso', amount: 9999, scope: 'personal', memberId: 'B', deletedAt: nowIso(), createdAt: nowIso(), updatedAt: nowIso() }
    ],
    version: CURRENT_VERSION,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

function test_balances_alive(){
  const st = _fakeState();
  const prev = STATE; STATE = st;
  const b = balances();
  STATE = prev;
  assertEq(b.comun, 1000, 'Comun sólo cuenta vivos');
  assertEq(b.per['A'], -200, 'Personal A cuenta');
  assertEq(b.per['B'] ?? 0, 0, 'Personal B borrado no suma');
}

function test_merge_includes_templates(){
  const a = { band:{members:[]}, shows:[], moves:[], templates:[{id:'t1', updatedAt:'2024-01-01'}], version:1, updatedAt:'2024-01-01' };
  const b = { band:{members:[]}, shows:[], moves:[], templates:[{id:'t2', updatedAt:'2024-02-01'}], version:2, updatedAt:'2024-02-01' };
  const m = mergeState(a,b);
  const ids = new Set((m.templates||[]).map(x=>x.id));
  assert(ids.has('t1') && ids.has('t2'), 'mergeState conserva templates de ambos');
}

function runRefactorTests(){
  test_balances_alive();
  test_merge_includes_templates();
  console.log('Refactor tests OK');
}
```

Llama `runRefactorTests()` desde tu `runTests()` o temporalmente desde `window.onload` durante QA.

---

# PROMPT listo para **Gemini CLI**

Cópialo textual en tu agente (CLI) dentro de la carpeta del proyecto.

```
Eres un agente de implementación. Objetivo: aplicar un refactor mínimo en SOUP Tours para corregir cálculos, merge y formularios, sin cambiar la UX.

INSTRUCCIONES:
1) Abre `app.js` y aplica **sustitución completa** de las siguientes funciones, pegando los bloques provistos en el documento adjunto:
   - balances()
   - getShowBalance(showId)
   - exportCSV()
   - liquidationCSV()
   - memberName(id)
   - addMove(data)
   - updateMove(id, patch)
   - mergeState(local, incoming)

2) Agrega el helper nuevo `esc(s)` junto a otros helpers.
3) En `openMoveForm(...)`, genera `<option>` de miembros con `alive(STATE.band.members)` y usa `esc(name)`.
4) En cualquier `innerHTML` que interpole `note` o nombres, usa `esc()`.
5) Asegura que `DEFAULT_STATE.version = CURRENT_VERSION` y que `CURRENT_VERSION` existe. Añade/ajusta `createdAt/updatedAt` en `DEFAULT_STATE` si faltan.
6) (Limpieza) Si existe `btnExportCsv` sin uso, elimina o alinea con el id real del botón. El resto del código no debe modificarse.

PRUEBAS:
7) Abre `tests.js` y pega las funciones de prueba `runRefactorTests()` del documento. Invoca `runRefactorTests()` desde `runTests()` o temporalmente desde `window.onload`.
8) Ejecuta en terminal local un server estático (por ejemplo):
   - `python -m http.server 8000`
   - abre `http://localhost:8000/index.html`
   - usa la UI para: crear 2 miembros (uno eliminar), cargar 1 ingreso común y 1 egreso personal, exportar CSV y liquidación.

VERIFICACIONES MANUALES:
9) En balances generales y por show, verifica que el miembro eliminado **no** aparezca en selects ni en prorrateos.
10) Exportaciones CSV: deben listar solo movimientos vivos y el nombre del miembro correcto.
11) Simula un merge: exporta JSON A, modifica `band.name` en B, añade un template y un quickAction, expórtalo como JSON B. Luego, `Merge` A<-B. Comprueba:
    - `band.name` conserva el del estado más nuevo (por `updatedAt`).
    - `templates` y `quickActions` combinados.

ENTREGABLES:
12) Confirma en consola: `Refactor tests OK`.
13) Deja logs con prefijo `[refactor]` para cualquier ajuste mínimo que realices.

Criterio de finalización: Todas las pruebas pasan, la UI muestra sólo miembros vivos en selects y los cálculos no incluyen elementos borrados. No se alteró la UX.
```

---

## Notas finales

- Este parche es **compatible** con tu sistema de snapshots y migraciones actuales.
- Deja preparado el terreno para una segunda etapa: separar estado/UI en módulos y fortalecer seguridad de PIN.

