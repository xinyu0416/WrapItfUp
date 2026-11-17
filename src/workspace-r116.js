/* r120: one contextual toolbar. Existing commands keep their data/history owners. */
(function(root){'use strict';if(!root.document)return;
const d=root.document,$=(s,r=d)=>r.querySelector(s),all=(s,r=d)=>[...r.querySelectorAll(s)];
const dispatch=(action,id)=>root.WIUWorkspaceUI?.dispatch({dataset:{action,...(id?{id}:{})}});
const text=(e,t)=>{if(e&&e.textContent!==t)e.textContent=t;};
function button(label,run,title){const e=d.createElement('button');e.type='button';e.className='btn';e.textContent=label;e.title=title||label;e.onclick=run;return e;}
function menu(label,items){const e=d.createElement('details');e.className='r69-menu';const s=d.createElement('summary');s.textContent=label;const p=d.createElement('div');items.filter(Boolean).forEach(x=>p.append(x));e.append(s,p);return e;}
function group(name){const e=d.createElement('div');e.className=name;return e;}
function edit(key,label,graph=false){const b=button(label,()=>{if(key==='find'||key==='replace')root.WIUProjectHost?.findInModule(key);else if(graph)root.WIUGraphCommands?.run(key);else root.WIUPortEditing?.[key]?.();});b.dataset.r116Edit=key;b.dataset.r116Graph=String(graph);return b;}
function focus(){const on=d.body.classList.toggle('r110-focus');all('[data-r110-focus]').forEach(b=>b.setAttribute('aria-pressed',String(on)));root.dispatchEvent(new Event('resize'));}
function more(graph){const focusBtn=button('專注編輯',focus,'收合側欄，Esc 返回');focusBtn.dataset.r110Focus='';focusBtn.setAttribute('aria-pressed',String(d.body.classList.contains('r110-focus')));return menu('更多',[edit('find','尋找 · Ctrl+F',graph),edit('replace','取代 · Ctrl+H',graph),edit('cut','剪下 · Ctrl+X',graph),edit('copy','複製 · Ctrl+C',graph),edit('paste','貼上 · Ctrl+V',graph),focusBtn,button('全螢幕展示 · F5',()=>graph?dispatch('graph-fullscreen'):$('#presentBtn')?.click())]);}
function topTabs(current){const e=group('r119-view-tabs r120-top-tabs');e.setAttribute('aria-label','Top 工作檢視');for(const [id,label,action,arg] of [['io','Top I/O','wb-open','top'],['graph','接線圖','wb-graph'],['table','接線表','graph-table']]){const b=button(label,()=>dispatch(action,arg));if(id===current)b.setAttribute('aria-current','page');e.append(b);}return e;}
const native=$('.desk-switchbar');let bar,back,topNav;
if(native){
 const shelf=group('r120-legacy-tools');shelf.hidden=true;[...native.children].forEach(x=>shelf.append(x));native.append(shelf);native.classList.add('r120-toolbar');bar=group('r120-work-tools');native.append(bar);
 back=button('← Top',()=>dispatch('wb-graph'),'返回 Top 接線圖');topNav=topTabs('io');
 const views=group('r120-view-switch');views.setAttribute('role','group');views.setAttribute('aria-label','介面編輯檢視');for(const [mode,label] of [['diagram','介面圖'],['table','訊號表'],['split','並排']]){const b=button(label,()=>root.WIUSignalTable.setMode(mode));b.dataset.signalView=mode;b.setAttribute('aria-pressed',String(root.WIUSignalTable?.mode()===mode));views.append(b);}
 const add=button('＋ 左側訊號',()=>root.WIUSignalTable.addSide('left'),'新增左側 IN；選取列後插入');const right=button('＋ 右側訊號',()=>root.WIUSignalTable.addSide('right'),'新增右側 OUT；選取列後插入');
 const gap=button('＋ 間隔',()=>root.WIUSignalTable.spacer(),'在選取列後插入空白間隔，不產生 RTL');
 const grp=$('#addGroupInline');text(grp,'＋ 群組');
 const preview=$('#toggleArtworkPreview');text(preview,'成圖預覽');if(preview){const prior=preview.onclick;preview.onclick=()=>{const was=root.WIUSignalTable.mode();if(was==='table'&&!preview.dataset.returnMode){preview.dataset.returnMode=was;root.WIUSignalTable.setMode('split');}prior();if(preview.dataset.returnMode&&preview.getAttribute('aria-pressed')!=='true'){root.WIUSignalTable.setMode(preview.dataset.returnMode);delete preview.dataset.returnMode;}};}
 const props=$('#toggleInspector');text(props,'接腳屬性');props.title='圖面模式：完整接腳設定；表格模式：型別、群組、條件與外觀';
 const rtl=$('#r69-diagram-rtl');text(rtl,'RTL 面板');const rtlPanel=$('#rtlPanel'),rtlResize=$('#rtlPanelResizer');$('#workbench').after(rtlResize,rtlPanel);text($('#rtlCopy'),'複製介面宣告');rtl.title='展開 RTL 面板：複製完整內容、群組折疊、獨立排序與調整高度';
 const advanced=more(false),ap=$('div',advanced);for(const id of ['toggleGroups']){const el=$('#'+id);if(el)ap.append(el);}
 const names=$('[data-port-command="names"]');if(names){names.onclick=()=>root.WIUProjectHost.pastePortText();ap.append(names);}
 const copy=edit('duplicate','建立副本'),del=edit('delete','刪除列');copy.dataset.r120SelectedAction='';del.dataset.r120SelectedAction='';
 const create=group('r121-command-group'),selected=group('r121-command-group r121-selection-tools'),inspect=group('r121-command-group');create.append(add,right,gap,grp,menu('條件',[$('#addIfdefInline'),$('#addIfndefInline')]),button('貼上表格',()=>root.WIUSignalTable.paste()));const batch=button('整批編輯',()=>root.WIUSignalTable.batch());batch.dataset.r120SelectedAction='';selected.append(edit('cut','剪下'),edit('copy','複製'),edit('paste','貼上'),copy,batch,del);inspect.append(rtl,preview,props,button('模組設定',()=>dispatch('module-info')));const navigation=group('r122-view-row'),commands=group('r122-command-row'),selectionRow=group('r122-selection-row');navigation.append(back,topNav,views,inspect);commands.append(create,edit('find','尋找'),edit('replace','取代'),advanced);selectionRow.append($('#r128-multi')?.parentElement||document.createElement('span'),selected);bar.append(navigation,commands,selectionRow);ap.append(button('所選列移到頂端',()=>root.WIUSignalTable.moveBoundary(false)),button('所選列移到底端',()=>root.WIUSignalTable.moveBoundary(true)));del.dataset.r121Delete='';
 const status=$('.desk-status');if(status){const zoom=group('r110-native-view');zoom.append(button('−',()=>root.WIUBridge.workspaceZoom('out'),'縮小介面圖'));const ratio=button('100%',()=>root.WIUBridge.workspaceZoom('read'));ratio.dataset.r118ZoomLabel='';zoom.append(ratio,button('＋',()=>root.WIUBridge.workspaceZoom('in'),'放大介面圖'));const fit=$('#fitBtn');text(fit,'完整圖');if(fit)zoom.append(fit);zoom.append(button('定位選取',()=>root.WIUBridge.workspaceZoom('selection')));const locate=zoom.lastElementChild;locate.dataset.r121Locate='native';status.append(zoom);}
 const meta=$('#signalsPanel .desk-list-meta'),selection=d.createElement('span');selection.dataset.r120Selection='';selection.textContent='選取列可批次編輯';meta?.append(selection);
 const hint=d.createElement('small');hint.className='r120-key-hint';hint.textContent='Enter ↓ 下列　Tab → 右欄　Alt＋↑↓ 移動 · Alt＋N 新增';$('#signalsPanel .desk-panel-header')?.append(hint);
}
// Disclosure state is owned by assembly-ui; never reopen it from an observer.
d.addEventListener('keydown',e=>{if(e.key==='Escape'&&d.body.classList.contains('r110-focus')&&!$('dialog[open]')&&!root.WIUPresentation?.isOpen()&&!e.target.closest('input,textarea,select'))focus();});
let header;const headerSize=new ResizeObserver(entries=>{const h=Math.ceil(entries[0].target.getBoundingClientRect().height);if(h)d.body.style.setProperty('--r116-top',h+'px');});
function sync(){
 const h=$('.a-switch');if(h&&h!==header){headerSize.disconnect();headerSize.observe(h);header=h;}
 if(back){const top=root.__WIU_ASSEMBLY__?.getSession()?.activeModule==='top';back.hidden=top;topNav.hidden=!top;}
 const toolbar=$('.wb-canvas-head');if(toolbar&&!toolbar.dataset.r120){toolbar.dataset.r120='1';toolbar.classList.add('r120-toolbar');
  const add=$('[data-action="graph-add"]',toolbar);text(add,'＋ 加入實例');const primary=group('r120-work-tools');
  $('[data-action="graph-table"]',toolbar)?.remove();$('[data-action="graph-visio-routed"]',toolbar)?.remove();all('details',toolbar).filter(m=>$('[data-action="graph-visio"]',m)).forEach(m=>m.remove());$('.r82-toolbar-space',toolbar)?.remove();
  const instanceMenu=all('details',toolbar).find(m=>$('#r95-instance-select',m)),advanced=more(true);
  if(instanceMenu){const content=$('div',instanceMenu);const label=d.createElement('strong');label.className='r118-menu-section';label.textContent='依名稱選取實例';$('div',advanced).append(label,...content.children);instanceMenu.remove();}
  primary.append(topTabs('graph'));for(const child of [...toolbar.children])primary.append(child);
  primary.append(button('RTL 預覽',()=>dispatch('rtl-preview-toggle')),advanced);toolbar.append(primary);
  const zoom=$('.r77-zoom-bar');if(zoom){const fit=$('[data-zoom="fit"]',zoom);if(fit){text(fit,'完整圖');fit.dataset.zoom='all';}const selectedZoom=button('定位選取');selectedZoom.dataset.action='graph-zoom';selectedZoom.dataset.zoom='selection';selectedZoom.dataset.r121Locate='graph';zoom.append(selectedZoom);}
 }
 for(const b of all('[data-r116-edit]')){const key=b.dataset.r116Edit,graph=b.dataset.r116Graph==='true';b.hidden=false;b.disabled=['cut','copy','duplicate','delete','paste'].includes(key)?(graph?!root.WIUGraphCommands?.can(key):key!=='paste'&&!root.WIUPortEditing?.selectionCount()):false;}
 const add=$('[data-r121-add]'),def=root.WIUSignalTable?.defaults();if(add&&def){add.title='新增 '+({input:'IN',output:'OUT',inout:'I/O'}[def.direction])+' · '+(def.side==='left'?'左側':'右側')+'；繼承目前選取列';text(add,'＋ 訊號 '+({input:'IN',output:'OUT',inout:'I/O'}[def.direction])+' · '+(def.side==='left'?'左':'右'));}const count=root.WIUSignalTable?.selection()?.length||0,del=$('[data-r121-delete]');if(del)text(del,count?'刪除所選 '+count+' 列':'刪除所選');const selectionBar=$('.r121-selection-tools');if(selectionBar)selectionBar.hidden=false;
 for(const b of all('[data-r121-locate]'))b.disabled=b.dataset.r121Locate==='graph'?root.WIUGraphCommands?.selection()?.kind!=='instance':!count;
 root.WIUSignalTable?.syncDrafts?.();
 const scale=root.WIUBridge?.workspaceScale?.();if(Number.isFinite(scale))text($('[data-r118-zoom-label]'),Math.round(scale*100)+'%');
 const issue=$('#issueToggle');if(issue){const drafts=root.WIUSignalTable?.pending?.()||[];if(drafts.length){if(!issue.dataset.r121Original)issue.dataset.r121Original=issue.textContent;text(issue,'⚠ '+drafts.length+' 個未套用欄位');issue.title='前往修正未套用的欄位';}else{if(issue.dataset.r121Original){text(issue,issue.dataset.r121Original);delete issue.dataset.r121Original;}text(issue,issue.textContent.replace('RTL 檢查','介面檢查'));issue.title='目前模組介面的名稱、方向、位寬與 RTL 宣告檢查';}}
}
d.addEventListener('click',e=>{if(e.target.closest('#issueToggle')&&root.WIUSignalTable?.pending?.().length){e.preventDefault();e.stopImmediatePropagation();root.WIUSignalTable.locateDraft();}},true);
let pending=false;const schedule=()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;sync();});};new MutationObserver(schedule).observe(d.body,{subtree:true,childList:true,characterData:true});d.addEventListener('click',schedule);d.addEventListener('keyup',schedule);root.WIUWorkspaceTools={sync};sync();
})(globalThis);
