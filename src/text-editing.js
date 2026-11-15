(function(){
'use strict';
const histories=new WeakMap(),composing=new WeakSet();let restoring=false,last=null,handledButton=null;
const editable=el=>el?.matches?.('input:not([type=number]):not([type=checkbox]):not([type=radio]),textarea')&&!el.readOnly&&!el.disabled;
function track(el){if(!editable(el))return null;last=el;if(!histories.has(el))histories.set(el,new WIUCanvasEditing.TextHistory(el.value,el.selectionStart||0,el.selectionEnd||0));return histories.get(el);}
function sync(){const h=last&&histories.get(last);for(const b of document.querySelectorAll('[data-text-history]')){const redo=b.dataset.textHistory==='redo';b.disabled=!(redo?h?.future.length:h?.past.length);b.title=(redo?'重做':'復原')+'最近一次文字修改';}}
function step(el,redo){const h=histories.get(el);if(!h)return false;const point=redo?h.redo():h.undo();if(!point)return false;restoring=true;el.value=point.value;el.focus();el.setSelectionRange?.(point.start,point.end);el.dispatchEvent(new Event('input',{bubbles:true}));restoring=false;sync();return true;}
window.addEventListener('focusin',e=>{track(e.target);sync();},true);
window.addEventListener('beforeinput',e=>{const h=track(e.target);if(!h)return;h.current.start=e.target.selectionStart||0;h.current.end=e.target.selectionEnd||0;if(e.inputType==='historyUndo'||e.inputType==='historyRedo'){e.preventDefault();e.stopImmediatePropagation();step(e.target,e.inputType==='historyRedo');}},true);
window.addEventListener('input',e=>{if(restoring||composing.has(e.target))return;const h=track(e.target);if(h)h.record(e.target.value,e.target.selectionStart||0,e.target.selectionEnd||0);sync();},true);
window.addEventListener('compositionstart',e=>{track(e.target);composing.add(e.target);},true);
window.addEventListener('compositionend',e=>{composing.delete(e.target);const h=track(e.target);if(h)h.record(e.target.value,e.target.selectionStart||0,e.target.selectionEnd||0);sync();},true);
window.addEventListener('keydown',e=>{if(!editable(e.target)||!(e.ctrlKey||e.metaKey)||e.isComposing)return;const k=e.key.toLowerCase();if(k!=='z'&&k!=='y')return;e.preventDefault();e.stopImmediatePropagation();step(e.target,k==='y'||e.shiftKey);},true);
window.addEventListener('pointerdown',e=>{const button=e.target.closest?.('[data-text-history],[data-action=undo],[data-action=redo],#undoBtn,#redoBtn,#deskUndoBtn,#deskRedoBtn');if(!button||!last?.isConnected)return;const local=button.hasAttribute('data-text-history'),active=document.activeElement===last||last.closest('#r73-editor:not([hidden])');const redo=(button.dataset.textHistory||button.dataset.action||button.id).toLowerCase().includes('redo'),h=histories.get(last);if(!local&&(!active||last.value===last.defaultValue||!(redo?h?.future.length:h?.past.length)))return;handledButton=button;e.preventDefault();e.stopImmediatePropagation();step(last,(button.dataset.textHistory||button.dataset.action||button.id).toLowerCase().includes('redo'));},true);
window.addEventListener('click',e=>{if(e.target.closest?.('[data-text-history]')||handledButton&&e.target.closest?.('button')===handledButton){e.preventDefault();e.stopImmediatePropagation();handledButton=null;}},true);
})();
