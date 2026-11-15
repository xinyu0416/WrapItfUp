/* Shared popup/focus behavior. Installed before the assembly keyboard router. */
(function(root){'use strict';if(!root.document)return;
const d=root.document,$=(s,r=d)=>r.querySelector(s),all=(s,r=d)=>[...r.querySelectorAll(s)];
const isMenu=el=>el?.matches?.('details.r69-menu,details.fg-related-tools');
function close(menu,restore=false){const panel=menu.querySelector(':scope>div');if(panel?.matches(':popover-open'))panel.hidePopover();menu.open=false;if(restore)$('summary',menu)?.focus({preventScroll:true});}
root.addEventListener('keydown',e=>{if(e.key!=='Escape'||e.isComposing)return;const dialog=$('dialog[open]'),menus=all('details.r69-menu[open],details.fg-related-tools[open]').filter(m=>!dialog||dialog.contains(m));if(!menus.length)return;e.preventDefault();e.stopImmediatePropagation();close(menus.find(m=>m.contains(e.target))||menus.at(-1),true);},true);
d.addEventListener('pointerdown',e=>{for(const menu of all('details.r69-menu[open],details.fg-related-tools[open]'))if(!menu.contains(e.target))close(menu);},true);
function position(menu){const panel=menu.querySelector(':scope>div'),trigger=$('summary',menu);if(!panel||!trigger)return;if(panel.showPopover){panel.setAttribute('popover','manual');if(!panel.matches(':popover-open'))panel.showPopover();}const r=trigger.getBoundingClientRect();panel.style.margin='0';panel.style.position='fixed';panel.style.bottom='auto';panel.style.right='auto';panel.style.top=r.bottom+5+'px';panel.style.maxHeight=Math.max(90,root.innerHeight-r.bottom-18)+'px';const width=panel.getBoundingClientRect().width;panel.style.left=Math.max(10,Math.min(r.left,root.innerWidth-width-10))+'px';if(root.innerHeight-r.bottom<220&&r.top>root.innerHeight/2){panel.style.top='auto';panel.style.bottom=root.innerHeight-r.top+5+'px';panel.style.maxHeight=Math.max(90,r.top-18)+'px';}}
d.addEventListener('toggle',e=>{if(!isMenu(e.target))return;if(!e.target.open){const panel=e.target.querySelector(':scope>div');if(panel?.matches(':popover-open'))panel.hidePopover();return;}for(const m of all('details.r69-menu[open],details.fg-related-tools[open]'))if(m!==e.target&&!m.contains(e.target))close(m);position(e.target);},true);
root.addEventListener('resize',()=>all('details.r69-menu[open],details.fg-related-tools[open]').forEach(position));d.addEventListener('scroll',()=>all('details.r69-menu[open],details.fg-related-tools[open]').forEach(position),true);
d.addEventListener('keydown',e=>{if(e.key==='ArrowDown'&&e.target.matches('details.r69-menu>summary')){e.preventDefault();const menu=e.target.parentElement;menu.open=true;menu.querySelector('button:not([disabled]),input,select')?.focus();}});
let queued=false;
function sync(){
 const toolbar=$('.wb-canvas-head .r118-primary-tools');
 if(toolbar&&!toolbar.dataset.r119){toolbar.dataset.r119='1';const top=$('[data-action="wb-graph"] .r119-view-tabs');
  const labels=[['[data-action="graph-add"]','新增'],['[data-action="graph-connect-mode"]','接線']];
  for(const [selector,label]of labels){const el=$(selector,toolbar);if(el){const marker=d.createElement('span');marker.className='r119-toolbar-label';marker.textContent=label;el.before(marker);}}
 }
 const inspector=$('#inspectorPanel');if(inspector){const empty=$('#inspectorEmpty',inspector);if(empty&&!empty.hidden&&empty.textContent!=='點選圖上的訊號，或從訊號表選取一列。'){empty.textContent='點選圖上的訊號，或從訊號表選取一列。';}inspector.classList.toggle('r119-no-selection',!!empty&&!empty.hidden);}
 for(const panel of all('#r111-find,#r74-find')){const head=$('header',panel);if(head&&!$('[data-r119-collapse]',head)){const b=d.createElement('button');b.type='button';b.dataset.r119Collapse='';b.textContent='收合';b.onclick=()=>{const on=panel.classList.toggle('r119-dock-minimized');b.textContent=on?'展開':'收合';b.setAttribute('aria-expanded',String(!on));};head.append(b);}}
 for(const tool of all('[data-r116-edit]')){if(['cut','copy','duplicate','delete'].includes(tool.dataset.r116Edit))tool.hidden=false;}
 const native=$('.desk-switchbar .r118-edit-row');if(native&&!$('[data-r119-current]',native)){const label=d.createElement('span');label.className='r119-selected-label';label.dataset.r119Current='';native.prepend(label);}
 const label=$('[data-r119-current]');if(label){const count=root.WIUPortEditing?.selectionCount?.()||0;const text=count?'已選 '+count+' 個接腳':'選取接腳後可編輯';if(label.textContent!==text)label.textContent=text;}
 for(const el of all('.r119-connections [data-r118-edit-status]'))if(['已套用','與目前設定相同','尚未決定用途','已明確指定不接'].includes(el.textContent))el.textContent='';
}
const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;sync();});};
new MutationObserver(schedule).observe(d.body,{subtree:true,childList:true,characterData:true});d.addEventListener('click',schedule);d.addEventListener('keyup',schedule);root.WIUWorkspaceR119={sync,closeMenus:()=>all('details.r69-menu[open]').forEach(m=>close(m))};schedule();
})(globalThis);
