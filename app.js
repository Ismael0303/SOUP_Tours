let DEBUG = true;



// ====== Estado y persistencia ======
const KEY = 'soup_tours';
const CURRENT_VERSION = 2;

const DEFAULT_STATE = {
  band: { name: 'SOUP', members: [{id:'u1', name:'Ismael', role:'voz/guitarra'}]}, 
  shows: [],
  moves: [],
  templates: [],
  quickActions: [
    {id: 'qa1', label:'+ Venta merch', amount: 5000, kind:'ingreso', scope:'comun', category:'Merch', note:'Venta mesa'},
    {id: 'qa2', label:'+ Nafta', amount: -10000, kind:'gasto', scope:'comun', category:'Transporte', note:'Combustible'},
    {id: 'qa3', label:'+ Peaje', amount: -1500, kind:'gasto', scope:'comun', category:'Peajes', note:'Peaje'}
  ],
  version: CURRENT_VERSION,
  createdAt: nowIso(),
  updatedAt: nowIso()
};
let STATE = load();
let LASTS = [];
let currentTab = 'home';
let cashFilter = 'all';
let enteredPin = '';
let toastTimeout;
let UI = { cashFilter:{scope:'todos', memberId:null}, search:'' };

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

// ====== Selectores de DOM (globales para que las funciones puedan usarlos) ======
let view, tabs, modal, fab, btnImport, btnUndo, btnSettings, searchInput, appTitleEl, pinScreen, pinDots, numpad;

// ====== Funciones de Utilidad ======
const uid = (prefix = '') => prefix + Math.random().toString(36).slice(2,9);
const strHash = s => s.split('').reduce((a,b)=>(a<<5)-a+b.charCodeAt(0),0);

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function downloadText(filename, text) {
  const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename});
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

function memberName(id){
  const mm = alive(STATE.band?.members || []).find(x => x.id === id);
  return mm ? mm.name : '';
}

function setSearch(q){ UI.search=(q||'').toLowerCase(); render(); }

function matchesSearch(text){ return !UI.search || (text||'').toLowerCase().includes(UI.search); }
function hasTag(m){
  if(!UI.search.startsWith('#')) return true;
  const tag = UI.search.trim(); return (m.tags||[]).includes(tag);
}

// ====== Lógica de Estado ======
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
      {id: 'qa1', label:'+ Venta merch', amount: 5000, kind:'ingreso', scope:'comun', category:'Merch', note:'Venta mesa'},
      {id: 'qa2', label:'+ Nafta', amount: -10000, kind:'gasto', scope:'comun', category:'Transporte', note:'Combustible'},
      {id: 'qa3', label:'+ Peaje', amount: -1500, kind:'gasto', scope:'comun', category:'Peajes', note:'Peaje'}
    ];
    state.shows.forEach(s=>{ s.closedAt ||= null; s.requerimientos ||= ''; });
    state.version = 2;
  }
  return state;
}

function save(){ localStorage.setItem(KEY, JSON.stringify(STATE)); }

function snapshot(){ LASTS.push(JSON.stringify(STATE)); if (LASTS.length>3) LASTS.shift(); }

function load(){
  if (DEBUG) console.log('load: starting');
  try {
    const rawState = localStorage.getItem(KEY);
    if (DEBUG) console.log('load: raw state from localStorage', rawState);

    let loadedState = JSON.parse(rawState);
    if (DEBUG) console.log('load: parsed state', loadedState);

    if (!loadedState) {
      if (DEBUG) console.log('load: no state found, using default');
      loadedState = DEFAULT_STATE;
    }

    if (DEBUG) console.log('load: migrating state');
    const migratedState = migrate(loadedState);
    if (DEBUG) console.log('load: migration complete', migratedState);

    return migratedState;
  }
  catch(e) {
    console.error('[SOUP] Error loading state:', e);
    alert('Ocurrió un error al cargar los datos. Se reiniciará la aplicación con datos limpios.');
    // Si todo falla, empezar de cero
    localStorage.removeItem(KEY);
    return migrate(DEFAULT_STATE);
  }
}

function mutateState(mutationFn) {
  if (DEBUG) console.log('mutateState');
  snapshot();
  mutationFn();
  save();
  render();
}

