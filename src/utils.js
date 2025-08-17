export const META_KEY = 'soup_tours_meta';
export function getDeviceId(){
  let meta = JSON.parse(localStorage.getItem(META_KEY)||'{}');
  if(!meta.deviceId){ meta.deviceId = 'dev_' + Math.random().toString(36).slice(2,10); localStorage.setItem(META_KEY, JSON.stringify(meta)); }
  return meta.deviceId;
}
export const DEVICE_ID = getDeviceId();

export const uid = (prefix = '') => prefix + Math.random().toString(36).slice(2,9);
export const strHash = s => s.split('').reduce((a,b)=>(a<<5)-a+b.charCodeAt(0),0);

export function esc(s) {
  if (s == null) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function downloadText(filename, text) {
  const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename});
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

export function nowIso(){ return new Date().toISOString(); }
export function stampNew(base){
  return { 
    ...base, 
    createdAt: base.createdAt || nowIso(), 
    updatedAt: nowIso(), 
    originId: DEVICE_ID, 
    deletedAt: base.deletedAt || null 
  };
}
export function stampUpdate(obj, patch){
  return { ...obj, ...patch, updatedAt: nowIso(), originId: DEVICE_ID };
}
export function markDeleted(obj){
  return { ...obj, deletedAt: nowIso(), updatedAt: nowIso(), originId: DEVICE_ID };
}

export function alive(arr) { return arr.filter(x=>!x.deletedAt); }