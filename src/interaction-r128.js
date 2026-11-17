/* Shared interaction primitives. Drafts and focus never redefine connectivity. */
(function(root){'use strict';
function allocateNames(requested,occupied){
 const used=new Set(occupied),reserved=new Set(requested.filter(n=>n&&!/^\s*\/\//.test(n)));
 return requested.map(name=>{if(!name||/^\s*\/\//.test(name))return name;
  if(!used.has(name)){used.add(name);return name;}
  const m=/^(.*?)(\d+)$/.exec(name),stem=m?m[1]:name+'_',width=m?m[2].length:0;
  let n=m?BigInt(m[2])+1n:2n,candidate;
  do{candidate=stem+String(n++).padStart(width,'0');}while(used.has(candidate)||reserved.has(candidate));
  used.add(candidate);return candidate;
 });
}
function wireValue(value,currentRange){
 const m=/^([A-Za-z_$][\w$]*)\s*(\[[^\]\r\n]+:[^\]\r\n]+\])?$/.exec(String(value).trim());
 if(!m)throw Error('請輸入 wire_name 或 wire_name[MSB:LSB]。');
 return {name:m[1],range:m[2]??currentRange??''};
}
const jobs=new Map();let pointer=false,timer=null;
function key(el){if(!el?.matches?.('input,textarea,select'))return null;
 if(el.id)return '#'+el.id;
 const d=el.dataset,owner=el.closest('[data-id],[data-desk-id],[data-inline-group],[data-side]');
 return JSON.stringify([el.tagName,d.gridField||d.deskField||d.inspectField||d.act||'',d.id||owner?.dataset.id||owner?.dataset.deskId||'',d.side||owner?.dataset.side||'',d.connection||'',d.net||'',d.assign||'',d.field||'',d.wireName||'',el.hasAttribute('data-inline-module'),owner?.dataset.inlineGroup||'',el.hasAttribute('data-inline-group-name')]);
}
function preserve(fn){const doc=root.document;if(!doc)return fn();
 const old=doc.activeElement,k=key(old),start=old?.selectionStart,end=old?.selectionEnd;
 const dirty=old?.value!==old?.defaultValue,value=old?.value,invalid=old?.getAttribute?.('aria-invalid');
 fn();if(!k||old?.isConnected)return;
 const next=[...doc.querySelectorAll('input,textarea,select')].find(el=>key(el)===k&&!el.disabled);
 if(next){if(dirty){next.value=value;if(invalid==='true')next.setAttribute('aria-invalid','true');}
  next.focus({preventScroll:true});try{next.setSelectionRange(start,end);}catch{}
 }
}
function flush(){if(pointer)return;const queued=[...jobs.values()];jobs.clear();for(const fn of queued)preserve(fn);}
function paint(name,fn){if(pointer){jobs.set(name,fn);return;}preserve(fn);}
if(root.document){
 root.addEventListener('pointerdown',()=>{pointer=true;clearTimeout(timer);},true);
 const release=()=>{clearTimeout(timer);timer=setTimeout(()=>{pointer=false;flush();},0);};
 root.addEventListener('pointerup',release,true);root.addEventListener('pointercancel',release,true);
 root.addEventListener('blur',release);
}
const api={allocateNames,wireValue,paint,flush,key};root.WIUInteractionR128=api;
if(typeof module==='object')module.exports=api;
})(globalThis);