function undo() {
  if (DEBUG) console.log('undo');
  if(!LASTS.length) return toast('Nada para deshacer.');
  STATE = JSON.parse(LASTS.pop());
  save();
  render();
  toast('Deshecho.', 'success');
}

// ====== Lógica de Negocio (Cálculos) ====== 
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

function amountBase(m){ return m.amount * (m.kind==='ingreso'?1:-1) * (m.fx_rate||1); }
function totalsByCategory(list){
  const map = {};
  list.forEach(m=>{ const k=m.category||'General'; map[k]=(map[k]||0)+amountBase(m); });
  return map; // {Categoria: netoBase}
}

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

function alive(arr) { return arr.filter(x=>!x.deletedAt); }
window.alive = alive;

// ====== Acciones ====== 
function removeMember(id){
  const i = STATE.band.members.findIndex(m=>m.id===id);
  if(i===-1) return;
  const hasMoves = STATE.moves.some(m=>m.memberId===id);
  if (hasMoves) return toast('No se puede borrar: tiene movimientos personales.');
  if(!confirm('¿Seguro?')) return;
  // en vez de borrar duro, marcá como eliminado
  mutateState(()=> STATE.band.members[i] = markDeleted(STATE.band.members[i]));
}
function addMember(name, role){ if (DEBUG) console.log('addMember', { name, role }); mutateState(() => STATE.band.members.push(stampNew({id:uid(), name, role}))); }
function addShow(data){ if (DEBUG) console.log('addShow', { data }); mutateState(() => STATE.shows.push(stampNew({id:uid(), state:'pendiente', ...data}))); }
function updateShow(id, data){ if (DEBUG) console.log('updateShow', { id, data }); mutateState(() => { const index = STATE.shows.findIndex(s=>s.id===id); if(index!==-1) STATE.shows[index] = {...STATE.shows[index], ...data}; }); }
function setState(id, newState){ 
  if (DEBUG) console.log('setState', { id, newState }); 
  if (newState === 'realizado' && !confirm('¿Marcar show como realizado?')) return;
  mutateState(() => { const s=STATE.shows.find(s=>s.id===id); if(s && s.state!=='realizado') s.state=newState; }); 
}
function cancelShow(id){
  const s = STATE.shows.find(s=>s.id===id);
  if (!s) return;
  if (s.state === 'realizado') return toast('No se puede cancelar un show realizado.');
  if (!confirm('¿Estás seguro de que quieres cancelar este show?')) return;
  const motivo = prompt('Motivo de cancelación');
  if(!motivo) return;
  mutateState(()=>{ s.state='cancelado'; s.cancelReason=motivo; });
}

function closeShow(id){ const s=STATE.shows.find(x=>x.id===id); if(!s) return; if(!confirm('Cerrar show?')) return; mutateState(()=>{ s.closedAt = Date.now(); }); } 
function reopenShow(id){ const s=STATE.shows.find(x=>x.id===id); if(!s) return; if(!confirm('Reabrir show?')) return; mutateState(()=>{ s.closedAt = null; }); } 
function isClosed(s){ return !!s.closedAt; }

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

// ====== Helpers UI ====== 
function open(html){ 
  if (DEBUG) console.log('open'); 
  modal.innerHTML = html; 
  modal.showModal(); 

  // Enfocar el primer campo interactivo al abrir
  document.querySelector('#modal input, #modal select, #modal textarea, #modal button')?.focus({preventScroll:true});

  // Cerrar con ESC sin perder estado
  document.getElementById('modal').addEventListener('cancel', (e)=>{ e.preventDefault(); modal.close('cancel'); }, { once:true });

  // Evitar scroll del body cuando el modal está abierto
  document.body.style.overflow = 'hidden';
  modal.addEventListener('close', ()=>{ document.body.style.overflow = ''; }, { once:true });
}
function close(){ if (DEBUG) console.log('close'); modal.close(); }
function input(name, attrs='') { return `<div class="field"><label>${esc(name)}<input ${attrs}></label></div>` }
function toast(msg, level='error') {
  if (DEBUG) console.log('toast', { msg, level });
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.background = level === 'error' ? 'red' : 'darkgreen';
  el.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('show'), 3000);
}

