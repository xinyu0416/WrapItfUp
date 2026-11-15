/* r69 layout adapter. Moves existing controls; keeps their original editor handlers. */
(function(){
 'use strict';
 const byId=id=>document.getElementById(id),bar=document.querySelector('.desk-switchbar');
 if(!bar)return;
 const move=(id,parent,label)=>{const el=byId(id);if(el){if(label)el.textContent=label;parent.append(el);}return el;};
 const group=document.createElement('details');group.className='r69-menu r69-selection-tools';group.innerHTML='<summary>分組與條件<\/summary><div><\/div>';bar.append(group);
 for(const [id,label] of [['addGroupInline','建立群組'],['addIfdefInline','加入 IFDEF'],['addIfndefInline','加入 IFNDEF']])move(id,group.querySelector('div'),label);
 const exp=document.createElement('details');exp.className='r69-menu';exp.innerHTML='<summary>匯出圖面<\/summary><div><\/div>';bar.append(exp);
 for(const id of ['pngBtn','pdfBtn','svgBtn'])move(id,exp.querySelector('div'));
 if(byId('vbsBtn'))byId('vbsBtn').hidden=true;
 const help=document.createElement('small');help.className='r75-export-help';help.textContent='Visio .vbs：目前介面圖 → 可編輯 .vsdx（上方按鈕）。儲存專案：所有模組、接線與排版，可重新開啟。';exp.querySelector('div').append(help);
 const before=byId('selectionCount');
 const edit=document.createElement('details');edit.className='r69-menu r70-edit-menu';edit.innerHTML='<summary>編輯<\/summary><div><button data-port-command="find">尋找　Ctrl+F<\/button><button data-port-command="replace">取代　Ctrl+H<\/button><button data-port-command="copy">複製接腳　Ctrl+C<\/button><button data-port-command="cut">剪下接腳　Ctrl+X<\/button><button data-port-command="paste">貼上接腳　Ctrl+V<\/button><button data-port-command="duplicate">複製一份<\/button><button data-port-command="names">貼上名稱清單…<\/button><\/div>';bar.insertBefore(edit,before);
 edit.addEventListener('click',e=>{const action=e.target.closest?.('[data-port-command]')?.dataset.portCommand;if(!action)return;edit.open=false;if(action==='find'||action==='replace')window.WIUProjectHost.findInModule(action);else if(action==='names')window.WIUProjectHost.pastePortText();else window.WIUPortEditing[action]();});
 for(const [id,label] of [['addLeftSignal','＋ 左側'],['addRightSignal','＋ 右側']]){const el=byId(id);if(el){el.textContent=label;bar.insertBefore(el,before);}}
 const gap=document.createElement('button');gap.className='btn r85-gap-btn';gap.id='r85-add-spacer';gap.textContent='＋ 間隔';gap.title='在目前所選接腳正下方插入空白間隔；不產生 RTL port';gap.onclick=()=>window.WIUPortEditing.spacer(window.WIUPortEditing.targetSide());bar.insertBefore(gap,before);
 const rtl=document.createElement('button');rtl.className='btn';rtl.id='r69-diagram-rtl';rtl.textContent='RTL 預覽';rtl.setAttribute('aria-expanded','false');rtl.onclick=()=>{byId('rtlToggle').click();rtl.setAttribute('aria-expanded',String(!byId('rtlPanel').classList.contains('collapsed')));};bar.append(rtl);
 const hint=document.createElement('span');hint.className='r73-canvas-hint';hint.textContent='選取接腳後按新增＝插在正下方 · 空白間隔可調整版面 · 拖曳移動';bar.append(hint);
 move('fitBtn',bar,'符合畫面');
 move('presentBtn',exp.querySelector('div'),'展示圖面 F5');
 if(!window.WIUSignalTable&&byId('toggleSignalTable')?.getAttribute('aria-pressed')==='true')byId('toggleSignalTable').click();
 if(byId('toggleInspector')?.getAttribute('aria-pressed')==='true')byId('toggleInspector').click();
 if(!byId('rtlPanel')?.classList.contains('collapsed'))byId('rtlToggle')?.click();
 let last='';const selection=()=>{const text=byId('selectionCount')?.textContent||'',has=window.WIUPortEditing.selectionCount()>0;group.hidden=false;group.querySelector('summary').title=has?'為所選接腳建立群組或條件':'請先選取接腳；新增群組和條件的入口固定在此';edit.querySelectorAll('[data-port-command]').forEach(b=>{b.disabled=['copy','cut','duplicate'].includes(b.dataset.portCommand)&&!has;b.title=b.disabled?'先選取圖面或表格中的接腳':'';});last=text;};
 if(typeof MutationObserver!=='undefined'){new MutationObserver(selection).observe(byId('selectionCount'),{childList:true,subtree:true,characterData:true});selection();}
 // A menu is one temporary surface. Opening another closes the previous menu.
 document.addEventListener('toggle',e=>{if(e.target.matches?.('.r69-menu')&&e.target.open)document.querySelectorAll('.r69-menu[open]').forEach(d=>{if(d!==e.target)d.open=false;});},true);
 document.addEventListener('click',e=>{if(!e.target.closest?.('.r69-menu'))document.querySelectorAll('.r69-menu[open]').forEach(d=>d.open=false);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.r69-menu[open]').forEach(d=>{d.open=false;d.querySelector('summary')?.focus();});});
})();
