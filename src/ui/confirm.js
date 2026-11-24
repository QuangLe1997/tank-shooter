// ui/confirm.js — XK-UI ONE CONFIRMATION DIALOG (#xkConfirm) for the choices that throw something away: leaving a battle, restarting a stage, wiping progress. It opens over whatever screen asked; the safe answer is the default (Esc / B / its own button).
import { hide, show, sfx, tapBtn } from '../hub.js';

let _ask = null;
// o = { title, body, yes, no, danger } — onYes runs after the dialog closes; onNo (optional) when the player keeps things as they are
export function askConfirm(o, onYes, onNo){ const d = document.getElementById('xkConfirm'); if(!d){ if(onYes) onYes(); return; }
  const put = (id, t) => { const e = document.getElementById(id); if(e) e.textContent = t || ''; };
  put('xkcT', o.title); put('xkcB', o.body); put('xkcNo', o.no || 'Huỷ'); put('xkcYes', o.yes || 'Đồng ý');
  d.classList.toggle('danger', !!o.danger); _ask = { onYes, onNo }; show('xkConfirm'); sfx('click'); }
export function confirmOpen(){ const d = document.getElementById('xkConfirm'); return !!d && !d.classList.contains('hidden'); }
function answer(yes){ const a = _ask; _ask = null; hide('xkConfirm'); sfx('click'); if(!a) return; if(yes){ if(a.onYes) a.onYes(); } else if(a.onNo) a.onNo(); }
tapBtn('xkcYes', () => answer(true)); tapBtn('xkcNo', () => answer(false));