function log(evt, payload){ if(!DEBUG) return; console.groupCollapsed(`[SOUP] ${evt} @ ${new Date().toLocaleTimeString()}`); console.log(payload||'(sin payload)'); console.groupEnd(); }

snapshot = (function(orig){ return function(){ if(DEBUG) log('snapshot(before)', STATE); orig.apply(this, arguments); if(DEBUG) log('snapshot(after)', {depth:LASTS?.length||0}); }; })(snapshot);

const _save = save; save = function(){ if(DEBUG) log('save', STATE); _save(); };

// ====== Formularios y Menús ====== 
function openSettings() {
  if (DEBUG) console.log('openSettings');
  const hasPin = !!STATE.band.pin;
  open(`<form method="dialog" class="card">
      <h3>Ajustes</h3>
      <ul class="menu">
        <li><button value="pin">${esc(hasPin ? 'Cambiar' : 'Crear')} PIN</button></li>
        ${hasPin ? `<li><button value="remove_pin">Quitar PIN</button></li>` : ''}
        <li><button value="run_tests">Correr Tests</button></li>
        <li><button value="run_hotfix_tests">Correr Tests de Hotfix</button></li>
      </ul>
    </form>`);
  modal.addEventListener('close', () => {
    if (modal.returnValue === 'pin') {
      const newPin = prompt('Ingresá un nuevo PIN de 4 dígitos');
      if (newPin && newPin.length === 4 && !isNaN(newPin)) {
        mutateState(() => STATE.band.pin = strHash(newPin));
        toast('PIN guardado.', 'success');
      } else if (newPin) {
        toast('El PIN debe ser de 4 números.');
      }
    } else if (modal.returnValue === 'remove_pin') {
      mutateState(() => STATE.band.pin = null);
      toast('PIN eliminado.', 'success');
    } else if (modal.returnValue === 'run_tests') {
      runTests();
    } else if (modal.returnValue === 'run_hotfix_tests') {
      runHotfixTests();
    }
  }, { once: true });
}

function openMenu(type, id) {
  if (DEBUG) console.log('openMenu', { type, id });
  const isShow = type === 'show';
  open(`<form method="dialog" class="card">
      <ul class="menu">
        <li><button value="edit">Editar</button></li>
        ${isShow ? '<li><button value="duplicate">Duplicar</button></li>' : ''}
        <li><button value="delete">Eliminar</button></li>
      </ul>
    </form>`);
  modal.addEventListener('close', () => {
    if (modal.returnValue === 'delete') deleteItem(type, id);
    else if (modal.returnValue === 'edit') { if (isShow) openShowForm(id); else openMoveForm(id); }
    else if (modal.returnValue === 'duplicate' && isShow) openShowForm(id, true);
  }, { once: true });
}

function openShowActions(showId) {
  const s = STATE.shows.find(s => s.id === showId);
  if (!s) return;
  open(`<form method="dialog" class="card">
      <h3>Acciones del Show</h3>
      <ul class="menu">
        <li><button value="edit">Editar</button></li>
        <li><button value="duplicate">Duplicar</button></li>
        <li><button value="delete">Eliminar</button></li>
        <hr>
        <li><button value="confirmado">Confirmar</button></li>
        <li><button value="realizado">Realizado</button></li>
        <li><button value="cancelado">Cancelar</button></li>
        <hr>
        <li><button value="close" ${isClosed(s)?'disabled':''}>Cerrar</button></li>
        <li><button value="reopen" ${!isClosed(s)?'disabled':''}>Reabrir</button></li>
      </ul>
      <menu><button type="button" class="btn" value="cancel" onclick="modal.close()">Cerrar</button></menu>
    </form>`);
  modal.addEventListener('close', () => {
    const action = modal.returnValue;
    if (action === 'edit') openShowForm(showId);
    else if (action === 'duplicate') openShowForm(showId, true);
    else if (action === 'delete') deleteItem('show', showId);
    else if (action === 'confirmado') setState(showId, 'confirmado');
    else if (action === 'realizado') setState(showId, 'realizado');
    else if (action === 'cancelado') cancelShow(showId);
    else if (action === 'close') closeShow(showId);
    else if (action === 'reopen') reopenShow(showId);
  }, { once: true });
}

