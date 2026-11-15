// Installed before the retained editor: one owner for project-wide shortcuts.
(function(){
 function handle(e){const host=window.WIUProjectHost,presentation=window.WIUPresentation;
  if(e.key==='F5'){
   if(e.ctrlKey||e.metaKey||e.altKey||e.shiftKey){if(presentation?.isOpen())e.stopImmediatePropagation();return;}
   e.preventDefault();e.stopImmediatePropagation();
   if(e.isComposing){host?.portNotice('請先完成目前的文字輸入。');return;}
   if(presentation?.isOpen())presentation.fit();else host?.presentDrawing();
   return;
  }
  if(presentation?.isOpen()){e.stopImmediatePropagation();presentation.keydown(e);return;}
  if(!host||e.altKey)return;const mod=e.ctrlKey||e.metaKey,k=String(e.key||'').toLowerCase();
  if(mod&&['s','f','h'].includes(k)){e.preventDefault();e.stopImmediatePropagation();if(e.isComposing){host.portNotice('請先完成目前的文字輸入。');return;}if(k==='s')host.save();else host.findInModule(k==='h'?'replace':'find');}
  else if(e.key==='F3'&&window.WIUGraphFind?.isOpen()){e.preventDefault();e.stopImmediatePropagation();window.WIUGraphFind.next(e.shiftKey?-1:1);}
  else if(e.key==='F3'&&window.WIUFindReplace?.isOpen()){e.preventDefault();e.stopImmediatePropagation();window.WIUFindReplace.next(e.shiftKey?-1:1);}
 }
 window.WIUShortcutRouter={handle};window.addEventListener('keydown',handle,true);
 for(const type of ['cut','paste'])window.addEventListener(type,e=>{
  if(window.WIUPresentation?.isOpen()){e.preventDefault();e.stopImmediatePropagation();}
 },true);
})();