function deleteItem(type, id) {
  if (DEBUG) console.log('deleteItem', { type, id });
  if (!confirm('¿Estás seguro de que querés eliminar esto?')) return;
  if (type === 'show') deleteShow(id);
  else if (type === 'move') deleteMove(id);
  toast('Elemento eliminado.', 'success');
}

function deleteShow(id){
  mutateState(()=>{
    const i = STATE.shows.findIndex(s=>s.id===id);
    if(i!==-1) STATE.shows[i] = markDeleted(STATE.shows[i]);
  });
}
function deleteMove(id){
  mutateState(()=>{
    const i = STATE.moves.findIndex(m=>m.id===id);
    if(i!==-1) STATE.moves[i] = markDeleted(STATE.moves[i]);
  });
}

function openMemberForm() {
  if (DEBUG) console.log('openMemberForm');
  open(`<form method="dialog" class="card">
      <h3>Nuevo integrante</h3>
      ${input('Nombre','id="f-name" required')}
      ${input('Rol','id="f-role"')}
      <menu><button value="cancel" formnovalidate>Cancelar</button><button class="btn primary" value="default">Guardar</button></menu>
    </form>`);
  modal.addEventListener('close',()=>{ 
    if(modal.returnValue !== 'default') return;
    const nameInput = document.getElementById('f-name');
    if (!nameInput.value) { nameInput.classList.add('invalid'); return toast('El nombre es obligatorio.'); }
    addMember(nameInput.value, document.getElementById('f-role').value);
  }, {once:true});
}

function openShowForm(id, duplicate = false) {
  if (DEBUG) console.log('openShowForm', { id, duplicate });
  const show = id ? STATE.shows.find(s => s.id === id) : {};
  const title = id ? (duplicate ? 'Duplicar show' : 'Editar show') : 'Nuevo show';
  open(`<form method="dialog" class="card">
      <h3>${esc(title)}</h3>
      ${input('Fecha',`id="f-date" type="date" required value="${show?.date || dayjs().format('YYYY-MM-DD')}"`)}
      ${input('Ciudad',`id="f-city" required value="${esc(show?.city || '')}"`)}
      ${input('Venue',`id="f-venue" value="${esc(show?.venue || '')}"`)}
      ${input('Cache',`id="f-cache" type="number" inputmode="numeric" min="0" value="${show?.cache || 0}"`)}
      <div class="field"><label>Requerimientos (Rider)<textarea id="f-rider">${esc(show?.requerimientos || '')}</textarea></label></div>
      <menu><button value="cancel" formnovalidate>Cancelar</button><button class="btn primary" value="default">Guardar</button></menu>
    </form>`);
  modal.addEventListener('close',()=> {
    if(modal.returnValue !== 'default') return;
    const dateInput = document.getElementById('f-date');
    const cityInput = document.getElementById('f-city');
    let valid = true;
    if (!dateInput.value) { dateInput.classList.add('invalid'); valid = false; }
    if (!cityInput.value) { cityInput.classList.add('invalid'); valid = false; }
    if (!valid) return toast('Completá los campos obligatorios.');
    const data = {
      date: dateInput.value,
      city: cityInput.value,
      venue: document.getElementById('f-venue').value,
      cache: Number(document.getElementById('f-cache').value||0),
      requerimientos: document.getElementById('f-rider').value
    };
    if (id && !duplicate) updateShow(id, data); else addShow(data);
  }, {once:true});
}

function openMoveForm(id){
  if (DEBUG) console.log('openMoveForm', { id });
  const move = id ? STATE.moves.find(m => m.id === id) : {};
  const memberOpts = alive(STATE.band?.members || []).map(m=>`<option value="${m.id}" ${move?.memberId === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
  const showOpts = ['<option value="">(ninguno)</option>'].concat(alive(STATE.shows).map(s=>`<option value="${s.id}" ${move?.showId === s.id ? 'selected' : ''}>${s.date} ${s.city}</option>`)).join('');
  open(`<form method="dialog" class="card">
      <h3>${id ? 'Editar' : 'Nuevo'} movimiento</h3>
      <div class="field"><label>Tipo<select id="f-kind"><option value="ingreso" ${move?.kind === 'ingreso' ? 'selected' : ''}>Ingreso</option><option value="gasto" ${move?.kind === 'gasto' ? 'selected' : ''}>Gasto</option></select></label></div>
      <div class="field"><label>Alcance<select id="f-scope"><option value="comun" ${move?.scope === 'comun' ? 'selected' : ''}>Común</option><option value="personal" ${move?.scope === 'personal' ? 'selected' : ''}>Personal</option></select></label></div>
      <div class="field" id="f-member-wrap" style="display:none"><label>Integrante<select id="f-member">${memberOpts}</select></label></div>
      ${input('Monto',`id="f-amount" type="number" inputmode="numeric" min="1" required value="${move?.amount || ''}"`)}
      <div class="chip-bar">${[2000, 5000, 10000].map(p => `<button type="button" class="chip" onclick="document.getElementById('f-amount').value = ${p}">${p/1000}k</button>`).join('')}</div>
      <div class="field"><label>Categoría
        <input id="f-cat" list="cat-list" placeholder="General" value="${move?.category || 'General'}" />
      </label></div>
      <datalist id="cat-list">
        <option>Merch</option><option>Transporte</option><option>Comida</option>
        <option>Alojamiento</option><option>Peajes</option><option>Alquiler equipo</option>
      </datalist>
      <div class="field"><label>Tags (usa #)
        <input id="f-tags" placeholder="#peaje #ruta" value="${(move?.tags || []).join(' ')}" />
      </label></div>
      <div class="row-2">
        <div class="field" style="flex:1"><label>Moneda
          <input id="f-cur" value="${move?.currency || 'ARS'}" maxlength="3" />
        </label></div>
        <div class="field" style="flex:1"><label>FX (a base)
          <input id="f-fx" type="number" step="0.0001" value="${move?.fx_rate || 1}" />
        </label></div>
      </div>
      ${input('Nota',`id="f-note" value="${esc(move?.note || '')}"`)}
      <div class="field"><label>Show<select id="f-show">${showOpts}</select></label></div>
      <menu><button class="btn" value="cancel" formnovalidate>Cancelar</button><button class="btn primary" value="default">Guardar</button></menu>
    </form>`);
  const scopeSel = document.getElementById('f-scope');
  const wrap = document.getElementById('f-member-wrap');
  const updateMemberVisibility = () => wrap.style.display = scopeSel.value === 'personal' ? 'block' : 'none';
  scopeSel.onchange = updateMemberVisibility;
  updateMemberVisibility();
  modal.addEventListener('close',()=> {
    if(modal.returnValue !== 'default') return;
    const amountInput = document.getElementById('f-amount');
    const amount = Number(amountInput.value);
    if (amount <= 0) { amountInput.classList.add('invalid'); return toast('El monto debe ser mayor a cero.'); }
    const scope = document.getElementById('f-scope').value;
    const memberId = scope==='personal' ? document.getElementById('f-member').value : null;
    if (scope === 'personal' && !memberId) return toast('Elegí un integrante para el movimiento personal.');
    const data = { 
      kind: document.getElementById('f-kind').value, 
      scope, 
      amount, 
      note: document.getElementById('f-note').value, 
      memberId, 
      showId: document.getElementById('f-show').value || null,
      category: document.getElementById('f-cat').value || 'General',
      tags: (document.getElementById('f-tags').value||'').split(/\s+/).filter(Boolean).map(t=>t.startsWith('#')?t:`#${t}`),
      currency: (document.getElementById('f-cur').value||'ARS').toUpperCase(),
      fx_rate: Number(document.getElementById('f-fx').value||1)
    };

    if (id) updateMove(id, data); 
    else addMove(data);
  }, {once:true});
}

function setCashFilter(filter) {
  if (DEBUG) console.log('setCashFilter', { filter });
  cashFilter = filter;
  render();
}

// ====== Renderizado ====== 
const isDesktop = () => window.matchMedia('(min-width: 1200px)').matches;

function render(){
  if (DEBUG) console.log('render', { currentTab, cashFilter, search: UI.search });
  appTitleEl.textContent = 'SOUP Tours';
  
  if (isDesktop()) {
    view.classList.add('desk-grid');
    renderDesktop();
  } else {
    view.classList.remove('desk-grid');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === currentTab));
    if(currentTab==='home') view.innerHTML = buildHomeHTML();
    if(currentTab==='shows') view.innerHTML = buildShowsHTML();
    if(currentTab==='cash') view.innerHTML = buildCashHTML();
  }
}

function renderDesktop(){
  view.innerHTML = `
    <div class="phone-frame">
      <div class="panel-header">Inicio</div>
      <div class="phone-scroll">${buildHomeHTML()}</div>
    </div>
    <div class="phone-frame">
      <div class="panel-header">Shows</div>
      <div class="phone-scroll">${buildShowsHTML()}</div>
    </div>
    <div class="phone-frame">
      <div class="panel-header">Caja</div>
      <div class="phone-scroll">${buildCashHTML()}</div>
    </div>
  `;
}

function buildHomeHTML(){
  if (DEBUG) console.log('renderHome');
  const {comun, per} = balances();
  const quickActionsHTML = (STATE.quickActions||[]).map(q=> 
    `<button class="btn quick-action" onclick="quickAction('${q.id}')">${esc(q.label)}</button>`
  ).join('');
  const fundsHTML = alive(STATE.band.members).map(m=>`<div class="fund-row"><span>${esc(m.name)}</span><span class="amount">${(per[m.id]||0).toLocaleString()}</span></div>`).join('');
  
  return `
    <section class="card">
      <div class="row"><h2 class="band-name">${esc(STATE.band.name)}</h2><button class="ghost" onclick="openBandNameForm()">Editar</button></div>
    </section>
    <section class="card">
      <div class="row"><h3>Acciones Rápidas</h3><button class="ghost" onclick="openQuickActionsForm()">⚙️</button></div>
      <div class="quick-actions-list">${quickActionsHTML}</div>
    </section>
    <section class="card">
      <h3>Fondos</h3>
      <div class="funds-list">
        <div class="fund-row"><strong>Fondo Común</strong><strong class="amount">${comun.toLocaleString()}</strong></div>
        ${fundsHTML}
      </div>
    </section>
    <section class="card"><h3>Miembros</h3>
      <div class="list">${alive(STATE.band.members).map(m=>`<div class="row"><div>${esc(m.name)} • ${esc(m.role||'')}</div><button class="ghost" onclick="removeMember('${m.id}')">Quitar</button></div>`).join('')}</div>
      <button class="btn" onclick="openMemberForm()">+ Integrante</button>
    </section>`;
}

function buildShowsHTML(){
  if (DEBUG) console.log('renderShows');
  const shows = alive(STATE.shows) 
    .filter(s => matchesSearch(s.city) || matchesSearch(s.venue))
    .sort((a,b) => dayjs(a.date).isBefore(dayjs(b.date)) ? -1 : 1);
  const rows = shows.map(s=>`
    <div class="card">
      <div class="show-card-grid">
        <div class="show-card-date">${dayjs(s.date).format('DD/MM/YY')}</div>
        <div class="show-card-city"><strong>${esc(s.city)}</strong></div>
        <div class="show-card-venue">${esc(s.venue||'')}</div>
        <div class="show-card-state"><span class="badge ${s.state} ${isClosed(s)?'closed':''}">${esc(s.state)}</span></div>
        <div class="show-card-cache">Cache: ${(s.cache||0).toLocaleString()}</div>
        <div class="show-card-balance">Balance: ${getShowBalance(s.id).comun.toLocaleString()}</div>
        <div class="show-card-actions">
          <button class="menu-btn" onclick="openShowActions('${s.id}')">Acciones</button>
        </div>
      </div>
    </div>`).join('');
  return `<button class="btn" onclick="openShowForm()">+ Show</button>${rows || '<p class="card">Sin shows</p>'}`;
}

function buildCashHTML(){
  if (DEBUG) console.log('renderCash');
  const getFilterClass = f => f === cashFilter ? 'chip active' : 'chip';
  const memberChips = alive(STATE.band.members).map(m => `<button class="${getFilterClass(m.id)}" onclick="setCashFilter('${m.id}')">${esc(m.name)}</button>`).join('');
  const chips = `<div class="chip-bar">
      <button class="${getFilterClass('all')}" onclick="setCashFilter('all')">Todos</button>
      <button class="${getFilterClass('comun')}" onclick="setCashFilter('comun')">Común</button>
      <button class="${getFilterClass('personal')}" onclick="setCashFilter('personal')">Personal</button>
      ${memberChips}
    </div>`;
  let filteredMoves = alive(STATE.moves);
  if (cashFilter === 'comun') filteredMoves = filteredMoves.filter(m => m.scope === 'comun');
  else if (cashFilter === 'personal') filteredMoves = filteredMoves.filter(m => m.scope === 'personal');
  else if (cashFilter !== 'all') filteredMoves = filteredMoves.filter(m => m.memberId === cashFilter);
  if (UI.search) {
    filteredMoves = filteredMoves.filter(m => {
      if (UI.search.startsWith('#')) {
        return hasTag(m);
      }
      const show = m.showId ? STATE.shows.find(s=>s.id===m.showId) : null;
      const hay = [
        m.note || '',
        show?.city || '',
        show?.venue || ''
      ].join(' ').toLowerCase();
      return hay.includes(UI.search);
    });
  }
  const ingresos = filteredMoves.filter(m=>m.kind==='ingreso').reduce((sum, m) => sum + m.amount, 0);
  const gastos = filteredMoves.filter(m=>m.kind==='gasto').reduce((sum, m) => sum + m.amount, 0);
  const net = ingresos - gastos;
  const totals = `<div class="totals">
      <div><div class="label">Ingresos</div><div class="amount-lg move-ingreso">${ingresos.toLocaleString()}</div></div>
      <div><div class="label">Gastos</div><div class="amount-lg move-gasto">${gastos.toLocaleString()}</div></div>
      <div><div class="label">Neto</div><div class="amount-lg">${net.toLocaleString()}</div></div>
    </div>`;
  const rows = filteredMoves.map(m => `
    <div class="card move-${m.kind}">
      <div class="move-card-grid">
        <div class="move-card-amount"><span class="amount-lg">${m.kind==='ingreso'?'+':'-'} ${m.amount.toLocaleString()} ${m.currency}</span></div>
        <div class="move-card-date"><small class="muted">${new Date(m.ts).toLocaleDateString('es-ES', {year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'})}</small></div>
        <div class="move-card-details">
          <p>${esc(m.scope)}${m.memberId?` (${esc(memberName(m.memberId))})`:''} • ${esc(m.note||'')}</p>
          <p><small class="muted">${m.showId?esc(STATE.shows.find(s=>s.id===m.showId)?.city):''}</small></p>
        </div>
        <div class="move-card-actions"><button class="menu-btn" onclick="openMenu('move', '${m.id}')">⋮</button></div>
      </div>
    </div>
  `).join('');
  return `<button class="btn" onclick="openMoveForm()">+ Movimiento</button>${chips}${totals}<div class="card list">${rows||'<em>Sin movimientos para este filtro</em>'}</div>`;
}

// ====== Clock ====== 
let clockInterval;
function updateClock() {
  const clockEl = document.getElementById('clock');
  if (!clockEl) return;
  clockEl.textContent = new Date().toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit', second:'2-digit'});
}

// ====== Lógica de PIN ====== 
function numpadClick(val) {
  if (DEBUG) console.log('numpadClick', { val });
  if (val === 'del') enteredPin = enteredPin.slice(0, -1);
  else if (enteredPin.length < 4) enteredPin += val;
  
  for (let i = 0; i < 4; i++) { pinDots.children[i].classList.toggle('filled', i < enteredPin.length); }
  
  if (enteredPin.length === 4) {
    setTimeout(() => {
      if (strHash(enteredPin) === STATE.band.pin) {
        pinScreen.style.display = 'none';
      } else {
        toast('PIN incorrecto');
        enteredPin = '';
        for (let i = 0; i < 4; i++) { pinDots.children[i].classList.remove('filled'); }
      }
    }, 100);
  }
}

function checkPin() {
  if (DEBUG) console.log('checkPin');
  if (!STATE.band.pin) return;
  pinScreen.style.display = 'flex';
  const buttons = ['1','2','3','4','5','6','7','8','9','','0','del'];
  numpad.innerHTML = buttons.map(b => b ? `<button type="button" onclick="numpadClick('${b}')">${b === 'del' ? '⌫' : b}</button>` : '<div></div>').join('');
}

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

function isValidState(obj){
  return obj && obj.band && Array.isArray(obj.band.members)
      && Array.isArray(obj.shows) && Array.isArray(obj.moves);
}

function assertEq(a,b,msg){ if(a!==b){ console.error('ASSERT FAIL:', msg, {a,b}); throw new Error(msg); } }
function runTests(){
  const st = JSON.parse(JSON.stringify(STATE));
  try{
    DEBUG=true; console.group('[TEST]');
    const before = STATE.moves.length;
    addMove({kind:'ingreso',scope:'comun',amount:1000,note:'test',category:'Merch',currency:'ARS',fx_rate:1});
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

// ====== Inicialización ====== 
window.addEventListener('DOMContentLoaded', () => {
  if (DEBUG) console.log('DOMContentLoaded');

  // Asignar elementos del DOM
  view = document.getElementById('view');
  tabs = document.querySelectorAll('.tabs>button');
  modal = document.getElementById('modal');
  fab = document.getElementById('fab');
  btnImport = document.getElementById('input-import');
  btnUndo = document.getElementById('btn-undo');
  btnSettings = document.getElementById('btn-settings');
  appTitleEl = document.getElementById('app-title');
  pinScreen = document.getElementById('pin-screen');
  pinDots = document.getElementById('pin-dots');
  numpad = document.getElementById('numpad');

  // Asignar Event Listeners
  tabs.forEach(b=>b.addEventListener('click',()=>{ 
    currentTab=b.dataset.tab;
    render(); 
  }));
  fab.onclick = ()=>{ 
    if(currentTab==='shows') openShowForm(); else openMoveForm(); 
  };
  btnImport.onchange = (e)=>{
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const incoming = JSON.parse(reader.result);
        if(!incoming || !incoming.band || !Array.isArray(incoming.moves)) return toast('Backup inválido');

        // Migrate incoming state to current version
        const migratedIncoming = migrate(incoming);

        const choice = prompt('Escribí:\nR = Reemplazar todo\nM = Fusionar (merge)');
        if(!choice) return;

        if(choice.toUpperCase()==='R'){
          mutateState(()=> STATE = migratedIncoming);
          toast('Estado reemplazado.', 'success');
        } else if(choice.toUpperCase()==='M'){
          const merged = mergeState(STATE, migratedIncoming);
          mutateState(()=> STATE = merged);
          toast('Estados fusionados.', 'success');
        } else {
          toast('Opción cancelada.');
        }
      }catch(err){ console.error('[SOUP] Error importing state:', err); alert('JSON inválido. Revisá la consola.'); }
    };
    reader.readAsText(file);
  };
  btnUndo.onclick = undo;
  btnSettings.onclick = openSettings;

  const btnMore = document.getElementById('btn-more');
  if (btnMore) {
    btnMore.onclick = () => {
      open(`<form method="dialog" class="card">
        <h3>Acciones</h3>
        <ul class="menu">
          <li><button value="csv">Exportar CSV (Movimientos)</button></li>
          <li><button value="liq">Exportar CSV (Liquidación)</button></li>
          <li><button value="backup">Exportar Backup JSON</button></li>
          <li><button value="import">Importar Backup</button></li>
          <li><button value="tests">Correr Tests</button></li>
        </ul>
        <menu><button class="btn" value="cancel">Cerrar</button></menu>
      </form>`);
      modal.addEventListener('close', () => {
        if (modal.returnValue === 'csv') exportCSV?.();
        else if (modal.returnValue === 'liq') liquidationCSV?.();
        else if (modal.returnValue === 'backup') {
          const blob = new Blob([JSON.stringify(STATE,null,2)], {type:'application/json'});
          const a = Object.assign(document.createElement('a'), {
            href: URL.createObjectURL(blob),
            download: `soup_tours_${new Date().toISOString().slice(0,10)}.json`
          });
          a.click(); URL.revokeObjectURL(a.href);
          toast('Backup exportado.', 'success');
        } else if (modal.returnValue === 'import') {
          btnImport.click();
        } else if (modal.returnValue === 'tests') runTests?.();
      }, { once:true });
    };
  }

  // Renderizado Inicial
  render();
  checkPin();
  
  // Iniciar Reloj
  if(clockInterval) clearInterval(clockInterval);
  clockInterval = setInterval(updateClock, 1000);
  updateClock();
});
