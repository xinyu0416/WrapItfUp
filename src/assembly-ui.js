(function () {
  'use strict';
  const C=window.WIUCore, P=window.WIUParser, A=window.WIUActions, L=window.WIULearning, D=window.WIUDefines, E=window.WIUExperience, K=window.WIUCompany;
  let defineUI, flowUI;
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=()=> 'a_'+Math.random().toString(36).slice(2,11);
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  let project=C.newProject(), tab='home', selected=new Set(), filter='', onlyUnbound=false, instanceFilter='', exportTab='verilog';
  let connectionView='cards', focusedPin='', lessonTask='', helpQuery='', lastPanel='', priorWorkTab='setup', rtlOpen=false;
  let past=[],future=[],saved='', draft=null, saveTimer, toastTimer, modalAction=null, currentView='assembly', quietEdit=false;
  let dialogOpener=null, searchTimer, downloadState={},topEditBefore=null,exportSnapshot='',focusTaskAfterClose=false;
  const saveRecords=new Map(),fieldDrafts=new Map();let pendingField=null,issueQueueOpen=false,issueQueueKey='',issueQueueIndex=0;
  const HF=window.WIUHistoryFlow,R119=window.WIUWorkflowR119;
  const intakeDrafts=new Map();let railQuery='',railUsage='all',checkScope='top',lastHistoryEffect=null;
  const UX=window.WIUInteractionR124;
  let railDisclosures={},railOwner='',railScroll=0,nameCommitQuiet=false,nameRefreshPending=false,namePointer=false;
  const VERSION=window.WIURelease.label;
  const key='WrapItfUp-public-user-draft';
  const switchbar=document.createElement('nav'); switchbar.className='a-switch'; switchbar.setAttribute('aria-label','WrapItfUp 工作區');
  switchbar.innerHTML='<button class="ux-brand" data-nav="home" aria-label="WrapItfUp 首頁"><b>Wrap<span>Itf<\/span>Up<span class="ux-version">' +VERSION+ '<\/span><\/b><\/button><button data-view="assembly" aria-pressed="true">Top 工作區<\/button><button data-view="diagram" aria-pressed="false">介面圖<\/button><small>離線工作<\/small><button data-action="tool-directory">功能導覽<\/button><button data-nav="help">使用說明<\/button>';
  document.body.append(switchbar);
  const shell=document.createElement('section'); shell.className='a-shell fg-shell';shell.setAttribute('aria-label','Top 組裝工作區');document.body.append(shell);
  const dialog=document.createElement('dialog');dialog.className='a-dialog';dialog.id='a-dialog';document.body.append(dialog);
  const issueQueue=document.createElement('aside');issueQueue.className='r118-issue-queue';issueQueue.hidden=true;issueQueue.setAttribute('aria-label','Top 接線問題清單');document.body.append(issueQueue);
  const toastEl=document.createElement('div');toastEl.className='a-toast';toastEl.hidden=true;toastEl.setAttribute('role','status');document.body.append(toastEl);
  const fileInput=document.createElement('input');fileInput.type='file';fileInput.hidden=true;document.body.append(fileInput);let fileMode='project';
  try{const d=localStorage.getItem(key);if(d)draft=JSON.parse(d);}catch{}
  saved=JSON.stringify(project);
  // v64: one project, module sheets and isolated practice sessions.
  const W=window.WIUWorkbook,V=window.WIUWorkbookView;
  let activeModule='top',sessionKind='user',practiceReturn=null,graphStart='',diagramGuard=false,tourStep=-1,tourReturn=null;
  const rail=document.createElement('aside');rail.className='wb-rail';rail.setAttribute('aria-label','專案模組頁');document.body.append(rail);
  const diagramBar=document.createElement('div');diagramBar.className='r107-module-scope';diagramBar.hidden=true;
  const nativeToolbar=document.querySelector('.app .desk-switchbar');if(nativeToolbar?.before)nativeToolbar.before(diagramBar);else document.body.append(diagramBar);
  const lockedStructure=()=>currentView==='diagram'&&!!W.portEditStatus(project,W.moduleOf(project,activeModule)).reason;
  const coach=document.createElement('aside');coach.className='wb-tour';coach.hidden=true;document.body.append(coach);
  const practiceCoach=document.createElement('aside');practiceCoach.className='wb-practice-coach';practiceCoach.hidden=true;document.body.append(practiceCoach);
  let graphNeedsPrepare=true,lastInterfaceImpact=null;
  const graphRunner=window.WIUGraphBackground.createRunner();
  const drawingRunner=window.WIUGraphBackground.createRunner({timeout:30000});
  let graphJob=null,drawingBusy=false,viewportFrame=null;
  function graphProgress(progress){
    if(!graphJob)return;graphJob.message=progress.phase+(progress.total?' · '+progress.done+' / '+progress.total:progress.done?' · '+progress.done+' 條':'');
    const el=$('[data-graph-background-message]',shell);if(el)el.textContent=graphJob.message;
  }
  function pauseGraph(reason='user'){if(graphJob?.status==='running'){graphJob.reason=reason;graphJob.status='paused';graphJob.message='背景整理已暫停；可繼續編輯、儲存或匯出 RTL。';}graphRunner.cancel();}
  function backgroundScene(){
    const S=window.WIUTopScene,key=S.sceneKey(project);
    let scene=S.peek(project);if(!scene)scene=S.create(project,{fast:true});
    if(!scene.previewOnly){if(graphJob?.key!==key)graphRunner.cancel();return scene;}
    if(graphJob?.status==='paused'&&graphJob.reason==='navigation')graphJob=null;
    if(graphJob?.key!==key){
      graphRunner.cancel();const job=graphJob={key,status:'running',message:'快速接線預覽 · 正在背景整理'};
      graphRunner.run({kind:'route',project,options:{prepare:graphNeedsPrepare}},graphProgress).then(result=>{
        if(graphJob!==job||job.status!=='running'||S.sceneKey(project)!==key)return;
        // Derived geometry stays outside the undoable document. Save/export
        // attach a snapshot to a copy, so late results cannot break Undo.
        S.prime(project,result.scene);graphNeedsPrepare=false;job.status='done';stash();
        if(currentView==='assembly'&&tab==='graph')render();
      }).catch(error=>{
        if(graphJob!==job||job.status==='paused'||error.code==='CANCELLED')return;
        job.status='paused';job.message=error.message+'（畫面仍為快速預覽，尚未完成圖面檢查）';
        if(currentView==='assembly'&&tab==='graph')render();
      });
    }
    return scene;
  }
  function graphWindow(scene,padding=180){
    if(Object.keys(scene.points).length<400)return null;
    const sc=$('.wb-canvas-scroll',shell),width=sc?.clientWidth||Math.max(400,window.innerWidth-270),height=sc?.clientHeight||Math.max(300,window.innerHeight-220);
    const zoom=graphReadablePending?Math.max(.08,Math.min(1,width/scene.width,height/scene.height)):graphZoom;
    return window.WIUSceneViewport.windowRect(scene,width,height,zoom,graphReadablePending?{x:0,y:0}:graphPan,padding);
  }
  function scheduleGraphViewport(){
    if(viewportFrame)return;
    viewportFrame=requestAnimationFrame(()=>{viewportFrame=null;
      if(currentView!=='assembly'||tab!=='graph'||graphDrag||topPortDrag)return;
      const canvas=$('.wb-canvas',shell),scene=window.WIUTopScene.peek(project);if(!canvas||!scene)return;
      const view=graphWindow(scene,0);if(!view)return;
      const prior=JSON.parse(canvas.dataset.renderWindow||'null');if(prior?.overview===view.overview&&window.WIUSceneViewport.contains(prior,view))return;
      const active=document.activeElement;if(active?.matches('input:not([readonly]),textarea')&&canvas.contains(active))return;
      window.WIUInteractionR128.paint('graph-viewport',()=>{
        if(!canvas.isConnected)return;
        const viewport=graphWindow(scene),drafts=[...fieldDrafts.values()].filter(d=>d.element.dataset.wireName).map(d=>({...d,value:d.element.value,invalid:d.element.getAttribute('aria-invalid'),readonly:d.element.readOnly}));
        canvas.innerHTML=V.drawing(project,graphStart,{scene,viewport,connectMode:graphConnectMode,keepNets:new Set(drafts.map(d=>d.element.dataset.wireName))});canvas.dataset.renderWindow=JSON.stringify(viewport);
        for(const d of drafts){const next=$$('input[data-wire-name]',canvas).find(el=>window.WIUInteractionR128.key(el)===d.domKey);if(next){next.value=d.value;next.readOnly=d.readonly;if(d.invalid)next.setAttribute('aria-invalid',d.invalid);const saved=fieldDrafts.get(d.key);if(saved)saved.element=next;}}
        applyGraphNetFocus();if(graphFindVisible())refreshGraphFind();
      });
    });
  }
  function backgroundStatus(scene){if(!scene.previewOnly)return scene.boundedRouting?'<div class="r129-background"><span>大型圖面：快速避障與全圖檢查已完成。剩餘衝突見下方提醒；需要時再從「排列與走線」精細修復。</span></div>':'';
    return '<div class="r129-background" role="status"><span data-graph-background-message>'+esc(graphJob?.message||'快速接線預覽')+'</span><small>線路為暫時路徑，交叉／避障尚未確認；實際接線與 RTL 不受影響。</small><button data-action="graph-background-toggle">'+(graphJob?.status==='running'?'暫停整理':'重新整理')+'</button></div>';
  }
  async function drawingTask(kind,options={}){
    if(drawingBusy){toast('圖面工作正在執行，可在視窗內取消。');return null;}
    drawingBusy=true;pauseGraph();const started=Date.now();let failure=null;
    openDialog('背景處理圖面','<p data-drawing-progress>正在計算，可以取消後繼續編輯。</p><button type="button" data-action="graph-drawing-cancel">取消計算</button>');
    const close=()=>drawingRunner.cancel('已取消圖面工作');dialog.addEventListener('close',close,{once:true});
    try{return await drawingRunner.run({kind,project:window.WIUTopScene.withDrawingSnapshot(project),options},v=>{const el=$('[data-drawing-progress]',dialog);if(el)el.textContent=v.phase+(v.total?' · '+v.done+' / '+v.total:v.done?' · '+v.done+' 條':'')+' · '+Math.round((Date.now()-started)/1000)+' 秒；可隨時取消。';});}
    catch(e){if(e.code!=='CANCELLED')failure=e.message;return null;}
    finally{drawingBusy=false;dialog.removeEventListener('close',close);dialog.close();if(failure)openDialog('圖面工作未完成','<p>'+esc(failure)+'</p><p>未套用任何結果，原圖與接線資料保留。可繼續編輯、儲存或匯出 RTL。</p>');}
  }
  let graphGroupPanel=false,graphArtwork=false,graphFocus=false,focusRail=true;
  let practiceCoachExpanded=false, railOpen=true, graphZoom=1,graphPan={x:0,y:0},lastDesignTab='graph',lastDesignView='assembly',lastDesignModule='top';
  let graphReadablePending=true, previousGraphView=null,graphViewportAuto=true;
  const sheetViews=new Map();
  const stagebar=document.createElement('nav');stagebar.className='r69-stagebar';stagebar.setAttribute('aria-label','工作階段');document.body.append(stagebar);
  project=W.normalize(project);saved=JSON.stringify(project);
  function workspace(){return {railDisclosures:{...railDisclosures},railScroll,railQuery,railUsage,graphArtwork,graphFocus,focusRail,graphPan:{...graphPan},graphZoom,lastDesignTab,lastDesignView,lastDesignModule,railOpen,activeModule,view:currentView,tab,priorWorkTab,connectionView,focusedPin,instanceFilter,filter,onlyUnbound,rtlOpen,selected:[...selected],scroll:$('.a-panel',shell)?.scrollTop||0,diagramUi:window.WIUBridge?.uiSnapshot()||null};}
  function restoreWorkspace(ws={}){railOwner=project.workbook.projectId;railDisclosures=UX.disclosures(ws.railDisclosures);railScroll=Number(ws.railScroll)||0;railQuery=ws.railQuery||'';railUsage=['all','used','unused'].includes(ws.railUsage)?ws.railUsage:'all';sheetViews.clear();previousGraphView=null;graphArtwork=!!ws.graphArtwork;graphFocus=!!ws.graphFocus;focusRail=ws.focusRail!==false;graphPan={x:Number(ws.graphPan?.x)||0,y:Number(ws.graphPan?.y)||0};graphReadablePending=!Number.isFinite(ws.graphZoom);graphViewportAuto=graphReadablePending;graphZoom=Number.isFinite(ws.graphZoom)?ws.graphZoom:1;lastDesignTab=ws.lastDesignTab||'graph';lastDesignView=ws.lastDesignView||ws.view||'assembly';lastDesignModule=ws.lastDesignModule||ws.activeModule||'top';railOpen=ws.railOpen!==false;activeModule=ws.activeModule==='top'||project.modules.some(m=>m.id===ws.activeModule)?ws.activeModule:'top';tab=labels[ws.tab]?ws.tab:'graph';priorWorkTab=ws.priorWorkTab||'graph';connectionView=ws.connectionView||'cards';focusedPin=ws.focusedPin||'';instanceFilter=ws.instanceFilter||'';filter=ws.filter||'';onlyUnbound=!!ws.onlyUnbound;rtlOpen=!!ws.rtlOpen;selected=new Set(ws.selected||[]);currentView=ws.view==='diagram'?'diagram':'assembly';if(currentView==='diagram')openSheet(activeModule);else{view('assembly');render();}if(ws.diagramUi)window.WIUBridge?.restoreUi(ws.diagramUi);const panel=$('.a-panel',shell);if(panel)panel.scrollTop=ws.scroll||0;}
  function renderRail(){
    if(railOwner!==project.workbook.projectId){railOwner=project.workbook.projectId;railDisclosures={};railScroll=0;railQuery='';railUsage='all';}
    rail.innerHTML=V.rail(project,activeModule,currentView,{query:railQuery,usage:railUsage,disclosures:railDisclosures});
    for(const b of $$('[data-tab]',rail))if(currentView==='assembly'&&b.dataset.tab===tab)b.setAttribute('aria-current','page');
    rail.scrollTop=railScroll;
  }
  rail.addEventListener('scroll',()=>{if(!rail.hidden)railScroll=rail.scrollTop;},{passive:true});
  rail.addEventListener('click',e=>{
    const summary=e.target.closest('summary'),details=summary?.parentElement;
    if(!details||!rail.contains(details))return;
    const key=details.dataset.moduleInstances?'module:'+details.dataset.moduleInstances:details.dataset.railDisclosure;
    if(!key)return;e.preventDefault();railDisclosures[key]=!details.open;details.open=railDisclosures[key];stash();
  });
  function headerName(id){
    const m=W.moduleOf(project,id),reason=W.editCapabilities(project,id).renameReason;
    return '<div class="r124-name-wrap"><input id="r124-name" data-module-id="'+esc(id)+'" data-project-id="'+esc(project.workbook.projectId)+'" value="'+esc(m.name)+'" aria-label="'+(id==='top'?'Top 模組名稱':'子模組名稱')+'" aria-describedby="r124-name-help" spellcheck="false" autocomplete="off" '+(reason?'readonly ':'')+'title="'+esc(reason||'直接編輯 · Enter 或點外面套用 · Esc 取消')+'"><small id="r124-name-help" role="status">'+(reason?'名稱由 RTL 來源管理':'')+'</small></div>';
  }
  function nameFeedback(el,error=''){
    el.setAttribute('aria-invalid',String(!!error));const note=$('#r124-name-help',switchbar);if(note)note.textContent=error;return !error;
  }
  function finishNameRender(){
    if(!nameRefreshPending)return;nameRefreshPending=false;
    const menus=$$('details[open]',switchbar).map(m=>$('summary',m)?.textContent),focused=document.activeElement;
    const focus=focused&&switchbar.contains(focused)&&focused.id!=='r124-name'?{action:focused.dataset.action,tab:focused.dataset.tab,summary:focused.tagName==='SUMMARY'?focused.textContent:null}:null;
    render();refreshSheet();
    for(const m of $$('details',switchbar))if(menus.includes($('summary',m)?.textContent))m.open=true;
    if(focus){const target=$$('button,summary',switchbar).find(el=>focus.action?el.dataset.action===focus.action:focus.tab?el.dataset.tab===focus.tab:focus.summary&&el.tagName==='SUMMARY'&&el.textContent===focus.summary);target?.focus({preventScroll:true});}
  }
  function applyHeaderName(el){
    if(el.readOnly||el.value===el.defaultValue)return true;
    const id=el.dataset.moduleId;
    if(el.dataset.projectId!==project.workbook.projectId)return nameFeedback(el,'專案已切換，請重新編輯名稱。');
    try{
      const next=UX.rename(project,id,el.value),name=W.moduleOf(next,id).name,old=W.moduleOf(project,id).name;
      nameCommitQuiet=true;try{commit(()=>{project=next;},undefined,{label:'模組改名：'+old+' → '+name,scope:id==='top'?'project':id});}finally{nameCommitQuiet=false;}
      el.value=el.defaultValue=name;clearPendingField(el);nameFeedback(el);return true;
    }catch(error){setPendingField(el);return nameFeedback(el,error.message);}
  }
  function focusHeaderName(id){
    dialog.close();if(id==='top'&&currentView==='diagram'&&activeModule!=='top')go('graph');else if(tab==='home')go('graph');
    const el=$('#r124-name',switchbar);el?.focus();el?.select();
  }
  switchbar.addEventListener('input',e=>{if(e.target.id!=='r124-name')return;setPendingField(e.target);nameFeedback(e.target,UX.nameError(project,e.target.dataset.moduleId,e.target.value));});
  // Apply before an outside pointer action, keeping its actual target in the DOM.
  document.addEventListener('pointerdown',e=>{
    const el=$('#r124-name',switchbar);namePointer=!!el&&document.activeElement===el&&e.target!==el;
    if(namePointer&&!applyHeaderName(el)){namePointer=false;e.preventDefault();e.stopImmediatePropagation();}
  },true);
  document.addEventListener('click',()=>{namePointer=false;if(nameRefreshPending)setTimeout(finishNameRender,0);});
  document.addEventListener('pointercancel',()=>{namePointer=false;if(nameRefreshPending)setTimeout(finishNameRender,0);});
  switchbar.addEventListener('focusout',e=>{if(e.target.id!=='r124-name')return;applyHeaderName(e.target);if(!namePointer&&nameRefreshPending)setTimeout(finishNameRender,0);});
  window.addEventListener('keydown',e=>{
    const el=e.target;if(el.id!=='r124-name'||e.isComposing||e.keyCode===229)return;
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();el.value=el.defaultValue;clearPendingField(el);nameFeedback(el);el.blur();}
    else if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();if(applyHeaderName(el)){el.blur();finishNameRender();}}
    else if(e.key==='Tab'&&!applyHeaderName(el)){e.preventDefault();e.stopImmediatePropagation();}
  },true);
  function workbookSnapshot(){window.WIUBridge?.finish();return W.envelope(window.WIUTopScene.withDrawingSnapshot(project),workspace(),sessionKind);}
  function stageNav(){
    const current=currentView==='diagram'?'design':tab==='check'?'check':['bundle','export'].includes(tab)?'delivery':'design';
    const n=issues().filter(i=>i.severity==='error').length;
    return (current==='design'?'<button class="r77-rail-toggle" data-action="rail-toggle" aria-expanded="'+railOpen+'">'+(railOpen?'‹ 收合模組':'☰ 模組列表')+'<\/button>':'')+'<div class="r69-stages"><button data-action="stage-design" '+(current==='design'?'aria-current="page"':'')+'>設計<\/button><button data-tab="check" '+(current==='check'?'aria-current="page"':'')+'>檢查 <span class="r69-issue-count">'+(n?n+' 項待修正':'✓')+'<\/span><\/button><button data-tab="bundle" '+(current==='delivery'?'aria-current="page"':'')+'>交付<\/button><\/div><span class="r69-context">'+esc(currentView==='diagram'?W.moduleOf(project,activeModule).name+' / 介面圖':labels[tab]||'')+'<\/span>'+(currentView==='diagram'?'<details class="r69-menu"><summary>模組設定<\/summary><div><button data-action="diagram-settings">參數與位寬<\/button>'+(activeModule!=='top'?'<button data-action="wb-child-rtl">下載子模組 RTL<\/button><button data-action="module-delete" data-id="'+esc(W.moduleOf(project,activeModule).name)+'">從專案移除此模組…<\/button>':'')+'<\/div><\/details>'+(activeModule!=='top'?'<button data-action="flow-instances" data-id="'+esc(W.moduleOf(project,activeModule).name)+'">放入 Top<\/button>':'')+'<button data-action="diagram-visio" title="目前介面圖 · Calibri 12 pt · 在 Windows Visio 產生可編輯圖形">Visio .vbs<\/button><button data-action="wb-graph">接線圖<\/button>':'')+(currentView==='assembly'&&tab!=='help'&&tab!=='lesson'?'<button data-action="rtl-preview-toggle" aria-expanded="'+rtlOpen+'">RTL 預覽<\/button>':'');
  }
  function isConnectionExample(){return sessionKind==='practice'&&(['public-example'].includes(project.workbook?.example)||(project.top==='dual_lane_wrapper'&&project.modules.some(m=>m.name==='mac_pair')));}
  function exampleInfo(){openDialog('公開版完整範本','<p>learn_source 輸出固定的 8-bit 資料給 learn_sink；Top 引出 clk 與 done。enable 接 1，debug 刻意留空。可直接編輯並匯出。</p>','回到畫布',()=>dialog.close());}
  function startTemplate(){beginPractice(window.WIUFocusGuide.createTemplate(),'graph');setGraphZoom('all',null,true);}

  function outputTarget(){
    const diagram=currentView==='diagram'||(tab!=='graph'&&lastDesignView==='diagram');
    const id=currentView==='diagram'?activeModule:lastDesignModule;
    if(diagram&&(id==='top'||project.modules.some(m=>m.id===id)))return {kind:'diagram',id,name:W.moduleOf(project,id).name};
    return {kind:'graph',id:'top',name:project.top};
  }
  function globalHeader(){
    const working=tab!=='home'||currentView==='diagram',design=currentView==='diagram'||!['check','bundle','export','help'].includes(tab),n=issues().filter(i=>i.severity==='error').length;
    const target=outputTarget(),module=target.kind==='diagram',m=currentView==='diagram'?W.moduleOf(project,activeModule):null;
    const history=window.WIUProjectHost?.historyState?.()||{},save=window.WIUProjectHost?.saveState?.()||{};
    const historyButton=(key,label)=>{const item=history[key];return '<button data-action="'+key+'" '+(!item?'disabled ':'')+'aria-label="'+label+'" title="'+esc(item?label+'：'+item.label+' · '+(item.scopeName||item.scope):'目前範圍沒有可'+label+'的操作')+'">'+(key==='undo'?'↶':'↷')+' '+label+'</button>';};
    const defines=(project.defineConfig?.rows||[]).filter(r=>r.enabled!==false&&r.name).map(r=>r.name+(r.value!==undefined&&r.value!==''?'='+r.value:''));
    const configLabel=defines.length?defines.slice(0,2).join(', ')+(defines.length>2?' ＋'+(defines.length-2):''):'未啟用 Defines';
    const formats=module?'<button data-action="canvas-format" data-format="png">PNG 圖片</button><button data-action="canvas-format" data-format="pdf">PDF 文件</button><button data-action="canvas-format" data-format="svg">SVG 可編輯圖</button>':'<p>進階相容 VBS · 主要下載已使用目前走線</p><button data-action="graph-visio">固定圖形（相容備用）</button><button data-action="graph-visio-routed-legacy">分段走線（舊版相容）</button><button data-action="graph-visio-native">直連（比較用途）</button>';
    return '<div class="r118-header-main"><button class="ux-brand" data-nav="home" aria-label="WrapItfUp 首頁"><b>Wrap<span>Itf</span>Up<span class="ux-version">'+VERSION+'</span></b></button>'+
      (working?'<button data-action="rail-toggle" aria-expanded="'+railOpen+'">模組列表</button>'+(!railOpen?'<button data-action="wb-add">＋ 子模組</button>':'')+'<div class="r118-breadcrumb" title="'+esc(project.top+' / '+(m?.name||'Top 接線'))+'">'+headerName(m?activeModule:'top')+'<small>'+(m?(activeModule==='top'?'Top 對外介面':'共用定義 · '+project.instances.filter(i=>i.module===m.name).length+' 顆實例'):'Top 接線')+'</small></div><div class="r110-stages"><button data-action="stage-design" '+(design?'aria-current="page"':'')+'>設計</button><button data-tab="check" '+(tab==='check'?'aria-current="page"':'')+'>檢查'+(n?' · '+n:'')+'</button><button data-tab="bundle" '+(['bundle','export'].includes(tab)?'aria-current="page"':'')+'>產生 RTL／gen_top</button></div><div class="r118-history" data-universal-history>'+historyButton('undo','復原')+historyButton('redo','重做')+'</div>':'')+
      '<div class="r69-global-tools"><button data-action="save" title="'+esc(saveStatusText(save))+' · 下載完整專案 .wiu.json · Ctrl+S">儲存專案</button>'+
      (working?'<button class="r116-vbs" data-action="canvas-vbs" title="'+esc((module?'模組介面：':'Top 接線圖：')+target.name)+'">↓ '+(module?'介面':'Top')+' VBS</button><details class="r69-menu r116-output"><summary>其他匯出</summary><div><strong>'+esc(target.name+(module?' · 介面圖':' · Top 接線圖'))+'</strong>'+formats+(module&&activeModule!=='top'?'<button data-action="wb-child-rtl">下載子模組 RTL</button>':'')+'</div></details>':'')+
      '<details class="r69-menu"><summary>專案</summary><div><button data-action="load">開啟專案／圖檔 · Ctrl+O</button><button data-action="ux-new">建立新專案</button><button data-action="project-name">修改 Top 名稱</button><button data-action="recent-download">最近一次匯出／重試</button>'+(working?'<strong class="r118-menu-section">組態與紀錄</strong><button data-tab="defines" title="'+esc(defines.join(', '))+'">Defines · '+esc(configLabel)+'</button><button data-action="config-profiles">具名組態</button><button data-tab="sources">來源檔案</button><button data-action="history-open">操作紀錄</button><p class="r118-menu-note">'+esc(saveStatusText(save))+'</p>':'')+'<strong class="r118-menu-section">範本</strong><button data-action="demo">開啟完整範本</button>'+(sessionKind==='practice'?'<button data-action="example-info">完整範本說明</button><button data-action="wb-practice-save">另存為我的專案</button><button data-action="wb-practice-exit">退出範本</button>':'')+'</div></details><button data-action="help-menu">說明</button></div></div>'+(working?'<div class="r121-context-strip"><span class="r118-save-status">'+esc(saveStatusText(save))+'</span>'+(sessionKind==='practice'?'<strong>範本練習 · 不自動暫存</strong><button data-action="wb-practice-save">另存為我的專案</button>':'')+'<button data-tab="defines" title="目前有效 Defines">組態：'+esc(configLabel)+'</button><button data-action="recent-download" '+(!recentDownload?'disabled':'')+'>'+esc(recentDownload?'下載已送出：'+recentDownload.name+' · 重新下載':'尚無匯出')+'</button></div>':'');

  }
  // The net focus set belongs to the viewport, never to project, undo, VBS or RTL.
  const graphNetFocus=new Set(),graphDirectNetFocus=new Set(),graphGroupFocus=new Set();
  let graphConnectMode=false,graphQuickConnect=false,graphPinHint='',graphObject=null,graphTableOrigin=null;
  // One graph search session and one set of commands for GUI and keyboard.
  let graphFindPanel=null,graphFindMode='find',graphFindIndex=0,graphFindPlan=null,graphFindOwner='',graphClipboard=null;
  function graphFindVisible(){return !!graphFindPanel&&!graphFindPanel.hidden&&currentView==='assembly'&&tab==='graph';}
  function closeGraphFind(){if(graphFindPanel)graphFindPanel.hidden=true;for(const e of $$('.r111-found,.r111-current',shell))e.classList.remove('r111-found','r111-current');}
  function graphFindNodes(row){
    if(!row)return [];
    if(row.kind==='instance')return $$('[data-graph-drag]',shell).filter(e=>e.dataset.graphDrag===row.id).map(e=>e.closest('.wb-block')||e);
    if(row.kind==='net'||row.target==='net'){const n=project.nets.find(n=>n.id===(row.targetId||row.id));if(!n)return [];const pin=$$('[data-action="wb-pin"]',shell).filter(e=>e.dataset.id==='top::'+n.id);return pin.concat($$('[data-wire-name],[data-wire-net]',shell).filter(e=>e.dataset.wireNet===n.name||e.dataset.wireName===n.name).sort((a,b)=>Number(!a.dataset.wireName)-Number(!b.dataset.wireName)));}
    const m=project.modules.find(m=>m.id===row.moduleId),port=m?.ports.find(p=>p.id===row.portId);
    if(port){const keys=(row.instances||[]).map(id=>id+'::'+port.name);const exact=$$('[data-action="wb-pin"]',shell).filter(e=>keys.includes(e.dataset.id));if(exact.length)return exact;}
    return $$('[data-graph-drag]',shell).filter(e=>(row.instances||[]).includes(e.dataset.graphDrag)).map(e=>e.closest('.wb-block')||e);
  }
  function locateGraphFind(){const row=graphFindPlan?.matches[graphFindIndex];if(!row)return;const sc=$('.wb-canvas-scroll',shell);if(!sc)return;
    const scene=window.WIUTopScene.peek(project);let point=null;
    if(row.kind==='net'||row.target==='net'){const n=project.nets.find(n=>n.id===(row.targetId||row.id)),label=scene?.labels.find(t=>t.net===n?.name);point=scene?.points['top::'+n?.id]||(label?{x:label.x,y:label.y}:null);}
    else if(row.portId){const m=project.modules.find(m=>m.id===row.moduleId),port=m?.ports.find(p=>p.id===row.portId);point=scene?.points[row.instances?.[0]+'::'+port?.name];}
    const node=graphFindNodes(row)[0],v=sc.getBoundingClientRect(),panel=graphFindPanel.getBoundingClientRect(),right=Math.min(v.right,panel.left-20),width=Math.max(160,right-v.left);
    if(!point&&node?.getBoundingClientRect){const r=node.getBoundingClientRect();point={x:(r.left+r.width/2-v.left-graphPan.x)/graphZoom,y:(r.top+r.height/2-v.top-graphPan.y)/graphZoom};}
    if(!point)return;previousGraphView={zoom:graphZoom,pan:{...graphPan}};graphReadablePending=false;graphZoom=Math.max(.85,Math.min(1.25,graphZoom));graphPan={x:width/2-point.x*graphZoom,y:v.height/2-point.y*graphZoom};applyGraphZoom();
  }
  function refreshGraphFind(locate=false){
    if(!graphFindVisible())return;if(graphFindOwner!==project.workbook.projectId){closeGraphFind();return;}
    const query=$('#r111-query',graphFindPanel).value,replacement=$('#r111-replacement',graphFindPanel).value,kind=$('#r111-kind',graphFindPanel).value;
    graphFindPlan=window.WIUGraphEdit.plan(project,{query,replacement,kind});
    graphFindIndex=Math.max(0,Math.min(graphFindIndex,graphFindPlan.matches.length-1));
    const {matches,changes,errors}=graphFindPlan,current=matches[graphFindIndex],locked=matches.filter(r=>r.readonly).length;
    for(const el of $$('.r111-found,.r111-current',shell))el.classList.remove('r111-found','r111-current');
    for(const r of matches)for(const el of graphFindNodes(r))el.classList.add(r.key===current?.key?'r111-current':'r111-found');
    $('#r111-count',graphFindPanel).textContent=query?(matches.length?(graphFindIndex+1)+' / '+matches.length+' 個物件'+(locked?' · '+locked+' 個唯讀欄位':''):'找不到符合的物件'):'搜尋目前 Top 圖的名稱、接腳、參數或群組';
    $('#r111-results',graphFindPanel).innerHTML=matches.map((r,i)=>{const c=changes.find(c=>c.key===r.key);return '<button type="button" data-find-index="'+i+'" aria-current="'+(i===graphFindIndex)+'"><strong>'+esc(r.label)+'</strong><span>'+esc(r.value)+'</span>'+(graphFindMode==='replace'?(r.readonly?'<small>'+esc(r.readonly)+'</small>':c?'<span>→ '+esc(c.after)+'</span>':''):'')+'</button>';}).join('');
    $('#r111-errors',graphFindPanel).textContent=graphFindMode==='replace'?errors.join('；'):'';
    for(const b of $$('[data-r111-apply]',graphFindPanel))b.disabled=!changes.length||!!errors.length||(b.dataset.r111Apply==='one'&&!changes.some(c=>c.key===current?.key));
    if(locate)locateGraphFind();
  }
  function nextGraphFind(delta){if(!graphFindVisible())return;refreshGraphFind();const n=graphFindPlan.matches.length;if(n){graphFindIndex=(graphFindIndex+delta+n)%n;refreshGraphFind(true);}}
  function applyGraphFind(all){refreshGraphFind();const p=window.WIUGraphEdit.plan(project,{query:$('#r111-query',graphFindPanel).value,replacement:$('#r111-replacement',graphFindPanel).value,kind:$('#r111-kind',graphFindPanel).value,onlyKey:all?null:graphFindPlan.matches[graphFindIndex]?.key});if(p.errors.length||!p.changes.length)return;
    if(p.before!==JSON.stringify(project))throw Error('內容已變更，請重新搜尋。');commit(()=>{project=p.project;},'已取代 '+p.changes.length+' 個名稱；Ctrl+Z 可整筆復原。');refreshGraphFind(true);
  }
  function openGraphFind(mode='find'){
    window.WIUFindReplace?.close();if(!graphFindPanel){graphFindPanel=document.createElement('section');graphFindPanel.id='r111-find';graphFindPanel.setAttribute('role','dialog');graphFindPanel.setAttribute('aria-label','搜尋目前 Top 接線圖');document.body.append(graphFindPanel);
      graphFindPanel.innerHTML='<header><strong>搜尋目前 Top 圖</strong><button data-r111-mode="find">尋找</button><button data-r111-mode="replace">取代</button><button data-r111-close aria-label="關閉搜尋">×</button></header><label>尋找<input id="r111-query" spellcheck="false" placeholder="Instance、訊號、接腳…"></label><label data-r111-replace>取代為<input id="r111-replacement" spellcheck="false"></label><label>範圍<select id="r111-kind"><option value="all">圖上全部物件</option><option value="instance">Instance 名稱</option><option value="net">Top 接腳與內部線</option><option value="port">子模組接腳（共用介面）</option><option value="detail">參數、群組與註解（尋找）</option></select></label><p id="r111-count" role="status"></p><nav><button data-r111-next="-1">↑ 上一個</button><button data-r111-next="1">↓ 下一個</button></nav><div id="r111-results"></div><p id="r111-errors" role="alert"></p><footer data-r111-replace><p>先核對下方結果。子模組接腳改名會同步更新所有 Instance；唯讀欄位會略過。</p><button data-r111-apply="one">取代目前</button><button data-r111-apply="all">全部取代</button></footer>';
      graphFindPanel.addEventListener('input',()=>{graphFindIndex=0;refreshGraphFind(true);});graphFindPanel.addEventListener('change',()=>{graphFindIndex=0;refreshGraphFind(true);});
      graphFindPanel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;safe(()=>{if(b.hasAttribute('data-r111-close'))closeGraphFind();else if(b.dataset.r111Mode)openGraphFind(b.dataset.r111Mode);else if(b.dataset.r111Next)nextGraphFind(Number(b.dataset.r111Next));else if(b.dataset.findIndex!==undefined){graphFindIndex=Number(b.dataset.findIndex);refreshGraphFind(true);}else if(b.dataset.r111Apply)applyGraphFind(b.dataset.r111Apply==='all');});});
      graphFindPanel.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();closeGraphFind();$('.wb-canvas-scroll',shell)?.focus();}else if(e.key==='Enter'&&!e.isComposing){e.preventDefault();nextGraphFind(e.shiftKey?-1:1);}});
    }
    graphFindMode=mode;graphFindOwner=project.workbook.projectId;graphFindPanel.hidden=false;for(const e of $$('[data-r111-replace]',graphFindPanel))e.hidden=mode!=='replace';refreshGraphFind(true);$('#r111-query',graphFindPanel).focus();return true;
  }
  function copyGraphInstance(){const i=graphObject?.kind==='instance'&&project.instances.find(i=>i.id===graphObject.id);if(!i)return false;const m=project.modules.find(m=>m.name===i.module);graphClipboard={instance:A.clone(i),module:W.interfaceKey(m),projectId:project.workbook.projectId,inputs:A.clone(project.connections.filter(c=>c.instance===i.id&&m.ports.some(p=>p.name===c.port&&p.direction==='input')))};toast('已複製 '+i.name+'；貼上保留輸入接線，輸出保持未接，避免多重驅動。');return true;}
  function pasteGraphInstance(){if(!graphClipboard){toast('請先選取 Instance 並複製。');return;}const m=project.modules.find(m=>m.name===graphClipboard.instance.module);if(!m||W.interfaceKey(m)!==graphClipboard.module){toast('目的專案缺少相同介面的模組，請先匯入來源。');return;}
    const next=A.clone(graphClipboard.instance),base=next.name.replace(/_copy\d*$/,'')+'_copy',used=new Set(project.instances.map(i=>i.name).concat(project.nets.map(n=>n.name),(project.parameters||[]).map(p=>p.name)));let name=base,n=2;while(used.has(name))name=base+n++;next.id=uid();next.name=name;next.nameBinding={mode:'custom',lastGenerated:name};
    commit(()=>{project.instances.push(next);if(graphClipboard.projectId===project.workbook.projectId)for(const c of graphClipboard.inputs)project.connections.push({...c,id:uid(),instance:next.id});const pos=project.workbook.graphPositions?.[graphClipboard.instance.id];if(pos)project.workbook.graphPositions[next.id]={x:pos.x+48,y:pos.y+48};project.orgEdited=true;},'已貼上 '+name+'；輸出保持未接，可直接接線。');selectGraphInstance(next.id);
  }
  function graphCommand(command){if(command==='copy')return copyGraphInstance();if(command==='paste')return pasteGraphInstance();if(command==='duplicate'){if(copyGraphInstance())pasteGraphInstance();return;}if(command==='cut'){if(copyGraphInstance())actions['instance-delete']({dataset:{id:graphObject.id}});return;}if(command==='delete'){if(graphObject?.kind==='instance')actions['instance-delete']({dataset:{id:graphObject.id}});else if(graphNetFocus.size===1){const n=project.nets.find(n=>n.name===[...graphNetFocus][0]);if(n)actions['net-delete']({dataset:{id:n.id}});}return;}if(command==='edit'&&graphObject?.kind==='instance')instanceForm(graphObject.id);}
  window.WIUGraphFind={open:openGraphFind,close:closeGraphFind,isOpen:graphFindVisible,next:nextGraphFind,refresh:refreshGraphFind};
  window.WIUGraphCommands={run:graphCommand,selection:()=>graphObject?A.clone(graphObject):null,can:command=>command==='paste'?!!graphClipboard:command==='delete'?(graphObject?.kind==='instance'||graphNetFocus.size===1):graphObject?.kind==='instance'};
  let objectMenu=null;
  function closeObjectMenu(){if(objectMenu)objectMenu.hidden=true;}
  shell.addEventListener('contextmenu',e=>{if(!graphActive())return;const block=e.target.closest('.wb-block'),handle=e.target.closest('[data-graph-drag]')||block?.querySelector('[data-graph-drag]');if(!handle)return;e.preventDefault();selectGraphInstance(handle.dataset.graphDrag);
    if(!objectMenu){objectMenu=document.createElement('div');objectMenu.id='r111-object-menu';objectMenu.setAttribute('aria-label','所選 Instance 操作');document.body.append(objectMenu);objectMenu.addEventListener('click',e=>{const b=e.target.closest('[data-command]');if(b){closeObjectMenu();safe(()=>graphCommand(b.dataset.command));}});}
    objectMenu.innerHTML=[['edit','編輯 · F2'],['copy','複製 · Ctrl+C'],['cut','剪下 · Ctrl+X'],['paste','貼上 · Ctrl+V'],['duplicate','建立副本 · Ctrl+D'],['delete','刪除 · Delete']].map(([key,label])=>'<button type="button" data-command="'+key+'">'+label+'</button>').join('');objectMenu.hidden=false;objectMenu.style.left=Math.max(8,Math.min(e.clientX,window.innerWidth-210))+'px';objectMenu.style.top=Math.max(8,Math.min(e.clientY,window.innerHeight-240))+'px';objectMenu.querySelector('button').focus();
  });
  window.addEventListener('pointerdown',e=>{if(!e.target.closest?.('#r111-object-menu'))closeObjectMenu();},true);
  window.addEventListener('keydown',e=>{if(e.key==='Escape')closeObjectMenu();},true);


  let netNavigation=null,netReviewCache=null;
  function netReview(){const key=JSON.stringify([project.workbook.projectId,project.modules,project.instances,project.nets,project.connections,project.assigns,project.parameters,project.defineConfig,project.workbook.diagrams]);if(netReviewCache?.key!==key)netReviewCache={key,value:window.WIUNetReview.index(project)};return netReviewCache.value;}
  function navigationNet(){return graphNetFocus.size===1?[...graphNetFocus][0]:null;}
  function navigationTools(){
    const name=navigationNet();if(!name)return '<small>選取一條 net 可定位 Driver / Load</small>';
    const n=netReview().net(name),nav=netNavigation?.name===name&&netNavigation.owner===project.workbook.projectId?netNavigation:null;
    return '<span class="r132-net-navigation" aria-label="接線端點定位">'+[['drivers','Driver 驅動',n.drivers],['loads','Load 接收',n.loads],['bidirectional','雙向',n.bidirectional]].filter(x=>x[0]!=='bidirectional'||x[2].length).map(([kind,label,list])=>'<button type="button" data-action="net-nav-list" data-kind="'+kind+'" '+(!list.length?'disabled':'')+'>'+label+' '+list.length+'</button>').join('')+(!n.drivers.length?'<small>未找到單向 Driver</small>':n.drivers.length>1?'<small>多個 Driver，請核對切片／驅動狀態</small>':'')+(n.loads.length>1?'<button data-action="net-nav-step" data-delta="-1" aria-label="上一個 Load">← Load</button><button data-action="net-nav-step" data-delta="1" aria-label="下一個 Load">Load →</button>':'')+(nav?.key?'<small>'+esc(nav.label)+'</small>':'')+(nav?.origin?'<button data-action="net-nav-back">返回原視野</button>':'')+'</span>';
  }
  function navigateEndpoint(kind,key){
    const name=navigationNet();if(!name)return;
    const rows=netReview().net(name)[kind]||[],i=rows.findIndex(e=>e.key===key),e=rows[i];if(!e)return;
    if(e.assign){openDialog('assign 中間節點','<p>這條 net 經過運算或轉接，以下不是直接 pin-to-pin。</p><pre>'+esc(e.label)+'</pre><button data-action="net-nav-assign">查看 assign 表</button>');return;}
    const point=window.WIUTopScene.peek(project)?.points[key],sc=$('.wb-canvas-scroll',shell);if(!point||!sc){toast('目前圖面沒有此端點，請先完成背景整理。');return;}
    if(!netNavigation||netNavigation.name!==name||netNavigation.owner!==project.workbook.projectId)netNavigation={name,owner:project.workbook.projectId,origin:{zoom:graphZoom,pan:{...graphPan},scrollLeft:sc.scrollLeft,scrollTop:sc.scrollTop}};
    Object.assign(netNavigation,{kind,key,index:i,label:(kind==='loads'?'Load ':kind==='drivers'?'Driver ':'雙向 ')+(i+1)+' / '+rows.length+' · '+e.instanceName+' / '+e.group+' / '+e.pin});
    const v=window.WIUNetReview.viewAt(point,sc.clientWidth,sc.clientHeight,graphZoom);graphZoom=v.zoom;graphPan=v.pan;sc.scrollLeft=0;sc.scrollTop=0;graphReadablePending=false;graphViewportAuto=false;dialog.close();applyGraphZoom();applyGraphNetFocus();
  }
  function chooseEndpoint(kind){const name=navigationNet();if(!name)return;const rows=netReview().net(name)[kind]||[];if(rows.length===1)return navigateEndpoint(kind,rows[0].key);if(!rows.length)return;
    openDialog((kind==='drivers'?'Driver':kind==='loads'?'Load':'雙向')+' · '+name,'<p>完整接線端點，包含畫面外的接腳。請選擇要定位的端點。</p><div class="r132-endpoint-list">'+rows.map(e=>'<button data-action="net-nav-go" data-kind="'+kind+'" data-id="'+esc(e.key)+'">'+window.WIUNetReview.endpointHTML(e)+'<small>'+esc(e.direction)+' · '+esc(e.range||'1 bit')+(e.via&&e.via!==name?' · '+esc(e.via):'')+'</small></button>').join('')+'</div>');
  }
  function stepLoad(delta){const name=navigationNet();if(!name)return;const rows=netReview().net(name).loads;if(!rows.length)return;const index=netNavigation?.name===name&&netNavigation.kind==='loads'?rows.findIndex(e=>e.key===netNavigation.key):-1;const next=index<0?(delta<0?rows.length-1:0):(index+delta+rows.length)%rows.length;navigateEndpoint('loads',rows[next].key);}
  function returnNetView(){const nav=netNavigation;if(!nav?.origin||nav.owner!==project.workbook.projectId)return;graphZoom=nav.origin.zoom;graphPan={...nav.origin.pan};const sc=$('.wb-canvas-scroll',shell);if(sc){sc.scrollLeft=nav.origin.scrollLeft;sc.scrollTop=nav.origin.scrollTop;}graphReadablePending=false;graphViewportAuto=false;netNavigation=null;applyGraphZoom();applyGraphNetFocus();}
  function graphNetDetails(){const review=netReview();return [...graphNetFocus].map(name=>{const n=review.net(name),label=e=>e.instanceName+' / '+e.group+' / '+e.pin+(e.assign?' ('+e.label+')':'');return {name,range:n.net?.range||'',from:n.drivers.map(label),to:n.loads.map(label),bidirectional:n.bidirectional.map(label)};});}
  function recomputeGraphNetFocus(){
    graphNetFocus.clear();
    for(const n of graphDirectNetFocus)if(project.nets.some(x=>x.name===n))graphNetFocus.add(n);
    if(graphGroupFocus.size){
      const scene=window.WIUTopScene.create(project),helper=window.WIUGroupFocusR100;
      for(const key of [...graphGroupFocus]){
        const selected=helper.forKey(scene,key,project);
        if(!selected){graphGroupFocus.delete(key);continue;}
        for(const n of selected.nets)graphNetFocus.add(n);
      }
    }
  }
  function graphObjectCommands(pin){
    if(!graphObject||graphObject.projectId!==project.workbook.projectId)return '';
    const button=(action,label,id,extra='')=>'<button type="button" data-action="'+action+'" data-id="'+esc(id)+'" '+extra+'>'+label+'</button>';
    const caption=text=>'<strong class="r107-object r118-selection-name">'+esc(text)+'</strong>';
    if(graphObject.kind==='instance'){
      const i=project.instances.find(v=>v.id===graphObject.id),m=i&&project.modules.find(v=>v.name===i.module);
      if(!i)return '';
      const layout=window.WIUInstanceLayout.settings(project,i.id),bar=layout.shape==='bar';
      const layouts='<span class="r128-layout-tools" role="group" aria-label="實例圖面版型">'+button('instance-shape','一般方塊',i.id,'data-shape="box" aria-pressed="'+!bar+'"')+button('instance-shape','水平長條',i.id,'data-shape="bar" aria-pressed="'+bar+'"')+(bar?button('instance-bottom','放到底部',i.id)+button('instance-compact',layout.compact?'展開全部訊號':'精簡標籤',i.id)+'<label>最小寬度 <input type="number" min="580" step="100" data-layout-width="'+esc(i.id)+'" value="'+(layout.width||580)+'" aria-label="長條最小寬度"></label>':'')+'</span>';
      return caption(i.name)+layouts+(m?button('wb-open','編輯共用介面',m.id):'')+button('instance-edit','實例參數／名稱',i.id)+button('graph-duplicate','建立副本',i.id)+button('graph-table','查看接線',i.id)+button('instance-delete','移除此實例',i.id);
    }
    const e=pin||window.WIUGraphWiring.endpoints(project).find(v=>v.key===graphObject.id);
    if(!e)return '';
    if(e.top)return caption(e.label)+button('graph-start-at-pin','從此接線',e.key)+button('net-inspect','查看接線',e.net.id);
    const binding=e.expr===null||e.expr===undefined?'未設定':e.expr===''?'刻意不接 NC':e.expr;
    return caption(e.label+' · '+binding)+button('graph-start-at-pin',e.expr==null?'從此接線':'從此改接',e.key)+
      (window.WIUInstanceLayout.settings(project,e.instance).shape==='bar'?button('bar-pin-side','移到上緣',e.key,'data-side="top"')+button('bar-pin-side','移到下緣',e.key,'data-side="bottom"'):'')+button('pin-connect','設定綁定',e.key)+(e.port.direction!=='output'?button('pin-quick-constant','接 0',e.key,'data-value="0"')+button('pin-quick-constant','接 1',e.key,'data-value="1"')+button('connection-choice','其他常數',e.key,'data-kind="constant"'):'')+
      button('connection-choice','刻意不接 NC',e.key,'data-kind="open"')+button('graph-table','查看接線表',e.instance,'data-pin="'+esc(e.key)+'"');
  }
  function selectGraphInstance(id){
    if(!project.instances.some(i=>i.id===id))return;
    graphNetFocus.clear();graphDirectNetFocus.clear();graphGroupFocus.clear();graphPinHint='';
    graphObject={kind:'instance',id,projectId:project.workbook.projectId};
    if(graphStart){finishGraphConnection();refreshGraphConnection();}else applyGraphNetFocus();
  }
  function locateGraphInstance(id){
    if(!project.instances.some(i=>i.id===id))return;
    go('graph');selectGraphInstance(id);
    const b=window.WIUTopScene.create(project).placed.find(x=>x.instance.id===id),sc=$('.wb-canvas-scroll',shell);
    if(b&&sc){
      graphZoom=Math.max(.65,graphZoom||1);sc.scrollLeft=0;sc.scrollTop=0;
      graphPan={x:sc.clientWidth/2-(b.x+b.width/2)*graphZoom,y:Math.min(80,sc.clientHeight/4)-b.y*graphZoom};applyGraphZoom();
      $$('[data-graph-drag]',shell).find(h=>h.dataset.graphDrag===id)?.focus({preventScroll:true});
    }
  }
  function showGroupPorts(){
    const scene=window.WIUTopScene.create(project),sections=[];
    for(const key of graphGroupFocus){
      const g=window.WIUGroupFocusR100.forKey(scene,key,project);if(!g)continue;
      const members=[...new Set(g.groups.flatMap(x=>x.members||[]))],inst=project.instances.find(i=>i.id===g.group.instance);
      sections.push('<h3>'+esc((inst?.name||'Top')+' / '+g.group.name)+'</h3><ul>'+members.map(n=>'<li><code>'+esc(n)+'</code></li>').join('')+'</ul>');
    }
    if(sections.length)openDialog('選取 Group 的接腳',sections.join(''));
  }
  function removeGraphInstance(id){
    W.removeInstanceWithLayout(project,id);
    const owns=key=>String(key||'').startsWith(id+'::');
    if(graphObject?.id===id||graphObject?.id.startsWith(id+'::'))graphObject=null;
    if(owns(graphStart))finishGraphConnection();
    selected.clear();instanceFilter='';project.orgEdited=true;
  }
  function openGraphTable(data={}){
    const sc=$('.wb-canvas-scroll',shell);
    if(sc)graphTableOrigin={projectId:project.workbook.projectId,scrollX:sc.scrollLeft,scrollY:sc.scrollTop,filter,instanceFilter,onlyUnbound,selected:[...selected],connectionView,focusedPin};
    const obj=graphObject?.projectId===project.workbook.projectId?graphObject:null;
    const pin=data.pin||(!data.id&&obj?.kind==='pin'?obj.id:'');
    const row=pin&&A.pinRows(project).find(r=>r.key===pin);
    const id=data.id||row?.instance||(obj?.kind==='instance'?obj.id:'');
    resetFilters();connectionView='table';
    if(project.instances.some(i=>i.id===id))instanceFilter=id;
    focusedPin=row?.key||'';
    if(row){filter=row.port.name;selected.add(row.key);if(graphTableOrigin)graphTableOrigin.pinKey=row.key;}
    go('connections');
  }
  function selectGraphGroup(key,append=false){
    graphObject=null;graphPinHint='';
    if(!append){graphDirectNetFocus.clear();graphGroupFocus.clear();}
    if(append&&graphGroupFocus.has(key))graphGroupFocus.delete(key);
    else graphGroupFocus.add(key);
    recomputeGraphNetFocus();applyGraphNetFocus();
  }
  function applyGraphNetFocus(){
    const canvas=$('.wb-canvas',shell);if(!canvas)return;
    let inspected;
    if(graphObject?.kind==='pin'&&graphObject.projectId===project.workbook.projectId){
      inspected=window.WIUGraphWiring.endpoints(project).find(e=>e.key===graphObject.id);
      if(!inspected){graphObject=null;graphPinHint='';}
      else {
        const net=inspectedNet(inspected)?.name||'';
        if(net!==graphObject.net){
          if(graphObject.net)graphDirectNetFocus.delete(graphObject.net);
          if(net)graphDirectNetFocus.add(net);
          graphObject.net=net;recomputeGraphNetFocus();
        }
      }
    }
    const existing=new Set(project.nets.map(n=>n.name));
    for(const n of [...graphNetFocus])if(!existing.has(n))graphNetFocus.delete(n);
    const active=graphNetFocus.size>0||graphGroupFocus.size>0;canvas.classList.toggle('r86-net-focus',active);
    for(const el of $$('[data-wire-net]',canvas))el.classList.toggle('r86-net-chosen',graphNetFocus.has(el.getAttribute('data-wire-net')));
    for(const el of $$('[data-net-label]',canvas))el.classList.toggle('r86-net-chosen',graphNetFocus.has(el.getAttribute('data-net-label')));
    for(const el of $$('[data-wire-name]',canvas))el.classList.toggle('r86-net-chosen',graphNetFocus.has(el.dataset.wireName));
    for(const el of $$('[data-graph-group],[data-graph-group-select]',shell)){
      const chosen=graphGroupFocus.has(el.dataset.graphGroup||el.dataset.graphGroupSelect);
      el.classList.toggle('r100-group-chosen',chosen);
      if(el.hasAttribute('aria-pressed'))el.setAttribute('aria-pressed',String(chosen));
    }
    const groupPicker=$('[data-graph-group-picker]',shell);
    if(groupPicker){
      const multi=groupPicker.querySelector('[data-multi-group]'),count=graphGroupFocus.size;
      if(multi){multi.hidden=count<2;multi.textContent='已追蹤 '+count+' 個 Group';}
      groupPicker.value=count>1?'__multiple__':count===1?[...graphGroupFocus][0]:'';
    }
    const instanceId=graphObject?.kind==='instance'&&graphObject.projectId===project.workbook.projectId?graphObject.id:'';
    for(const b of $$('[data-graph-drag]',canvas))b.setAttribute('aria-pressed',String(b.dataset.graphDrag===instanceId));
    const instancePicker=$('#r95-instance-select',shell);if(instanceId&&instancePicker)instancePicker.value=instanceId;
    const located=netNavigation?.owner===project.workbook.projectId&&netNavigation?.name===navigationNet()?netNavigation.key:null;
    for(const el of $$('[data-action="wb-pin"]',canvas))el.classList.toggle('r132-located',el.dataset.id===located);
    for(const el of $$('[data-graph-drag]',canvas))el.closest('.wb-block')?.classList.toggle('r132-located-block',!!located&&located.split('::')[0]===el.dataset.graphDrag);
    const commands=graphStart?'':graphObjectCommands(inspected);
    const status=$('[data-net-focus-status]',shell),tip=$('.r87-canvas-tip',shell);
    if(tip)tip.hidden=active||!!graphPinHint||!!commands;
    if(status){
      status.hidden=!active&&!graphPinHint&&!commands;
      if(active){
        const info=graphNetDetails();
        status.innerHTML='<span class="r118-object-tools">'+commands+'</span><strong>'+(graphGroupFocus.size?'Group '+graphGroupFocus.size+' 個 · ':'')+'追蹤 '+info.length+' 條 net<\/strong><span class="r87-net-names">'+info.map(x=>'<code>'+esc(x.name+x.range)+'<\/code>').join(' ')+'<\/span>'+navigationTools()+(graphGroupFocus.size?'<button type="button" data-action="graph-group-ports">組內接腳</button><button type="button" data-action="graph-group-batch">批次設定組內接腳</button>':'')+'<button type="button" data-graph-net-details>端點詳情<\/button><button type="button" data-graph-clear-net title="取消追蹤" aria-label="取消追蹤">×<\/button>';
      }else if(commands){status.innerHTML='<span class="r118-object-tools">'+commands+'</span><button type="button" data-graph-clear-net aria-label="取消選取">×</button>';}
      else if(graphPinHint){status.innerHTML='<span class="r87-net-names">'+esc(graphPinHint)+'<\/span><button data-graph-clear-net aria-label="關閉提示">×<\/button>';}
      else status.innerHTML='';
    }
  }
  function selectGraphNet(name,append=false,object=null){
    const exists=project.nets.some(n=>n.name===name);if(!exists)return;
    if(navigationNet()!==name)netNavigation=null;graphObject=object;graphPinHint='';
    if(!append){graphDirectNetFocus.clear();graphGroupFocus.clear();}
    if(append&&graphDirectNetFocus.has(name))graphDirectNetFocus.delete(name);else graphDirectNetFocus.add(name);
    recomputeGraphNetFocus();applyGraphNetFocus();
  }
  function clearGraphNetFocus(){
    graphNetFocus.clear();graphDirectNetFocus.clear();graphGroupFocus.clear();netNavigation=null;
    graphObject=null;graphPinHint='';applyGraphNetFocus();
  }
  async function downloadVisioWithGates(mode='native-routed'){
    let result;
    try{result=await drawingTask('export',{mode});if(!result)return false;}
    catch(error){
      openDialog('無法產生 VBS 圖面','<p>原生與固定圖形的產生流程未能完成。這不是要求先排除電氣或跳線警告：</p><pre style="white-space:pre-wrap">'+esc(error.message||error)+'</pre>');
      return false;
    }
    if(result.preparedSnapshot)commit(()=>{project.workbook.graphAutoR99=result.preparedSnapshot;});
    const content=result.vbs,bytes=new Uint8Array(2+content.length*2),data=new DataView(bytes.buffer);data.setUint16(0,0xfeff,true);
    for(let i=0;i<content.length;i++)data.setUint16(2+i*2,content.charCodeAt(i),true);
    download(filename()+'-top-visio-'+VERSION+'-'+(result.actualMode==='fixed-fallback'?'fixed-fallback':mode)+'.vbs',bytes,'application/octet-stream');
    const d=result.diagnostics,n=d.warnings.reduce((n,x)=>n+(x.count||1),0);
    toast('VBS 已產生並送出下載'+(result.fallbackError?'（固定圖形備用，沒有動態 GlueTo）':'')+'。'+(n?n+' 項提醒已保留在檢查與 VBS 檔頭；不阻擋下載。':'')+(d.electricalIssues.length?'電氣檢查未通過，這份檔案只是目前圖面。':'')+' Windows Visio 尚待實機核對。');
    return true;
  }
  async function previewGraphLayout(kind){
    if(kind==='arrange'&&(project.workbook.layoutLocks||[]).length){scopedLayoutForm();return;}
    const G=window.WIUTopScene,before=JSON.stringify(project),plan=await drawingTask('layout',{kind});if(!plan)return;if(JSON.stringify(project)!==before){toast('專案已變更，請重新預覽。');return;}
    const title={arrange:'整理 Block 與 Top ports',repair:'修復線距與擴大空間',fine:'精細局部修復',optimize:'重新自動走線'}[kind];
    const picture=scene=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(G.svg(scene));
    const summary=scene=>{const q=scene.routeQualityR98?.summary||{};return '安全衝突 '+(q.finalInvalid||0)+' · 線距不足 '+(q.parallelSpacing?.count||0)+' · 未完成跳線 '+(scene.crossingSummary?.unresolved||0);};
    openDialog(title+' · 變更預覽','<p>'+esc(kind==='arrange'?'重新安排 Block 與 Top ports，並整理接線。':kind==='fine'?'每輪約 8 秒的局部線距與轉角搜尋；完成檢查後顯示結果，可隨時取消。':kind==='optimize'?'重新計算路徑，取代手動走線；需要時擴大空間，保留鎖定 Block。':'先擴大不足的走線空間，再比較重排結果；保留手動線與鎖定 Block，不修改電氣綁定。')+'</p><p>'+esc(plan.note||'')+'</p><p>圖面尺寸：'+Math.round(plan.before.width)+' × '+Math.round(plan.before.height)+' → '+Math.round(plan.after.width)+' × '+Math.round(plan.after.height)+'</p><p>將移動 '+plan.moved+' 個 Block。套用是一筆可復原操作；取消不變更設計。</p><div class="r118-layout-compare"><figure><figcaption>目前 · '+summary(plan.before)+'</figcaption><img alt="目前排列" src="'+picture(plan.before)+'"></figure><figure><figcaption>預覽 · '+summary(plan.after)+'</figcaption><img alt="變更後排列" src="'+picture(plan.after)+'"></figure></div>',plan.unchanged?null:'套用 '+title,()=>{if(JSON.stringify(project)!==before)throw Error('專案已變更，請重新預覽。');commit(()=>{project=plan.project;},'已套用 '+title+'，可一次復原。',{label:title,scope:'top'});dialog.close();});
  }
  function optimizeGraphRoutes(){previewGraphLayout('optimize');}
  function repairGraphJumps(){previewGraphLayout('repair');}
  function showGraphCrossingReview(){
    if(!window.WIUTopScene.peek(project)||window.WIUTopScene.peek(project).previewOnly){go('graph');toast('圖面目前為快速預覽，請先完成背景整理，再查看交叉檢查。');return;}
    const scene=window.WIUTopScene.create(project),summary=scene.crossingSummary,issueList=scene.crossingIssues,quality=scene.routeQualityR98?.summary,spacing=quality?.parallelSpacing?.count||0;
    const locate=issue=>Number.isFinite(issue.x)&&Number.isFinite(issue.y)?'<button type="button" data-action="graph-jump" data-graph-x="'+Math.round(issue.x)+'" data-graph-y="'+Math.round(issue.y)+'">定位 ('+Math.round(issue.x)+', '+Math.round(issue.y)+')</button>':'';
    const gapIssues=quality?.parallelSpacing?.issues||[];
    const gapRows=gapIssues.slice(0,40).map((issue,index)=>'<tr><td>'+(index+1)+'</td><td><code>'+esc(issue.netA)+' / '+esc(issue.netB)+'</code></td><td>'+(issue.horizontal?'水平':'垂直')+'</td><td>'+issue.gap.toFixed(1)+' / '+issue.required+'</td><td>'+locate(issue)+'</td></tr>').join('');
    const clearanceDetail=issue=>{
      const c=issue.clearances?.find(v=>Number.isFinite(v.gap));
      return c?'（'+esc(c.netA)+' / '+esc(c.netB)+'，淨距 '+c.gap.toFixed(1)+'，需求 '+c.required+'）':'';
    };
    const rows=issueList.slice(0,150).map((issue,index)=>'<tr><td>'+(index+1)+'</td><td>'+esc(issue.reason||(issue.kind==='overlap'?'不同 net 共線':'跳線排版尚未完成'))+clearanceDetail(issue)+'</td><td><code>'+esc(issue.nets.join(' / '))+'</code></td><td>'+locate(issue)+'</td></tr>').join('');
    const gates=window.WIUTopScene.exportDiagnostics(project);
    const gatesMarkup='<p><b>VBS 下載：</b>'+(gates.canExport?'目前圖面可產生 VBS；電氣與幾何提醒都不阻擋下載。':'圖面產生失敗：'+esc(gates.blockers.map(x=>x.message).join('；')))+'</p>'+(gates.electricalIssues.length?'<p class="a-note a-warn"><b>電氣檢查：</b>'+esc(gates.electricalIssues.slice(0,10).map(x=>x.code+' '+x.message).join('；'))+'。圖面可下載不代表設計通過。</p>':'');
    const body=gatesMarkup+'<p>這是圖面幾何檢查，不是 RTL 接線檢查。相同 net 的分岔才畫接點；不同 net 正交跨線由連續線路本體形成跳線。不同 net 共用同一條線段不能用半圓表示，需調整線路。<\/p>'+
      '<p><b>本張圖：<\/b>'+summary.branches+' 條可繪製分支、'+summary.bridges+' 個正交／曲線交叉跳線、'+summary.junctions+' 個接點、'+summary.overlaps+' 處異源共線、'+(summary.sharedSourceLeads||0)+' 處同源短引出、'+summary.unresolved+' 處無法安全放置跳線；自動改道 '+summary.trackMoves+' 段。<\/p>'+
      '<p>相鄰線的外緣淨距：水平至少 2 pad（28 單位），垂直至少 1 pad（14 單位）。線距不足 '+spacing+' 項，pad 或 Block 安全距離不足 '+(quality?.finalInvalid||0)+' 條。</p>'+
      (scene.autoSize?.active?'<p><b>Top 自動排版／擴張：<\/b>寬度 +'+scene.autoSize.widthAdded+'，高度 +'+scene.autoSize.heightAdded+'，重排 '+scene.autoSize.changedInstances+' 個 Block。網站及 Visio 使用同一份座標。<\/p>':'')+
      '<p>點「定位」直接跳到交叉處，不必自己找座標；這是圖面品質警告，不代表 RTL 線斷開，也不要求先手動整理才能下載 VBS。<\/p><button type="button" data-tool-tab="check">前往設計檢查</button><button type="button" data-action="graph-visio-routed">下載目前 VBS<\/button><button type="button" data-action="graph-repair-jumps">修復線距與擴大空間<\/button>'+
      (gapRows?'<h3>平行線間距不足（前 40 組）<\/h3><div class="a-tablebox"><table class="a-table"><thead><tr><th>#<\/th><th>訊號 A / B<\/th><th>方向<\/th><th>淨距 / 需求<\/th><th>位置<\/th><\/tr><\/thead><tbody>'+gapRows+'<\/tbody><\/table><\/div>':'')+
      (rows?'<div class="a-tablebox" style="max-height:400px;overflow:auto"><table class="a-table"><thead><tr><th>#<\/th><th>狀態<\/th><th>net 名稱<\/th><th>圖面座標<\/th><\/tr><\/thead><tbody>'+rows+'<\/tbody><\/table><\/div>':'<p>未偵測到無法安全繪製的交叉或共線。<\/p>')+
      (issueList.length>150?'<p>僅列出前 150 項；所有衝突仍計入總數。<\/p>':'');
    openDialog('Top 路由與交叉檢查',body);
  }
  function jumpGraphIssue(x,y){
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    if(dialog.open)dialog.close();
    if(currentView!=='assembly'||tab!=='graph'){
      tab='graph';view('assembly');render();
    }
    const sc=$('.wb-canvas-scroll',shell),canvas=$('.wb-canvas',shell);
    if(!sc||!canvas){toast('無法定位：Top 接線圖尚未開啟');return;}
    graphZoom=Math.max(.7,Math.min(1.5,Number(graphZoom)||1));
    graphPan={x:(sc.clientWidth||800)/2-x*graphZoom,y:(sc.clientHeight||600)/2-y*graphZoom};
    applyGraphZoom();
    const dot=document.createElement('div');dot.className='r102-issue-marker';
    dot.style.cssText='position:absolute;z-index:999;left:'+(x-12)+'px;top:'+(y-12)+'px;width:24px;height:24px;border:4px solid #dd394d;border-radius:50%;box-shadow:0 0 0 10px rgba(221,57,77,.14);background:rgba(221,57,77,.15);pointer-events:none;';
    canvas.append(dot);
    setTimeout(()=>dot.remove(),5000);
    toast('已定位 ('+Math.round(x)+', '+Math.round(y)+')；紅圈為原始檢查位置。');
  }
  function showGraphNetDetails(){
    const lines=graphNetDetails().map(x=>'<div class="r87-net-detail"><h3><code>'+esc(x.name+x.range)+'<\/code><\/h3><p><b>起點：<\/b>'+esc(x.from.join('、')||'尚未辨識')+'<\/p><p><b>終點：<\/b>'+esc(x.to.join('、')||'尚未辨識')+'<\/p>'+(x.bidirectional.length?'<p><b>雙向：</b>'+esc(x.bidirectional.join('、'))+'</p>':'')+'<\/div>').join('');
    openDialog('目前追蹤的 net',lines||'<p>尚未選取連線。<\/p>');
  }
  function beginGraphLabelEdit(label){
    if(!label||!label.isConnected)return;
    label.readOnly=false;label.dataset.wireEditing='true';
    label.focus({preventScroll:true});label.select();
  }
  shell.addEventListener('pointerdown',e=>{
    const label=e.target.closest?.('[data-wire-name]');if(!label||e.button!==0)return;
    e.stopImmediatePropagation();
    if(e.ctrlKey||e.metaKey){e.preventDefault();selectGraphNet(label.dataset.wireName,true);return;}
    if(label.readOnly){e.preventDefault();document.activeElement?.blur();selectGraphNet(label.dataset.wireName,false);beginGraphLabelEdit(label);}
  },true);
  // Don't allow canvas pan/pointer capture to swallow a Group title click.
  // This must run in capture phase, before normal panning can claim the pointer.
  shell.addEventListener('pointerdown',e=>{
    if(e.button!==0||!e.target.closest?.('[data-graph-group],[data-graph-group-select]'))return;
    e.stopImmediatePropagation();
  },true);
  shell.addEventListener('click',e=>{
    const group=e.target.closest('[data-graph-group],[data-graph-group-select]');
    if(group){e.preventDefault();e.stopImmediatePropagation();selectGraphGroup(group.dataset.graphGroup||group.dataset.graphGroupSelect,e.ctrlKey||e.metaKey);return;}
    const clear=e.target.closest('[data-graph-clear-net]');if(clear){e.preventDefault();e.stopImmediatePropagation();clearGraphNetFocus();return;}
    if(e.target.closest('[data-graph-net-details]')){e.preventDefault();e.stopImmediatePropagation();showGraphNetDetails();return;}
    const label=e.target.closest('[data-wire-name]');
    if(label&&label.readOnly){e.preventDefault();e.stopImmediatePropagation();return;}
    const hit=e.target.closest('[data-wire-hit]');if(hit){e.preventDefault();e.stopImmediatePropagation();selectGraphNet(hit.dataset.wireHit,e.ctrlKey||e.metaKey);return;}
    if((graphObject||graphNetFocus.size||graphGroupFocus.size)&&e.target.closest('.wb-canvas')&&!e.target.closest('button,input,[data-graph-drag],[data-top-drag]'))clearGraphNetFocus();
  },true);
  shell.addEventListener('dblclick',e=>{const handle=e.target.closest?.('[data-graph-drag]');if(handle){e.preventDefault();selectGraphInstance(handle.dataset.graphDrag);instanceForm(handle.dataset.graphDrag);return;}
    const label=e.target.closest?.('[data-wire-name]');
    if(label){e.preventDefault();e.stopImmediatePropagation();beginGraphLabelEdit(label);}
  },true);
  shell.addEventListener('keydown',e=>{
    if(e.isComposing||e.keyCode===229)return;
    const label=e.target.closest?.('[data-wire-name]');
    if(label&&label.readOnly){
      if(e.key==='F2'){e.preventDefault();e.stopImmediatePropagation();beginGraphLabelEdit(label);return;}
      if(['Enter',' '].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();selectGraphNet(label.dataset.wireName,e.ctrlKey||e.metaKey);return;}
    }
    if(['Enter',' '].includes(e.key)){
      const group=e.target.closest?.('[data-graph-group],[data-graph-group-select]');
      if(group){e.preventDefault();e.stopImmediatePropagation();selectGraphGroup(group.dataset.graphGroup||group.dataset.graphGroupSelect,e.ctrlKey||e.metaKey);return;}
      const hit=e.target.closest?.('[data-wire-hit]');if(!hit)return;
      e.preventDefault();e.stopImmediatePropagation();selectGraphNet(hit.dataset.wireHit,e.ctrlKey||e.metaKey);
    }
  },true);
  window.addEventListener('keydown',e=>{
    const group=e.target.closest?.('[data-graph-group],[data-graph-group-select]');
    if(group&&['Enter',' '].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)selectGraphGroup(group.dataset.graphGroup||group.dataset.graphGroupSelect,e.ctrlKey||e.metaKey);return;}
    if(e.key==='F2'&&graphNetFocus.size===1&&!dialog.open&&!e.target.closest?.('input:not([readonly]),textarea,select,[contenteditable="true"]')){
      const name=[...graphNetFocus][0],label=$$('[data-wire-name]',shell).find(x=>x.dataset.wireName===name);
      if(label){e.preventDefault();e.stopImmediatePropagation();beginGraphLabelEdit(label);}
    }
    if(e.key==='Escape'&&!dialog.open&&graphActive()&&(graphObject||graphNetFocus.size||graphGroupFocus.size)&&!e.target.closest?.('input:not([readonly]),textarea,select,[contenteditable="true"]'))clearGraphNetFocus();
  },true);
  function renderWorkbook(){
    if(!project.workbook)project=W.normalize(project);
    if(activeModule!=='top'&&!project.modules.some(m=>m.id===activeModule))activeModule='top';
    const working=tab!=='home'||currentView==='diagram',design=currentView==='diagram'||!['bundle','export','check','help'].includes(tab);
    document.body.classList.toggle('wb-active',working);
    document.body.classList.toggle('r81-graph',currentView==='assembly'&&tab==='graph');
    document.body.classList.toggle('r81-focus',currentView==='assembly'&&tab==='graph'&&graphFocus);
    document.body.classList.toggle('r69-with-rail',working&&design&&railOpen);
    document.body.classList.toggle('r69-delivery',['bundle','export'].includes(tab)&&currentView==='assembly');
    rail.hidden=!working||!design||!railOpen;renderRail();
    if(!$('#r124-name:focus',switchbar)&&!pendingField?.element?.matches('#r124-name'))switchbar.innerHTML=globalHeader();stagebar.hidden=!working;stagebar.innerHTML=stageNav();
    const m=W.moduleOf(project,activeModule);
    diagramBar.hidden=currentView!=='diagram'||activeModule==='top';
    document.body.classList.toggle('r107-rtl-owned',lockedStructure());
    if(!diagramBar.hidden){
      const n=project.instances.filter(i=>i.module===m.name).length;
      diagramBar.innerHTML='<strong class="a-mono">'+esc(m.name)+'</strong><span>共用介面 · '+(m.interfaceOnly?'介面骨架，可編輯 I/O':'編輯 I/O 時同步更新 RTL')+'</span><button data-action="module-usage" data-id="'+esc(m.id)+'">Top 直接使用 '+n+' 顆</button>'+(m.interfaceOnly?'':'<button data-action="module-update-rtl" data-id="'+esc(m.name)+'">更新 RTL</button>');
    }
    if(lastInterfaceImpact&&JSON.stringify(project.modules.find(m=>m.id===lastInterfaceImpact.moduleId)?.ports)!==lastInterfaceImpact.signature)lastInterfaceImpact=null;
    if(!diagramBar.hidden&&lastInterfaceImpact?.moduleId===activeModule)diagramBar.innerHTML+='<button data-action="interface-impact">最近修改：'+lastInterfaceImpact.ports.length+' 個接腳 · '+lastInterfaceImpact.instances.length+' 顆 instances</button>';
    document.title='WrapItfUp '+VERSION+' · '+project.top+(currentView==='diagram'&&activeModule!=='top'?' / '+m.name:'')+(sessionKind==='practice'?(isConnectionExample()?' · 內建範例':' · 練習'):'');
    renderPracticeCoach();inlineTop();disabledReasons(switchbar);
  }
  rail.addEventListener('input',e=>{if(e.target.id!=='r119-rail-search')return;railQuery=e.target.value;const caret=e.target.selectionStart;renderRail();const input=$('#r119-rail-search',rail);input.focus();input.setSelectionRange(caret,caret);stash();});
  rail.addEventListener('change',e=>{if(e.target.id!=='r119-rail-usage')return;railUsage=e.target.value;renderRail();stash();});
  function renderPracticeCoach(){
    practiceCoach.hidden=sessionKind!=='practice'||tab==='lesson'||tab==='home'||tab==='help'||tourStep>=0||!L.isLearning(project);
    if(practiceCoach.hidden)return;
    const state=window.WIUFocusGuide.current(project),needs=['ports','data','cfg-ack','cfg-stat','cfg-done'].includes(state.id),done=!needs||state.done;
    const hint='依照目前步驟操作，或切換自由編輯；目前接線會保留。';
    practiceCoach.innerHTML='<div class="wb-coach-heading"><strong>練習 '+(state.index+1)+' / '+state.total+' · '+esc(state.short)+'<\/strong><button data-action="wb-coach-toggle">'+(practiceCoachExpanded?'收合':'展開')+'<\/button><\/div>'+(practiceCoachExpanded?'<p>'+esc(state.blocked?state.blockedReason:state.effect)+'<\/p><small>'+esc(hint)+'<\/small><div class="wb-coach-actions">'+(state.ready?'<button data-action="guide-download">下載完成的工作包<\/button>':state.blocked?'':'<button class="a-primary" data-action="wb-practice-check" '+(!done?'disabled':'')+'>確認並下一步 →<\/button>'+(!done?'<button data-action="wb-practice-demo">示範這一步<\/button>':''))+'<button data-tab="lesson">回到導讀<\/button><\/div>':'');
  }
  function practiceStep(demo=false){const state=window.WIUFocusGuide.current(project);if(!demo&&['ports','data','cfg-ack','cfg-stat','cfg-done'].includes(state.id)&&!state.done)throw Error('這一步尚未完成，請先依提示操作，或查看示範。');commit(()=>{project=window.WIUFocusGuide.advance(project,state.id);});refreshSheet();}
  function openSheet(id){window.WIUBridge?.finish();if(currentView==='diagram')sheetViews.set(project.workbook.projectId+'::'+activeModule,window.WIUBridge?.uiSnapshot());const m=W.moduleOf(project,id);if((m.parameters||[]).some(x=>x.local))throw Error('這個介面含 localparam，請在參數設定與 RTL 來源編輯；接線與原文保留。');diagramGuard=true;try{window.WIUBridge?.loadSheet(W.makeDiagram(project,id));activeModule=id;}finally{diagramGuard=false;}view('diagram');renderWorkbook();if(sheetViews.has(project.workbook.projectId+'::'+id))window.WIUBridge?.restoreUi(sheetViews.get(project.workbook.projectId+'::'+id));else window.WIUBridge?.workspaceZoom?.('all');}
  function interfaceImpactBody(x,pending=false){
    const show=p=>p?esc(p.direction+' '+(p.range||'1 bit')+' '+p.name):'—';
    return '<p>'+x.instances.length+' 顆 instances · '+x.bindings+' 筆受影響綁定。'+(pending?'尚未套用；關閉可取消。':'已同步核對；新接腳保持未設定。')+'</p><table><thead><tr><th>修改前</th><th>修改後</th></tr></thead><tbody>'+x.ports.map(p=>'<tr><td>'+show(p.before)+'</td><td>'+show(p.after)+'</td></tr>').join('')+'</tbody></table><p>'+x.instances.map(i=>esc(i.name)).join('、')+'</p>';
  }
  function removalBody(plan){
    const names=plan.nets.map(n=>esc(n.name)).join('、');
    return '<p>刪除 '+plan.nets.length+' 個宣告：'+names+'</p><p><b>'+plan.connections.length+' 筆接線、'+plan.assigns.length+' 條 assign、'+plan.ties.length+' 筆 Empty 設定</b> 將一起移除。原 instance 接腳改為「未設定」，不會自動改接或當成 NC。整批可一次復原。</p><details><summary>查看受影響項目</summary><ul>'+plan.connections.map(c=>'<li>接線 '+esc(project.instances.find(i=>i.id===c.instance)?.name+'.'+c.port)+' ← '+esc(c.expr)+'</li>').join('')+plan.assigns.map(a=>'<li>assign '+esc(a.target+' = '+a.expr)+'</li>').join('')+plan.ties.map(t=>'<li>Empty '+esc(t.port+' = '+t.expr)+'</li>').join('')+'</ul></details>';
  }
  let bulkPending=false;
  function diagramChanged(raw,parsed,deferred=false){
    if(diagramGuard||currentView!=='diagram')return;
    if(bulkPending&&!deferred)return {status:'pending',message:'正在處理上一批，請稍候。'};
    const oldPorts=W.moduleOf(project,activeModule).ports,nextNames=new Set(parsed.ports.map(p=>p.name));
    const changed=oldPorts.filter(p=>!nextNames.has(p.name)).length+parsed.ports.filter(p=>!oldPorts.some(o=>o.name===p.name)).length;
    if(changed>=8&&!deferred){
      bulkPending=true;const before=JSON.stringify(project);refreshSheet();
      openDialog('處理 '+changed+' 個接腳','<p role="status">正在準備整批修改；完成後統一檢查。可關閉取消。</p><progress aria-label="準備整批修改"></progress>');
      const marker=$('progress',dialog);
      setTimeout(()=>{try{if(!marker?.isConnected||!dialog.open)return;if(JSON.stringify(project)!==before)throw Error('專案已變更，請重試。');dialog.close();diagramChanged(raw,parsed,true);}catch(e){toast(e.message);}finally{bulkPending=false;}},32);
      return {status:'pending',message:'正在處理整批接腳。'};
    }
    try{
      const id=activeModule,result=W.applyDiagram(project,id,raw,parsed),impact=window.WIUWorkflowR118.interfaceImpact(project,result.project,id),before=JSON.stringify(project);
      if(JSON.stringify(result.project)!==before){
        const apply=()=>{
          if(JSON.stringify(project)!==before)throw Error('專案已變更，請重新修改介面。');
          commit(()=>{if(id!=='top'){const old=project.modules.find(m=>m.id===id),f=project.rtlSources.find(f=>f.name===(old?.sourceFilename||old?.filename));if(f&&result.project.rtlSources.find(x=>x.name===f.name)?.text!==f.text){result.project.workbook.guiEditedSources||={};result.project.workbook.guiEditedSources[f.name]||={baseText:f.text,module:old.name};}}project=result.project;},undefined,{label:'修改 '+W.moduleOf(result.project,id).name+' 共用介面',scope:id});
          if(impact.ports.length){lastInterfaceImpact={...impact,moduleId:id,signature:JSON.stringify(W.moduleOf(project,id).ports)};toast('已同步 '+impact.instances.length+' 顆 instances、核對 '+impact.bindings+' 筆綁定；可復原。');}
          else if(result.changes.length)toast(result.changes.join('；'));
          refreshSheet();
        };
        if(result.removal){
          refreshSheet();openDialog('刪除 Top 接腳與相關設定？',removalBody(result.removal),'刪除並清理相關設定',()=>{apply();dialog.close();});
          return {status:'pending',message:'請核對整批刪除的影響。'};
        }else if(impact.bindings&&impact.ports.some(p=>p.before)){
          refreshSheet();
          openDialog('套用共用介面修改？',interfaceImpactBody(impact,true)+'<p>改名會同步更新綁定；刪除接腳會保留原綁定並標記失去端點，需修正。整批可用一次 Undo 復原。</p>','確認套用',()=>{apply();dialog.close();});
          return {status:'pending',message:'尚未套用；請在視窗核對後確認。'};
        }else apply();
      }
    }catch(e){toast(e.message);refreshSheet();renderWorkbook();return {status:'rejected',message:e.message};}
    renderWorkbook();return {status:'accepted'};
  }
  function refreshSheet(){if(currentView==='diagram'){const ui=window.WIUBridge?.uiSnapshot();diagramGuard=true;try{window.WIUBridge?.loadSheet(W.makeDiagram(project,activeModule));window.WIUBridge?.restoreUi(ui);}finally{diagramGuard=false;}}renderWorkbook();}
  function beginPractice(next,nextTab='lesson'){
    window.WIUBridge?.finish();if(!practiceReturn){if(dirty()||!draft)writeDraft();practiceReturn={project:A.clone(project),workspace:workspace(),past:past.slice(),future:future.slice(),saved,draft,downloadState:A.clone(downloadState)};}
    clearTimeout(saveTimer);sessionKind='practice';project=W.normalize(next);past=[];future=[];saved=JSON.stringify(project);draft=null;downloadState={};activeModule='top';graphStart='';graphConnectMode=project.workbook?.example!=='gen-top-complete';graphQuickConnect=false;practiceCoachExpanded=false;resetFilters();lessonTask='';focusedPin='';rtlOpen=false;dialog.close();view('assembly');tab=nextTab;render();focusStep();
  }
  function endPractice(){if(!practiceReturn)return;graphConnectMode=false;window.WIUBridge?.finish();clearTimeout(saveTimer);const back=practiceReturn;practiceReturn=null;sessionKind='user';project=back.project;past=back.past;future=back.future;saved=back.saved;draft=back.draft;downloadState=back.downloadState;dialog.close();restoreWorkspace(back.workspace);toast('已回到你的專案；原本內容、復原紀錄與畫面位置已恢復。');}
  function practiceIntro(){startTemplate();}
  function moduleParameters(){
    window.WIUBridge?.finish();
    const m=W.moduleOf(project,activeModule),pw=window.WIUPortWidths,readonly=activeModule!=='top'&&!m.interfaceOnly;
    const params=m.parameters||[],reserved=m.ports.map(p=>p.name).concat(activeModule==='top'?[...project.nets.filter(n=>n.direction==='wire').map(n=>n.name),...project.instances.map(i=>i.name)]:[]);
    const body='<p>只編輯 <strong>'+esc(m.name)+'<\/strong> 的 parameter；宣告在此模組的 input / output 前，不會使用其他模組的同名參數。位寬可填 <code>DATA_W<\/code>、<code>DATA_W / 8<\/code> 或 <code>[31:16]<\/code>。<\/p>'+
      (readonly?'<p class="a-note">此模組已有 RTL 實作，預設參數由來源定義。要改預設值，請更新並匯入 RTL；單個 instance 可在「設定」覆寫。<\/p>':'')+
      (activeModule==='top'?'<p class="a-note a-warn">公司手冊支援 param 與 keep_inst_port_parameter；WIU 尚未完成此 Top 參數的匯出映射與重產驗證，下載包會列出待公司工具驗證的事項。請保留設計參數，不必為消除提示而改成固定值。<\/p>':'')+
      '<label>模組參數（每行一個 NAME = expression）<textarea id="r72-parameters" rows="5" spellcheck="false" '+(readonly?'readonly class="r119-readonly"':'')+' placeholder="DATA_W = 512&#10;KEEP_W = DATA_W / 8">'+esc(params.map(p=>(p.local?'localparam ':'')+(p.type?p.type+' ':'')+p.name+' = '+p.value).join('\n'))+'<\/textarea><\/label>'+
      '<div id="r72-param-preview" class="r72-param-preview" role="status"><\/div><p>放入 Top 後，在接線頁點「Instance 參數」填入覆寫值，例如 <code>DATA_W = 256<\/code>。未填的參數沿用預設值；改值後請檢查既有接線。<\/p>';
    const read=()=>{const definitions=readonly?params:pw.parseDefinitions($('#r72-parameters',dialog).value,reserved);return {definitions,context:pw.defaults(definitions,project)};};
    openDialog(m.name+' · 參數與位寬',body,readonly?null:'套用參數',readonly?null:()=>{
      const {definitions}=read(),raw=window.WIUBridge.raw(),ui=window.WIUBridge.uiSnapshot();
      raw.parameters=definitions.map(p=>'parameter '+(p.type?p.type+' ':'')+p.name+' = '+p.value).join(', ');
      const result=W.applyDiagram(project,activeModule,raw,window.WIUBridge.parseSheet(raw,project.defineConfig));
      commit(()=>{project=result.project;},'已更新模組參數；可用復原還原。');dialog.close();refreshSheet();window.WIUBridge.restoreUi(ui);
    });
    if(readonly){const nav=document.createElement('div');nav.className='a-actions';nav.innerHTML='<button data-action="module-update-rtl" data-id="'+esc(m.name)+'">更新來源 RTL</button><button data-action="module-usage" data-id="'+esc(m.id)+'">選擇 instance 覆寫</button>';$('.a-dialog-content',dialog).prepend(nav);}
    const target=$('#r72-param-preview',dialog);
    target.innerHTML='<div data-param-status role="status"><\/div><table><thead><tr><th>接腳<\/th><th>原始範圍<\/th><th>預設位寬<\/th><\/tr><\/thead><tbody>'+m.ports.map((p,i)=>'<tr><td>'+esc(p.name)+'<\/td><td><code>'+esc(p.range||'1')+'<\/code><\/td><td data-param-port="'+i+'"><\/td><\/tr>').join('')+'<\/tbody><\/table>';
    const preview=()=>{const result=readonly?{errors:[],ports:m.ports.map(p=>({...p,info:pw.width(p.range,params,project)}))}:pw.previewDefinitions($('#r72-parameters',dialog).value,m.ports,project,reserved),apply=$('[data-dialog="apply"]',dialog),status=$('[data-param-status]',dialog);
      status.classList.toggle('r73-error',!!result.errors.length);status.textContent=result.errors.length?result.errors.map(e=>(e.line?'第 '+e.line+' 行：':'')+e.message).join('；'):'下表即時使用本模組的參數。Ctrl/Cmd+Z 撤回最近一次文字修改。';
      result.ports.forEach((p,i)=>{const cell=$('[data-param-port="'+i+'"]',dialog);cell.textContent=p.info.error?'未解析：'+p.info.error:p.info.width+' bits';cell.classList.toggle('r73-error',!!p.info.error);});
      if(apply){apply.disabled=!!result.errors.length;apply.title=result.errors.length?'請修正上方紅色參數錯誤':'';}
    };
    $('#r72-parameters',dialog).addEventListener('input',preview);preview();
  }
  function newSheet(){openDialog('畫一個子模組','<p>先替模組命名，再在介面圖新增接腳。完成後直接放入 Top 使用。<\/p><label>Module 名稱<input id="wb-module-name" value="" placeholder="例如 cemac_core" spellcheck="false"><\/label>','建立介面頁',()=>{const result=W.createModule(project,$('#wb-module-name',dialog).value.trim());commit(()=>{project=result.project;},null,{deferRender:true});dialog.close();openSheet(result.id);});}
  function previewWorkbook(raw){const incoming=W.read(raw);openDialog('開啟 '+esc(incoming.project.top),'<p>'+incoming.project.modules.length+' 個模組定義 · '+incoming.project.instances.length+' 個 instances · '+(incoming.origin==='practice'?'練習專案：會在隔離環境開啟':'完整專案')+'<\/p>'+incoming.warnings.map(x=>'<p class="a-note">'+esc(x)+'<\/p>').join(''),'開啟專案',()=>{dialog.close();if(incoming.origin==='practice'&&sessionKind==='user')beginPractice(incoming.project,incoming.workspace.tab||'graph');else commit(()=>{project=incoming.project;graphNeedsPrepare=true;draft=null;});restoreWorkspace(incoming.workspace);saved=JSON.stringify(project);renderWorkbook();if(sessionKind==='user')stash();});}
  function readLegacyDiagram(raw){if(raw.version!==undefined&&(!Number.isInteger(raw.version)||raw.version<1||raw.version>5))throw Error('不支援這個舊圖檔版本。');openDialog('匯入舊版介面圖','<p>保留圖面原文並加入目前專案的「舊版保留圖面」，不會取代 Top 接線。<\/p>','保留圖面',()=>{commit(()=>{project.workbook.recovered.push({id:uid(),label:(raw.state||raw).moduleName||'舊版圖面',diagram:A.clone(raw)});});dialog.close();go('modules');});}
  function recoveredSheet(id){const entry=project.workbook.recovered.find(x=>x.id===id);if(!entry)return;const raw=entry.diagram.state||entry.diagram;openDialog('核對舊圖面 '+esc(raw.moduleName),'<p>請為這份介面設定不重複的 module 名稱。舊版圖面將成為可放入 Top 的介面骨架；現有接線不變。<\/p><label>Module 名稱<input id="wb-recovered-name" value="'+esc(C.validName(raw.moduleName)?raw.moduleName:'recovered_module')+'"><\/label><button data-action="discard-recovered" data-id="'+esc(id)+'">捨棄這份保留圖面…</button>','加入模組頁',()=>{const made=W.createModule(project,$('#wb-recovered-name',dialog).value.trim()),d=A.clone(raw);d.moduleName=made.project.modules.find(m=>m.id===made.id).name;const parsed=window.WIUBridge?.parseSheet(d,project.defineConfig);if(!parsed)throw Error('介面圖解析器尚未就緒。');const result=W.applyDiagram(made.project,made.id,d,parsed);result.project.workbook.recovered=result.project.workbook.recovered.filter(x=>x.id!==id);commit(()=>{project=result.project;});dialog.close();openSheet(made.id);});}
  function applyGraphZoom(){
    const canvas=$('.wb-canvas',shell),sc=$('.wb-canvas-scroll',shell);if(!canvas||!sc||sc.clientWidth<50||sc.clientHeight<50)return;
    if(graphReadablePending){graphReadablePending=false;graphViewportAuto=true;graphZoom=Math.max(.08,Math.min(1,sc.clientWidth/Number(canvas.dataset.graphWidth||1400),sc.clientHeight/(parseFloat(canvas.style.height)||600)));graphPan={x:0,y:0};}
    const zoom=graphZoom||Math.max(.08,Math.min(1,(sc.clientWidth||1100)/Number(canvas.dataset.graphWidth||1400),(sc.clientHeight||600)/(parseFloat(canvas.style?.height)||600)));
    if(!canvas.style)return;canvas.style.zoom=String(zoom);canvas.style.setProperty('--r128-edit-scale',String(1/zoom));canvas.style.transformOrigin='0 0';canvas.style.transform='translate('+graphPan.x/zoom+'px,'+graphPan.y/zoom+'px)';
    sc.scrollLeft=0;sc.scrollTop=0;
    const scroll=$('.wb-canvas-scroll',shell);if(scroll)scroll.dataset.overview=String(!!graphWindow(window.WIUTopScene.peek(project)||{points:{}})?.overview);const label=$('[data-graph-zoom-label]',shell);if(label)label.textContent=Math.round(zoom*100)+'%';scheduleGraphViewport();
  }
  function setGraphZoom(mode,anchor,automatic=false){
    if(!automatic)graphViewportAuto=false;
    const canvas=$('.wb-canvas',shell),sc=$('.wb-canvas-scroll',shell);if(!canvas||!sc)return;
    if(mode==='back'){if(previousGraphView){const next={zoom:graphZoom,pan:{...graphPan}};graphZoom=previousGraphView.zoom;graphPan={...previousGraphView.pan};previousGraphView=next;applyGraphZoom();}return;}
    previousGraphView={zoom:graphZoom,pan:{...graphPan}};graphReadablePending=false;
    if(mode==='all'){graphZoom=Math.max(.08,Math.min(1,sc.clientWidth/Number(canvas.dataset.graphWidth||1400),sc.clientHeight/(parseFloat(canvas.style.height)||600)));graphPan={x:0,y:0};}
    else if(mode==='selection'){const scene=window.WIUTopScene.create(project),b=graphObject?.kind==='instance'?scene.placed.find(x=>x.instance.id===graphObject.id):null;if(!b){toast('請先選取要定位的 Block。');return;}graphZoom=Math.min(1.5,(sc.clientWidth-100)/b.width,(sc.clientHeight-100)/b.height);graphPan={x:sc.clientWidth/2-(b.x+b.width/2)*graphZoom,y:sc.clientHeight/2-(b.y+b.height/2)*graphZoom};}else if(mode==='read'){graphZoom=1;graphPan={x:24,y:24};}
    else if(mode==='fit'){const raw=Math.min(1,(sc.clientWidth||1100)/Number(canvas.dataset.graphWidth||1400),(sc.clientHeight||600)/(parseFloat(canvas.style?.height)||600));graphZoom=Math.max(.30,raw);graphPan=raw<.30?{x:(sc.clientWidth||1100)/2-(Number(canvas.dataset.graphFocusX)||0)*graphZoom-120,y:(sc.clientHeight||600)/2-(Number(canvas.dataset.graphFocusY)||0)*graphZoom-120}:{x:0,y:0};if(raw<.30)toast('全圖太大，已切到可閱讀比例；使用 WASD／方向鍵平移。');}
    else if(mode==='width'){graphZoom=Math.max(.08,Math.min(8,(sc.clientWidth||1100)/Number(canvas.dataset.graphWidth||1400)));graphPan={x:0,y:0};}
    else {const now=Number(canvas.style.zoom)||1,r=canvas.getBoundingClientRect(),v=sc.getBoundingClientRect(),point=anchor||{x:v.left+sc.clientWidth/2,y:v.top+sc.clientHeight/2};graphZoom=Math.max(.08,Math.min(8,typeof mode==='number'?mode:mode==='in'?now*1.2:mode==='out'?now/1.2:1));graphPan.x+=(point.x-r.left)*(1-graphZoom/now);graphPan.y+=(point.y-r.top)*(1-graphZoom/now);}
    applyGraphZoom();
  }
  function graphRender(){const scroll=$('.wb-canvas-scroll',shell),x=scroll?.scrollLeft||0,y=scroll?.scrollTop||0;render();const next=$('.wb-canvas-scroll',shell);if(next){next.scrollLeft=x;next.scrollTop=y;}}
  function presentDrawing(){
    const presentation=window.WIUPresentation;
    if(presentation?.isOpen()){presentation.fit();return true;}
    const nativeDialog=['quickHelp','rtlImportBackdrop','r74-find'].some(id=>{const panel=document.getElementById(id);return panel&&!panel.hidden;});
    if(dialog.open||nativeDialog||window.WIUManualOpen||tourStep>=0){toast('請先套用或關閉目前視窗，再按 F5 看圖。');return false;}
    if(!presentation){toast('看圖模式尚未就緒，請稍後再按 F5。');return false;}
    if(window.WIUBridge?.prepareSave?.()===false)return false;
    const active=document.activeElement;
    if(currentView==='assembly'&&active?.dataset.wireName&&!active.readOnly&&!applyWireField(active))return false;
    document.activeElement?.blur();
    try{
      if(currentView==='diagram')return presentation.open(null,{returnFocus:document.getElementById('canvas'),label:W.moduleOf(project,activeModule).name+' 介面看圖模式'});
      const scene=window.WIUTopScene.peek(project)||window.WIUTopScene.create(project,{fast:true});
      return presentation.open(scene,{returnFocus:$('.wb-canvas-scroll',shell),label:project.top+' TOP 接線看圖模式'});
    }catch(error){toast('看圖模式無法開啟，'+error.message);return false;}
  }
  function refreshGraphConnection(){
    const canvas=$('.wb-canvas',shell);if(!canvas)return;
    const G=window.WIUGraphWiring,ends=G.endpoints(project),byKey=new Map(ends.map(e=>[e.key,e]));
    const chosen=byKey.get(graphStart);
    canvas.classList.toggle('r89-connect-mode',graphConnectMode);
    for(const button of $$('[data-action="wb-pin"]',canvas)){
      const end=byKey.get(button.dataset.id),selected=!!end&&end.key===graphStart;
      const compatible=!!(chosen&&end&&!G.compatibility(chosen,end));
      button.classList.toggle('is-selected',selected);
      button.classList.toggle('is-compatible',!selected&&compatible);
      button.classList.toggle('is-incompatible',!!chosen&&!selected&&!compatible);
      button.setAttribute('aria-pressed',String(selected));
    }
    const mode=$('[data-action="graph-connect-mode"]',shell);
    if(mode){mode.setAttribute('aria-pressed',String(graphConnectMode));mode.textContent=graphConnectMode?'結束接線':'接線模式';}
    const status=$('.r82-status',shell);
    if(status)status.innerHTML=V.connectionStatus(ends,graphStart,graphConnectMode,!!project.workbook.graphAutoR99?.pendingRouting);
    applyGraphNetFocus();
  }
  function finishGraphConnection(){
    graphStart='';
    if(graphQuickConnect)graphConnectMode=false;
    graphQuickConnect=false;
  }
  function inspectedNet(end){
    const expr=end.top?end.net.name:end.expr?.trim();
    return project.nets.find(n=>n.name===expr)||project.nets.find(n=>expr?.startsWith(n.name+'['));
  }
  function graphPin(key,event,wirePad=false){
    const G=window.WIUGraphWiring,ends=G.endpoints(project),end=ends.find(e=>e.key===key);if(!end)return;
    if(wirePad&&!graphConnectMode&&!event?.ctrlKey&&!event?.metaKey){
      graphQuickConnect=true;
      graphConnectMode=true;
    }
    if(!graphConnectMode){
      // Inspect a connected pin as its net; the connection workflow only starts on request.
      const expr=end.top?end.net.name:end.expr?.trim(),net=inspectedNet(end);
      const object={kind:'pin',id:key,projectId:project.workbook.projectId,net:net?.name||''};
      if(net)selectGraphNet(net.name,!!(event?.ctrlKey||event?.metaKey),object);
      else{graphObject=object;graphNetFocus.clear();graphDirectNetFocus.clear();graphGroupFocus.clear();graphPinHint=end.label+' · '+(expr?'常數／運算式：'+expr:'尚未接線');applyGraphNetFocus();}
      return;
    }
    clearGraphNetFocus();
    if(graphStart===key){finishGraphConnection();refreshGraphConnection();return;}
    if(!ends.some(e=>e.key===graphStart)){graphStart=key;refreshGraphConnection();return;}
    try{const plan=G.plan(project,graphStart,key),before=JSON.stringify(project),apply=()=>{if(JSON.stringify(project)!==before)throw Error('專案已變更，請重新接線');finishGraphConnection();commit(()=>{project=plan.project;project.orgEdited=true;},plan.changed?'已接線：'+plan.label+' · Ctrl+Z 復原':'這兩端已連接');dialog.close();};
      if(plan.replacements.length)openDialog('取代既有接線？','<p>'+esc(plan.label)+'<\/p>'+plan.replacements.map(r=>'<p><b>'+esc(r.label)+'<\/b><br>'+esc(r.before||'刻意不接 NC')+' → '+esc(r.after)+'<\/p>').join(''),'取代接線',apply);else apply();
    }catch(e){toast(e.message);}
  }
  function graphPortMove(id,side,index){const sc=$('.wb-canvas-scroll',shell),x=sc?.scrollLeft||0,y=sc?.scrollTop||0;commit(()=>window.WIUGraphLayout.moveTop(project,id,side,index),'已更新 Top 介面排列；接線不變');const next=$('.wb-canvas-scroll',shell);if(next){next.scrollLeft=x;next.scrollTop=y;}}
  function graphPortStep(id,action){const sides=window.WIUGraphLayout.topPorts(project),side=['left','right'].find(k=>sides[k].some(p=>p?.id===id));if(!side)return;const index=sides[side].findIndex(p=>p?.id===id);graphPortMove(id,action==='flip'?(side==='left'?'right':'left'):side,action==='flip'?sides[side==='left'?'right':'left'].length:index+(action==='up'?-1:1));}

  const tourStops=[['專案與模組頁','左邊每一頁是一個模組定義。相同 RTL 可以在 Top 放入多個 instances。','.wb-rail'],['介面圖','開啟模組頁設計 input、output 與位寬；畫好的模組可直接放入 Top。','.wb-rail'],['Top 接線圖','點選接腳連到另一端，或引出為 Top port、設定常數與刻意不接 NC。','.a-panel'],['即時 RTL','右上方 RTL 預覽可展開或收合目前 Top 的 RTL。','.r69-stagebar'],['保存與下載','專案檔保存全部編輯資料；公司工作包提供目前設計所需的 org、RTL、cfg、defines 與腳本。','.r69-stagebar']];
  function showTour(){if(tourStep<0){tourReturn=workspace();tourStep=0;go('graph');}const s=tourStops[tourStep];document.querySelectorAll('.wb-tour-target').forEach(x=>x.classList.remove('wb-tour-target'));document.querySelector(s[2])?.classList.add('wb-tour-target');coach.hidden=false;coach.innerHTML='<small>快速導覽 '+(tourStep+1)+' / '+tourStops.length+'<\/small><h3>'+s[0]+'<\/h3><p>'+s[1]+'<\/p><div><button data-action="wb-tour-prev" '+(!tourStep?'disabled':'')+'>上一步<\/button><button class="a-primary" data-action="wb-tour-next">'+(tourStep===tourStops.length-1?'完成':'下一步')+'<\/button><button data-action="wb-tour-close">離開<\/button><\/div>';}
  function closeTour(){coach.hidden=true;document.querySelectorAll('.wb-tour-target').forEach(x=>x.classList.remove('wb-tour-target'));tourStep=-1;const ws=tourReturn;tourReturn=null;if(ws)restoreWorkspace(ws);}

  function toast(msg){document.getElementById('toast')?.classList.remove('show');toastEl.textContent=msg;toastEl.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.hidden=true,6500);}
  function safe(fn){const report=e=>{if(dialog.open){const box=$('#a-dialog-error',dialog);if(box){box.textContent=e.message||String(e);box.hidden=false;}}toast(e.message||String(e));};try{const result=fn();return result?.then?result.catch(report):result;}catch(e){report(e);}}

  function dirty(){return JSON.stringify(project)!==saved;}
  function saveRecord(){const id=project.workbook?.projectId||'initial';if(!saveRecords.has(id))saveRecords.set(id,{draftStatus:'idle',draftAt:null,downloadAt:null,downloadName:null});return saveRecords.get(id);}
  function saveState(){for(const [key,d] of fieldDrafts)if(d.projectId!==project.workbook.projectId||!R119.dirtyField(d.element))fieldDrafts.delete(key);if(!pendingField||!fieldDrafts.has(pendingField.key))pendingField=[...fieldDrafts.values()].at(-1)||null;const r=saveRecord();return {...r,practice:sessionKind==='practice',changedSinceDownload:dirty(),pendingEdit:pendingField?{label:pendingField.label,value:pendingField.element?.value||''}:null};}
  function saveStatusText(state=saveState()){const parts=[];if(state.pendingEdit)parts.push('欄位待套用');parts.push(state.practice?'範例練習':state.draftStatus==='failed'?'草稿暫存失敗':state.draftStatus==='pending'?'草稿暫存中':state.draftStatus==='saved'&&state.draftAt?'草稿已暫存':'草稿尚未暫存');parts.push(state.downloadAt?(state.changedSinceDownload?'下載後有修改':'下載已送出'):(state.practice?'尚未另存':'尚未下載專案'));return parts.join(' · ');}
  function refreshSaveStatus(state=saveState()){const status=$('.r118-save-status',switchbar);if(!status)return;status.textContent=saveStatusText(state);status.dataset.state=state.draftStatus==='failed'?'failed':state.pendingEdit?'editing':state.draftStatus||'idle';const detail=[];if(state.pendingEdit)detail.push(state.pendingEdit.label+'：Enter／Tab 套用，Esc 取消');if(state.draftStatus==='failed')detail.push('最新修改尚未成功暫存；請修正待套用欄位並下載專案保留修改');else if(state.draftStatus==='pending')detail.push('正在等待本機草稿寫入');if(state.draftAt)detail.push('上次成功暫存：'+state.draftAt);if(state.downloadAt)detail.push('專案下載已送出：'+state.downloadName+'（'+state.downloadAt+'）；請在裝置下載列表確認');else detail.push('本機草稿與下載專案分開保存');status.title=detail.join('\n');}
  window.addEventListener('wiu-status-change',e=>refreshSaveStatus(e.detail||saveState()));
  function notifySaveState(){refreshSaveStatus();window.dispatchEvent(new CustomEvent('wiu-status-change',{detail:saveState()}));}
  function writeDraft(){if(sessionKind==='practice')return;const r=saveRecord();try{const ws=workspace(),previous=localStorage.getItem(key),old=previous?JSON.parse(previous):null;if(old&&JSON.stringify(old.project)===JSON.stringify(project)&&JSON.stringify(old.workspace)===JSON.stringify(ws)){r.draftStatus='saved';r.draftAt=old.at||r.draftAt;notifySaveState();return;}const at=new Date().toISOString();localStorage.setItem(key,JSON.stringify({project:window.WIUTopScene.withDrawingSnapshot(project),workspace:ws,at}));r.draftStatus='saved';r.draftAt=at;notifySaveState();}catch{r.draftStatus='failed';notifySaveState();toast('本機暫存失敗；請下載專案 JSON 保留已套用的修改。');}}
  function stash(){clearTimeout(saveTimer);if(sessionKind==='practice')return;saveRecord().draftStatus='pending';notifySaveState();saveTimer=setTimeout(writeDraft,450);}
  const historyScope=()=>currentView==='diagram'?activeModule:'top';
  const historyIndex=list=>HF.historyEntry(list,historyScope())?.index??-1;
  const historyCan=list=>historyIndex(list)>=0;
  function historyState(){const describe=list=>{const item=HF.historyEntry(list,historyScope());if(!item)return null;const e=item.entry;return {label:e.label||'修改設計',scope:HF.scopeName(project,e.scope),scopeId:e.scope,at:e.at||null};};return {scope:HF.scopeName(project,historyScope()),scopeId:historyScope(),undo:describe(past),redo:describe(future)};}
  function remember(before,options={}){const after=JSON.stringify(project);if(before===after)return;const old=JSON.parse(before),structural=old.workbook?.projectId!==project.workbook?.projectId||JSON.stringify(old.modules.map(m=>m.id))!==JSON.stringify(project.modules.map(m=>m.id)),scope=HF.actionScope(old,project,historyScope(),options.scope);past.push({scope,label:options.label||HF.historyLabel(old,project,scope),at:new Date().toISOString(),before,after,patch:window.WIUHistory.changes(old,project)});if(past.length>100)past.shift();future=scope==='project'?[]:future.filter(e=>e.scope!==scope&&e.scope!=='project');}
  function openHistory(){const state=historyState(),rows=past.slice(-15).reverse();openDialog('復原與重做','<p>目前範圍：<b>'+esc(state.scope)+'</b>。跨模組操作標示「整個專案」；相依變更會保護原資料，不會強制覆蓋。</p><div class="a-actions"><button data-action="history-undo" '+(!state.undo?'disabled':'')+'>復原'+(state.undo?'：'+esc(state.undo.label):'')+'</button><button data-action="history-redo" '+(!state.redo?'disabled':'')+'>重做'+(state.redo?'：'+esc(state.redo.label):'')+'</button></div><ol class="r118-history-list">'+rows.map(e=>'<li><b>'+esc(e.label||'修改設計')+'</b><small>'+esc(HF.scopeName(project,e.scope))+(e.scope!==historyScope()&&e.scope!=='project'?' · 切換至該頁可復原':'')+'</small></li>').join('')+'</ol>'+(!rows.length?'<p>尚無已套用的修改。</p>':''));}
  function commit(fn,msg,historyOptions){
    const before=JSON.stringify(project),previous=JSON.parse(before);
    try{
      fn();
      project=W.normalize(project,previous);
      if(!graphNeedsPrepare)window.WIUTopScene.deferConnections(previous,project);
      // Record graph capture in the same action as a source/port edit, so Undo
      // restores routing metadata as well as the renamed RTL and connections.
      // Editing a table must not run the hidden Top router. It can take minutes
      // on a dense design. Preserve saved positions; route when the graph opens.
      if(!graphNeedsPrepare&&window.WIUTopScene.peek(project)&&!window.WIUTopScene.peek(project).previewOnly)project.workbook.graphAutoR99=window.WIUTopScene.capture(project);
    }catch(e){project=previous;throw e;}
    if(before!==JSON.stringify(project)){
      remember(before,historyOptions||{});stash();
      if(L.isLearning(project)&&L.tasks(project).some(t=>t.id===lessonTask&&t.done))lessonTask='';
    }
    if(historyOptions?.deferRender){}else if(nameCommitQuiet){nameRefreshPending=true;}else if(quietEdit)refreshMeta();else render();
    if(msg)toast(msg);
  }
  function reconcileHistoryView(){
    if(activeModule!=='top'&&!project.modules.some(m=>m.id===activeModule)){
      activeModule='top';lastDesignModule='top';lastDesignView='assembly';lastDesignTab='graph';tab='graph';view('assembly');
    }
    if(graphObject?.kind==='instance'&&!project.instances.some(i=>i.id===graphObject.id))graphObject=null;
  }
  function undo(){saveState();if(pendingField){toast('目前正在輸入：Ctrl+Z 先復原文字；Enter 套用或 Esc 取消後再復原設計。');return;}const index=historyIndex(past);if(index<0)return;const entry=past[index];let next;try{next=window.WIUHistory.apply(project,entry,true);}catch(e){toast(e.message);return;}past.splice(index,1);future.push(entry);project=W.normalize(next);reconcileHistorySelection();reconcileHistoryView();stash();render();refreshSheet();showHistoryEffect(entry,true);toast('已復原：'+entry.label+'。');}
  function redo(){saveState();if(pendingField){toast('請先 Enter 套用或 Esc 取消目前輸入，再重做設計。');return;}const index=historyIndex(future);if(index<0)return;const entry=future[index];let next;try{next=window.WIUHistory.apply(project,entry,false);}catch(e){toast(e.message);return;}future.splice(index,1);past.push(entry);project=W.normalize(next);reconcileHistorySelection();reconcileHistoryView();stash();render();refreshSheet();showHistoryEffect(entry,false);toast('已重做：'+entry.label+'。');}

  function asciiJson(value){return JSON.stringify(value,null,2).replace(/[\u007f-\uffff]/g,ch=>'\\u'+ch.charCodeAt(0).toString(16).padStart(4,'0'));}
  function download(name,text,type='text/plain'){const bytes=typeof text==='string'?new TextEncoder().encode(text):text;recentDownload={name,data:text,type,bytes:bytes.byteLength??bytes.length??0,text:typeof text==='string'?text:/\.vbs$/i.test(name)&&text instanceof Uint8Array?new TextDecoder('utf-16le').decode(text.subarray(2)):null};const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);renderWorkbook();}
  function filename(){return C.validName(project.top)?project.top:'wrapper_top';}
  function view(v){if(v!=='assembly'||tab!=='graph')pauseGraph('navigation');if(v!=='assembly'||tab!=='graph')closeGraphFind();if(currentView==='diagram'&&v!=='diagram')sheetViews.set(project.workbook.projectId+'::'+activeModule,window.WIUBridge?.uiSnapshot());if(v!=='assembly'||tab!=='graph')finishGraphConnection();currentView=v;diagramBar.hidden=v!=='diagram';window.WIUAssemblyActive=v==='assembly';document.body.classList.toggle('a-assembly',v==='assembly');shell.hidden=v!=='assembly';$$('[data-view]',switchbar).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===v)));if(v==='diagram')window.__WSS_TEST__?.render();else requestAnimationFrame(applyGraphZoom);}

  const topReason=value=>C.validName(value.trim())?'':'Top 名稱需以英文字母或底線開頭，後面可用字母、數字、底線或 $；不可含減號或空白。例如 bad_name、mac_top。';
  function inlineTop(){const field=$('#a-top-name',switchbar),note=$('#r68-top-help',switchbar);if(!field||!note){document.body.classList.remove('r69-top-invalid');return;}const reason=topReason(field.value);note.textContent=reason;document.body.classList.toggle('r69-top-invalid',!!reason);if(!reason)field.classList.remove('r68-located');field.setAttribute('aria-invalid',String(!!reason));field.setAttribute('aria-describedby','r68-top-help');}
  function bindInlineDialog(){
    const field=$('#f-script-top',dialog)||$('#f-top-name',dialog);if(field){
      const note=document.createElement('p');note.className='r68-inline-error';note.id='r68-dialog-top-help';note.setAttribute('role','status');field.parentNode.append(note);field.setAttribute('aria-describedby',note.id);
      const update=()=>{const reason=topReason(field.value)||(project.modules.some(m=>m.name===field.value.trim())?'Top 名稱不能與子模組相同。請使用另一個名稱，例如 mac_top。':'');note.textContent=reason;field.setAttribute('aria-invalid',String(!!reason));const apply=$('[data-dialog="apply"]',dialog);if(apply){apply.disabled=!!reason;apply.title=reason?'先修正 Top 名稱欄位':'預覽目前設定';}};
      field.addEventListener('input',update);update();
    }
    for(const id of ['f-script-python','f-script-gen-top']){const field=$('#'+id,dialog);if(!field)continue;const note=document.createElement('p');note.className='a-hint';field.parentNode.append(note);const update=()=>{note.textContent=/\s+-\w/.test(field.value)?'這看起來包含參數。若你要執行 python -u，請將 -u 移到參數欄；若整串確實是檔案路徑，可原樣保留，Linux 會檢查檔案。':'';};field.addEventListener('input',update);update();}
  }
  function disabledReasons(container){

    const reasons={'download-output':'請修正本頁列出的錯誤；按「前往修正」定位欄位',undo:'尚無可復原的修改',redo:'尚無可重做的修改','bundle-download':'先修正頁面列出的錯誤；按「定位接線問題」或「修改執行設定」','linux-transfer':'先修正頁面列出的錯誤，才能建立可交付檔案','bundle-readme':'先修正頁面列出的錯誤，才能產生與工作包一致的 README','bundle-stub-edit':'尚無 Top output；請到「對外接腳」建立輸出','bundle-cfg-import':'尚無 Top output；請到「對外接腳」建立輸出'};
    for(const el of $$('button',container)){if(!el.disabled)continue;const reason=reasons[el.dataset.action]||el.title||el.getAttribute('title');if(reason){el.setAttribute('title',reason);el.setAttribute('aria-label',el.textContent+'：'+reason);}}
  }

  let dialogGeneration=0,dialogBusy=false;
  function openDialog(title,body,actionLabel,action){dialogGeneration++;dialogBusy=false;if(!dialog.open)dialogOpener=document.activeElement;modalAction=action||null;window.WIUAssemblyDialogOpen=true;dialog.innerHTML='<div class="a-dialog-head"><h2>'+esc(title)+'<\/h2><button data-dialog="close" aria-label="關閉視窗">✕<\/button><\/div><div class="a-dialog-content">'+body+'<div id="a-dialog-error" class="a-note a-warn" role="alert" hidden><\/div><\/div><div class="a-dialog-foot"><button data-dialog="close">關閉<\/button>'+(actionLabel?'<button class="a-primary" data-dialog="apply">'+esc(actionLabel)+'<\/button>':'')+'<\/div>';bindInlineDialog();disabledReasons(dialog);if(!dialog.open)dialog.showModal();$('.a-dialog-content',dialog).scrollTop=0;($('input',dialog)||$('textarea',dialog)||$('select',dialog)||$('[data-dialog="apply"]',dialog)||$('[data-dialog="close"]',dialog))?.focus({preventScroll:true});$('.a-dialog-content',dialog).scrollTop=0;}
  dialog.addEventListener('close',()=>{if(dialog.open)return;window.WIUAssemblyDialogOpen=!!window.WIUManualOpen;if(focusTaskAfterClose){focusTaskAfterClose=false;focusStep();}else if(dialogOpener?.isConnected)dialogOpener.focus({preventScroll:true});});
  function readme(){openDialog('README · 先完成第一個 Top',document.getElementById('a-readme-content').innerHTML);}
  function confirmAction(title,body,actionLabel,fn){openDialog(title,body,actionLabel,()=>{dialog.close();fn();});}
  let issueCacheKey='',issueCache=new Map();
  function issues(target='all'){
    const {workbook,...electrical}=project,key=JSON.stringify(electrical);
    if(key!==issueCacheKey){issueCacheKey=key;issueCache.clear();}
    if(!issueCache.has(target))try{issueCache.set(target,C.validate(project,{target}));}catch(e){issueCache.set(target,[{severity:'error',code:'INVALID_MODEL',message:e.message}]);}
    return issueCache.get(target);
  }
  function badge(text,kind=''){return '<span class="a-badge '+(kind?'a-'+kind:'')+'">'+esc(text)+'<\/span>';}
  const issueHelp={MODULE_FILENAME:'這個 module 的來源檔名不同。請使用 工作包 下載，內含 gen_top 所需的同名副本；README 會說明，編譯只選一份。',MODULE_FILENAME_ALIAS:'完整工具包會建立模組同名檔案別名；若只下載 org，請自行準備這個別名。',UNCONFIGURED_PIN:'這個接腳尚未設定，不能把省略當成空接。請選接線、固定值或刻意不接 NC；留空會在 org 明寫 conn ""。',UNDRIVEN_NET:'這條線有接收端，但沒有完整的訊號來源。檢查 Top input、子模組 output 或 assign。',WIDTH_MISMATCH:'兩端位寬不同。請改正宣告，或明確指定 bus 切片。',MULTIPLE_DRIVERS:'同一段線被多個來源驅動。請檢查 output 是否接在一起。',CONNECTION_EXPRESSION:'連線名稱或運算式無法使用。先確認訊號已宣告，再檢查切片與語法。',MISSING_MODULE:'缺少子模組介面。請匯入對應 RTL。',MISSING_PORT:'原有 pin 已不存在。請核對更新後的子模組介面。',OUTPUT_LVALUE:'子模組的輸出需要接到線，不能接固定值或運算結果。',TOP_NAME:'請在專案 → 修改 Top 名稱填入有效名稱。',NET_NAME:'請修正線名：使用英文字母、數字或底線，且不能以數字開頭。',NET_RANGE:'請確認位寬格式，例如 [7:0]；純量不需要填範圍。',OPEN_INPUT:'這是刻意懸空的輸入。請確認設計允許浮接；通常應接外部訊號或明確閒置值。',UNUSED_DRIVER:'這個來源沒有接收端。請確認是否漏接，或改為刻意不接 NC。',RAW_ACK_REQUIRED:'含有工具尚未理解的進階文字。請到進階 org 核對後，再選候選檔匯出。',IMPORT_ACK_REQUIRED:'匯入檔仍有待確認的內容。請先補齊子模組或處理原始指令。'};
  function resetFilters(){if(graphTableOrigin)delete graphTableOrigin.pinKey;filter='';instanceFilter='';onlyUnbound=false;selected.clear();}
  function workflow(){const rows=A.pinRows(project),pending=rows.filter(r=>r.expr==null).length,errors=issues().filter(i=>i.severity==='error').length;
    const stage=!project.instances.length?0:pending?1:errors?2:3;
    return '<div class="a-workflow" aria-label="組裝流程">'+['匯入與建立','完成接線','檢查問題','匯出與保存'].map((s,i)=>'<button data-action="workflow" data-stage="'+i+'" '+(i===stage?'aria-current="step"':'')+'><span>'+ (i<stage?'✓':i+1)+'<\/span>'+s+'<\/button>').join('')+'<\/div>';
  }
  function learningBanner(){
    if(tab==='lesson')return '';
    if(flowUI&&project.flow?.tutorial)return flowUI.banner();
    return '';
  }
  function startLearning(){startTemplate();}
  function focusStep(){const el=$('.fg-screen h2',shell)||$('.a-panel h2',shell);el?.setAttribute('tabindex','-1');el?.focus({preventScroll:true});$('.a-panel',shell)?.scrollTo?.(0,0);}
  function rtlDock(){
    if(!rtlOpen)return '';
    let code='',note='展開查看目前的 Top RTL';
    if(rtlOpen){try{code=C.renderVerilog(project);const n=issues('verilog').filter(i=>i.severity==='error').length;note=n?'設計尚未完成 · '+n+' 項待處理；這是即時預覽':'目前組態的 RTL 預覽 · 尚未執行編譯器';}catch(e){note='目前無法產生預覽：'+e.message;}}
    return '<section class="fg-rtl-dock'+(rtlOpen?' is-open':'')+'" aria-label="即時 RTL 預覽"><button class="fg-rtl-handle" data-action="rtl-preview-toggle" aria-expanded="'+rtlOpen+'" aria-controls="fg-rtl-content"><span aria-hidden="true">'+(rtlOpen?'▾':'▸')+'<\/span><strong>RTL 預覽<\/strong><code>'+esc(filename())+'.v<\/code><span>'+ (rtlOpen?'收合':'展開')+'<\/span><\/button>'+(rtlOpen?'<div id="fg-rtl-content"><div class="fg-rtl-meta"><span>'+esc(note)+'<\/span><button data-action="rtl-preview-copy">複製預覽<\/button><\/div><pre class="fg-rtl-code" tabindex="0">'+esc(code)+'<\/pre><\/div>':'<div id="fg-rtl-content" hidden><\/div>')+'<\/section>';
  }
  function refreshRtlDock(){const dock=$('.fg-rtl-dock',shell);if(dock){const box=document.createElement('div');box.innerHTML=rtlDock();dock.innerHTML=box.querySelector('.fg-rtl-dock').innerHTML;}}
  function guideDownload(){
    const state=window.WIUFocusGuide.current(project);
    if(!L.tasks(project).at(-1).done||state.blocked)throw Error('請先完成導讀接線並修正檢查項目。');
    const used=new Set(project.instances.map(i=>i.module));
    const fixtures=L.fixtures();
    if([...used].some(name=>!fixtures.some(f=>f.name===name)))throw Error('設計已加入其他模組，請到「取得成果」下載完整公司工具包。');
    const sourceNames=new Set(fixtures.map(f=>f.filename));
    const sources=(project.rtlSources||[]).filter(f=>sourceNames.has(f.name));
    if(sources.length!==2)throw Error('範例的子模組原文不完整。請重新匯入來源，或使用公司工具包檢查。');
    if(fixtures.some(f=>sources.find(s=>s.name===f.filename)?.text!==f.source))throw Error('子模組已修改，請使用「取得成果」的公司工具包帶齊目前來源。');
    const B=window.WIUBundle,cfg={...B.normalize(project.bundleConfig),includeReferences:false,dualMode:true};
    const list=K.files(project,cfg);
    download(filename()+'-design.zip',B.zip(list),'application/zip');
    toast('已下載工作包：包含 FPGA／ASIC 雙分支 RTL、子模組、org 與英文 README；附設定好的 C-shell 執行腳本。');
  }
  function constantForm(keys=selected,value="1'b0"){const rows=selectedRows(keys);if(rows.some(r=>r.port.direction==='output'))throw Error('輸出不能接常數，請接到 net 或刻意不接 NC。');openDialog('接到固定值','<p>依接腳用途選擇閒置值。例如 ready 可能接 1；位寬要與接腳一致。可輸入已定義的數值巨集，例如 <code>`IDLE_VAL<\/code>；無值旗標不能當常數。<\/p><label>常數<input id="a-constant" value="'+esc(value)+'" spellcheck="false"><\/label>','預覽接線',()=>{const expr=$('#a-constant',dialog).value.trim();C.parseExpression(C.expandDefines(expr,project));changePlan('預覽常數接線',rows.map(r=>({instance:r.instance,port:r.port.name,expr})));});}
  function learningNext(button){
    const tasks=L.tasks(project),requested=button?.dataset?.id||lessonTask;
    const task=tasks.find(t=>t.id===requested)||tasks.find(t=>!t.done)||tasks[tasks.length-1];
    if(task.kind==='export'){tab='check';render();return;}
    if(!task.keys.length){toast('練習需要資料來源與接收模組各一份。請到「放入模組」補齊，或重新開始範例。');tab='modules';render();return;}
    const keys=new Set(task.keys);resetFilters();selected=keys;lessonTask=task.id;tab='lesson';render();
    if(task.kind==='net')newNetForm(task.direction,keys,{name:task.name,range:task.range});
    else if(task.kind==='constant')constantForm(keys,task.expr);
    else changePlan('確認 debug 不需要使用',selectedRows(keys).map(r=>({instance:r.instance,port:r.port.name,expr:''})));
  }
  function pairForm(key){const row=A.pinRows(project).find(r=>r.key===key);if(!row)return;const peers=A.pinRows(project).filter(r=>{if(r.key===key||!((r.port.direction==='input'&&row.port.direction==='output')||(r.port.direction==='output'&&row.port.direction==='input')))return false;try{return C.parseRange(effectiveRange(r),{}).width===C.parseRange(effectiveRange(row),{}).width;}catch{return false;}});if(!peers.length){openDialog('沒有同位寬的另一端','<p>目前沒有可直接連接的相反方向接腳。請先加入另一個 instance；若需要切片或拼接，可使用連線欄輸入運算式。<\/p>');return;}openDialog('把 '+row.instanceName+'.'+row.port.name+' 接到另一個 pin','<p>列出方向相反、位寬相同的接腳。下一步會一起建立命名線並連接兩端。<\/p><label>另一端<select id="a-peer">'+peers.map(r=>'<option value="'+esc(r.key)+'">'+esc(r.instanceName+'.'+r.port.name+' · '+r.port.direction+' · '+pinRange(r)+(r.expr!=null?' · 已有設定':''))+'<\/option>').join('')+'<\/select><\/label>','設定共用線名',()=>{const peer=peers.find(r=>r.key===$('#a-peer',dialog).value),out=row.port.direction==='output'?row:peer;const simple=out.expr&&project.nets.find(n=>n.name===out.expr);newNetForm(simple?.direction||'wire',new Set([key,peer.key]),{name:simple?.name||out.port.name,range:simple?.range??effectiveRange(out)});});}
  let liveEditBefore=null;
  let rowIssues=[];
  function pinStatus(row){const c=project.connections.find(c=>c.instance===row.instance&&c.port===row.port.name);const related=rowIssues.filter(i=>{if(i.code==='ORG_CUSTOM_INSTANCE')return false;if(i.ref?.type==='connection')return i.ref.id===c?.id;if(i.ref?.type==='net'&&row.expr){const n=project.nets.find(n=>n.id===i.ref.id);return n&&new RegExp('(^|[^A-Za-z0-9_$])'+n.name.replace(/[$]/g,'\\$&')+'([^A-Za-z0-9_$]|$)').test(row.expr);}return i.ref?.type==='instance'&&i.ref.id===row.instance&&i.code!=='UNCONFIGURED_PIN';});const problem=related.find(i=>i.severity==='error')||related[0];if(row.expr==null)return badge('待設定','warning');if(problem)return badge(problem.severity==='error'?'需修正':'請確認',problem.severity==='error'?'error':'warning')+'<span class="a-pin-problem" title="'+esc(problem.message)+'">'+esc(problem.message)+'<\/span>';return badge(row.expr===''?'刻意不接 NC':'已設定','good');}
  function connectionChooser(key){const row=A.pinRows(project).find(r=>r.key===key);if(!row)return;if(graphStart){finishGraphConnection();refreshGraphConnection();}openDialog('設定 '+row.instanceName+'.'+row.port.name,'<p><b>'+esc(row.port.direction.toUpperCase())+'<\/b> · '+esc(pinRange(row))+'。這個訊號要從哪裡來，或送到哪裡？<\/p><div class="a-choice-grid">'+[['expression','接到 net／切片／拼接','在此選擇 net 或輸入接線式，不必切到表格。'],['peer','接到另一個 pin','選另一端，工具替你建立共用的命名線。'],['external','接到 Top port','讓這個接腳出現在最外層介面。'],['internal','接到內部 net','與另一個子模組相接，或接到已命名的線。'],...(row.port.direction==='output'?[]:[['constant','接到固定值','依用途指定 0、1 或有位寬的常數。']]),['open',row.port.direction==='input'?'刻意浮接輸入…':'刻意不接 NC',row.port.direction==='input'?'需確認設計允許浮接；不會替你選閒置值。':'org 明寫 conn ""，RTL 輸出 .pin()，不提升成 Top port。']].map(([kind,title,desc])=>'<button data-action="connection-choice" data-kind="'+kind+'" data-id="'+esc(key)+'"><b>'+title+'<\/b><span>'+desc+'<\/span><\/button>').join('')+'<\/div><p class="a-hint">Bus 切片／拼接請選「接到 net／切片／拼接」，例如 data_link[7:0]。<\/p>');}
  function orderedIssues(){return issues().filter(i=>i.ref).sort((a,b)=>Number(a.severity!=='error')-Number(b.severity!=='error'));}
  function refreshIssueQueue(){
    issueQueue.hidden=!issueQueueOpen||tab==='home'||!!window.WIUManualOpen;if(issueQueue.hidden)return;
    const list=orderedIssues(),previous=issueQueueKey,index=list.findIndex(i=>HF.issueKey(i)===previous);
    if(index>=0)issueQueueIndex=index;else issueQueueIndex=Math.min(issueQueueIndex,Math.max(0,list.length-1));
    const current=list[issueQueueIndex];issueQueueKey=current?HF.issueKey(current):'';
    const done=previous&&index<0?'<p class="r118-issue-resolved">上一項已不在問題清單，請繼續核對下一項。</p>':'';
    issueQueue.innerHTML='<header><b>Top 接線問題 · '+list.length+'</b><button type="button" data-issue-queue="close" aria-label="收合問題清單">×</button></header>'+done+(current?'<p class="r118-issue-position">'+(issueQueueIndex+1)+' / '+list.length+' · '+(current.severity==='error'?'需修正':'提醒')+'</p><p class="r118-issue-message">'+esc(current.message)+'</p><div class="a-actions"><button type="button" data-issue-queue="prev" '+(issueQueueIndex===0?'disabled':'')+'>上一項</button><button type="button" data-issue-queue="locate">定位</button><button type="button" data-issue-queue="next" '+(issueQueueIndex>=list.length-1?'disabled':'')+'>下一項</button></div>':'<p>目前沒有可定位的接線問題。</p>')+'<button type="button" data-issue-queue="all">完整檢查</button>';
  }
  function toggleIssueQueue(force){issueQueueOpen=typeof force==='boolean'?force:!issueQueueOpen;refreshIssueQueue();return issueQueueOpen;}
  function locateQueuedIssue(delta=0){const list=orderedIssues();if(!list.length){refreshIssueQueue();return;}issueQueueIndex=Math.max(0,Math.min(list.length-1,issueQueueIndex+delta));const issue=list[issueQueueIndex];issueQueueKey=HF.issueKey(issue);issueQueueOpen=true;actions['issue-locate']({dataset:{ref:JSON.stringify(issue.ref),issueKey:issueQueueKey}});refreshIssueQueue();}
  issueQueue.addEventListener('click',e=>safe(()=>{const action=e.target.closest('[data-issue-queue]')?.dataset.issueQueue;if(action==='close')toggleIssueQueue(false);else if(action==='all')go('check');else if(action)locateQueuedIssue(action==='prev'?-1:action==='next'?1:0);}));
  function issueList(list){return window.WIUIssueReview.render(project,list,{help:issueHelp,issueKey:HF.issueKey});}
  function refreshMeta(){
    rowIssues=issues();inlineTop();
    refreshSaveStatus();
    const counter=$('.a-counter',shell);
    if(counter)counter.innerHTML='<button data-tab="check">'+badge(rowIssues.filter(i=>i.severity==='error').length+' 項待檢查')+'<\/button>';
    const foot=$('.a-footer span',shell);if(foot)foot.textContent=project.top+'.v / '+project.top+'.v.org';
    document.title='WrapItfUp '+VERSION+' · '+project.top;stagebar.innerHTML=stageNav();const hs=historyState();for(const action of ['undo','redo']){const entry=hs[action],button=$('[data-action="'+action+'"]',switchbar);if(button){const verb=action==='undo'?'復原':'重做';button.disabled=!entry;button.setAttribute('aria-label',verb);button.setAttribute('title',entry?verb+'：'+entry.label+' · '+entry.scope:'尚無可'+verb+'的修改');}}disabledReasons(switchbar);
    const un=$('[data-action="undo"]',shell),re=$('[data-action="redo"]',shell);if(un)un.disabled=!historyCan(past);if(re)re.disabled=!historyCan(future);
    const byKey=new Map(A.pinRows(project).map(r=>[r.key,r]));
    for(const input of $$('[data-connection]',shell)){const r=byKey.get(input.dataset.connection);if(r){input.closest('tr').children[4].innerHTML=pinStatus(r);const c=project.connections.find(c=>c.instance===r.instance&&c.port===r.port.name);const bad=rowIssues.some(i=>i.severity==='error'&&(i.ref?.id===c?.id||i.code==='UNCONFIGURED_PIN'&&i.ref?.id===r.instance&&i.ref?.port===r.port.name));input.setAttribute('aria-invalid',String(bad));if(!bad)input.classList.remove('r68-located');}}
    for(const el of $$('[data-net],[data-assign]',shell)){const type=el.dataset.net?'net':'assign',id=el.dataset.net||el.dataset.assign;const bad=rowIssues.some(i=>i.severity==='error'&&i.ref?.type===type&&i.ref.id===id&&(!i.ref.field||i.ref.field===el.dataset.field));el.setAttribute('aria-invalid',String(bad));if(!bad)el.classList.remove('r68-located');}
    refreshContext();
    refreshRtlDock();disabledReasons(shell);refreshIssueQueue();notifySaveState();
  }
  function refreshContext(){
    const snapshot=JSON.stringify(project);
    if(['export','bundle','check'].includes(tab)&&snapshot!==exportSnapshot){
      const panel=$('.a-panel',shell);if(!panel)return;const scroll=panel.scrollTop,previewOpen=$('.a-code-preview',panel)?.open;
      panel.innerHTML=renderPanel(A.pinRows(project),rowIssues)+stepFooter();panel.scrollTop=scroll;
      const preview=$('.a-code-preview',panel);if(preview)preview.open=!!previewOpen;exportSnapshot=snapshot;
    }
  }
  const labels={graph:'Top 結構與接線',home:'首頁',start:'建立設計',setup:'建立設計',modules:'放入模組',lesson:'第一個 Top',bundle:'RTL 與外部工具工作包',connections:'接腳與連線',defines:'條件與位寬',ports:'Top 對外接腳',nets:'內部接線',assigns:'訊號運算',advanced:'進階 org',check:'檢查設計',export:'取得成果',sources:'來源檔案',help:'說明中心'};
  function go(next){
    const back=tab==='connections'&&graphTableOrigin?.projectId===project.workbook.projectId?graphTableOrigin:null;
    if(tab==='connections'&&next!=='connections'){
      graphTableOrigin=null;
      if(back){filter=back.filter;instanceFilter=back.instanceFilter;onlyUnbound=back.onlyUnbound;selected=new Set(back.selected);connectionView=back.connectionView;focusedPin=back.focusedPin;}
    }
    window.WIUBridge?.finish();if(currentView==='diagram'){lastDesignView='diagram';lastDesignModule=activeModule;}else if(!['home','help','bundle','export','check','lesson'].includes(tab)){lastDesignView='assembly';lastDesignTab=tab;}if(dialog.open)focusTaskAfterClose=true;dialog.close();tab=next==='start'?'setup':next;if(!['home','help','bundle','export','check','lesson'].includes(tab))lastDesignTab=tab;if(tab!=='home'&&tab!=='help')priorWorkTab=tab;view('assembly');render();focusStep();
    if(back&&tab==='graph'){const sc=$('.wb-canvas-scroll',shell);if(sc){sc.scrollLeft=back.scrollX;sc.scrollTop=back.scrollY;}}
  }
  function stepFooter(){return '';}
  function render(){return window.WIUInteractionR128.paint('assembly',renderNow);}
  function renderNow(){saveState();const drafts=[...fieldDrafts.values()].map(d=>({...d,value:d.element.value,invalid:d.element.getAttribute('aria-invalid'),readonly:d.element.readOnly}));renderMain();for(const d of drafts){if(d.element.isConnected)continue;const next=$$('input,textarea,select').find(el=>window.WIUInteractionR128.key(el)===d.domKey);if(next){next.value=d.value;next.readOnly=d.readonly;if(d.invalid)next.setAttribute('aria-invalid',d.invalid);const saved=fieldDrafts.get(d.key);if(saved)saved.element=next;}} if(graphFindVisible())refreshGraphFind();else closeGraphFind();refreshIssueQueue();refreshSaveStatus();}
  function renderMain(){
    // r102: A Module Sheet edit must not reconstruct the hidden Top workspace.
    // Rendering that invisible scene is unnecessary for direction/comment edits;
    // the Top scene is refreshed when the user explicitly opens that tab.
    if(currentView==='diagram'){pauseGraph('navigation');renderWorkbook();return;}
    if(tab!=='graph')pauseGraph('navigation');
    const priorCanvas=currentView==='assembly'&&tab==='graph'&&lastPanel==='graph'?$('.wb-canvas',shell):null;
    const anchor=priorCanvas?.getBoundingClientRect?.(),scrollNodes=[];
    if(anchor){graphZoom=Number(priorCanvas.style.zoom)||graphZoom;for(let n=shell.parentElement;n;n=n.parentElement)scrollNodes.push([n,n.scrollLeft,n.scrollTop]);}
    renderWorkbook();
    if(tab==='start')tab='setup';
    rowIssues=issues();
    const oldScroll=lastPanel===tab?$('.a-panel',shell)?.scrollTop||0:0;
    const all=rowIssues,rows=A.pinRows(project),errors=all.filter(i=>i.severity==='error').length;
    const recovery=draft&&tab==='home'?'<section class="r119-recovery" aria-label="繼續本機草稿"><div><strong>'+esc(draft.project?.top||'未命名')+'</strong><small>'+esc(draft.at?new Date(draft.at).toLocaleString():'時間未記錄')+' · '+(draft.project?.modules?.length||0)+' 個模組 · '+(draft.project?.instances?.length||0)+' 顆 instances</small></div><button class="a-primary" data-action="restore">恢復草稿</button><button data-action="discard-draft">稍後再說</button></section>':'';
    shell.classList.toggle('ux-is-home',tab==='home');shell.classList.toggle('fg-home-mode',tab==='home');shell.classList.toggle('fg-guide-mode',tab==='lesson');shell.classList.toggle('fg-free-mode',tab!=='home'&&tab!=='lesson');
    document.title='WrapItfUp '+VERSION+(tab==='home'?' · Top Design Workspace':' · '+project.top);
    if(tab==='home'){shell.innerHTML=recovery+V.home(project,{example:isConnectionExample()});lastPanel=tab;return;}
    if(tab!=='help')priorWorkTab=tab;
    const guided=tab==='lesson',location=guided?'入門導讀':tab==='help'?'使用說明':'Top 工作區 / '+(labels[tab]||tab);
    shell.innerHTML=recovery+'<main class="a-main fg-main"><section class="a-panel ux-panel fg-panel" aria-label="'+esc(labels[tab]||tab)+'">'+(project.flow?.tutorial?learningBanner():'')+renderPanel(rows,all)+'<\/section><\/main>'+rtlDock();
    $('.a-panel',shell).scrollTop=oldScroll;exportSnapshot=JSON.stringify(project);lastPanel=tab;renderWorkbook();inlineTop();disabledReasons(shell);applyGraphZoom();applyGraphNetFocus();
    // Preserve the explicit viewport transform. DOM auto-scroll must not accumulate into graphPan.
    if(anchor)for(const [n,x,y] of scrollNodes){n.scrollLeft=x;n.scrollTop=y;}

  }
  function renderModuleWorkspace(){
    const topDown=project.entryRoute==='top-down';
    return E.heading('','放入模組',project.instances.length?'選左側 Top 接線圖，開始連接模組。':project.modules.length?'介面已讀入。按「增加份數」，把模組放進這個 Top。':topDown?'先放入暫代子模組；正式 RTL 完成後可再匯入替換。':'讀入子模組 RTL，網站會帶入接腳與位寬。')+
      '<div class="a-actions"><button '+(!project.modules.length?'class="a-primary" ':'')+'data-action="'+(topDown?'flow-module-interface':'import-rtl')+'">'+(topDown?'定義暫代子模組':'匯入子模組 RTL')+'<\/button><button data-action="'+(topDown?'import-rtl':'flow-module-interface')+'">'+(topDown?'匯入正式 RTL':'RTL 未完成？先定義介面')+'<\/button><\/div><h3>可用的模組 <small>'+project.modules.length+' 種<\/small><\/h3><div class="fg-module-list">'+renderModules()+'<\/div>'+(project.instances.length?'<details class="a-reference-details"><summary>已放入 Top · '+project.instances.length+' 份（查看名稱與參數）<\/summary><div class="fg-module-list">'+renderInstances()+'<\/div><\/details>':'');
  }
  function renderCheck(all){
    const nav='<nav class="r119-check-tabs" aria-label="檢查範圍">'+[['top','Top 接線'],['modules','模組介面'],['drawing','圖面幾何']].map(([id,label])=>'<button data-action="check-scope" data-id="'+id+'" aria-pressed="'+(checkScope===id)+'">'+label+'</button>').join('')+'</nav>';
    if(checkScope==='modules'){return nav+E.heading('','模組介面檢查','名稱、方向、預設位寬與解析結果；instance 覆寫及驅動請看 Top 接線。')+'<div class="r119-check-summary">'+project.modules.map(m=>{const problems=(m.issues||[]).filter(i=>i.severity==='error').map(i=>i.message),names=new Set(),ctx=C.resolveParameters(m,{},topContext());for(const p of m.ports){if(names.has(p.name)||!C.validName(p.name))problems.push(p.name+'：名稱重複或不合法');names.add(p.name);if(!['input','output','inout'].includes(p.direction))problems.push(p.name+'：方向無法辨識');try{C.parseRange(C.expandDefines(p.range,project),ctx.context);}catch(e){problems.push(p.name+'：'+e.message);}}problems.push(...ctx.errors.map(e=>e.message));return '<section class="a-card"><b>'+esc(m.name)+'</b><p>'+m.ports.length+' pins · '+(problems.length?problems.length+' 項待核對':'未發現介面結構錯誤')+'</p>'+problems.map(x=>'<p class="a-note a-warn">'+esc(x)+'</p>').join('')+'<button data-action="module-view" data-id="'+esc(m.name)+'">開啟介面</button></section>';}).join('')+'</div>'+(project.modules.length?'':'<p>尚未建立子模組。</p>');}
    if(checkScope==='drawing')return nav+E.heading('','圖面幾何檢查','檢查線距、轉角、交叉與 Block 安全距離；結果與電氣檢查分開。')+'<button class="a-primary" data-action="graph-crossing-review">執行並查看圖面檢查</button><button data-action="wb-graph">返回接線圖</button>';

    const errors=all.filter(i=>i.severity==='error'),warnings=all.filter(i=>i.severity!=='error');
    if(!project.instances.length)return nav+E.heading('','先放入要組裝的模組','目前還沒有 instance；建立設計後再檢查接線。')+'<button class="a-primary" data-tab="modules">前往放入模組 →<\/button>';
    return nav+E.heading('Top 接線結構',errors.length?'還有 '+errors.length+' 項需要處理':'Top 接線結構檢查通過',errors.length?'下表直接列出每個 instance、訊號、目前設定與問題原因；需要編輯時再按「前往修正」。':'現在可以選擇要下載的成果。')+
      '<div class="a-actions r69-review-next"><button '+(errors.length?'data-action="review-first-error"':'data-tab="bundle"')+' class="a-primary">'+(errors.length?'依序修正問題':'前往交付')+'<\/button><\/div><div class="ux-review-summary"><span>'+project.instances.length+' 個 instances<\/span><span>'+project.nets.filter(n=>n.direction!=='wire').length+' 個對外接腳<\/span><span>'+project.nets.filter(n=>n.direction==='wire').length+' 條內部線<\/span><\/div>'+issueList(errors)+(warnings.length?'<h3>'+warnings.length+' 項警告 · 可繼續操作<\/h3>'+issueList(warnings):'')+
      '<p class="a-hint">此處檢查宣告、位寬與驅動等結構問題，尚未執行 RTL 編譯器或公司 gen_top。<\/p>';
  }
  function renderModules(){return project.modules.map(m=>'<div class="a-card fg-module-row"><div><strong class="a-mono">'+esc(m.name)+'<\/strong><small>'+m.ports.length+' 個接腳 · 已放入 '+project.instances.filter(i=>i.module===m.name).length+' 份'+(m.placeholder?' · 暫代介面':'')+'<\/small><\/div><div class="a-actions"><button data-action="flow-instances" data-id="'+esc(m.name)+'">增加份數<\/button><button data-action="module-view" data-id="'+esc(m.name)+'">查看介面<\/button><details><summary>更多<\/summary><button data-action="instance-add" data-id="'+esc(m.name)+'">加入並自訂名稱<\/button><button data-action="module-delete" data-id="'+esc(m.name)+'">移除定義<\/button><\/details><\/div><\/div>').join('')||'<div class="a-empty-small">匯入後，這裡會列出可用的模組。<\/div>';}
  function renderInstances(){return project.instances.map(i=>'<div class="a-card"><strong class="a-mono">'+esc(i.name)+'<\/strong><small>'+esc(i.module)+'<\/small><div class="a-actions"><button data-action="instance-filter" data-id="'+esc(i.id)+'">連線<\/button><button data-action="instance-edit" data-id="'+esc(i.id)+'">設定<\/button><button data-action="instance-delete" data-id="'+esc(i.id)+'" aria-label="刪除 '+esc(i.name)+'">✕<\/button><\/div><\/div>').join('')||'<div class="a-empty-small">匯入後，按「加入 instance」建立實際子模組。<\/div>';}
  function renderPanel(rows,all){
    if(tab==='graph'){
      const scene=backgroundScene();
      return backgroundStatus(scene)+V.graph(project,graphStart,{scene,viewport:graphWindow(scene),artwork:graphArtwork,focus:graphFocus,groups:graphGroupPanel,connectMode:graphConnectMode});
    }
    if(tab==='setup')return flowUI.start();
    if(tab==='modules')return renderModuleWorkspace();
    if(tab==='help')return E.help(helpQuery);
    if(tab==='lesson')return L.isLearning(project)?window.WIUFocusGuide.render(project):E.heading('LEARN','先建立一個小範例','沿用原始兩個模組，逐步完成正常 Top、Empty 覆寫與公司工具包。','<button class="a-primary" data-action="learning-start">開始練習<\/button>');
    if(tab==='check')return renderCheck(all);
    if(tab==='bundle')return flowUI.bundle();
    if(tab==='defines')return '<div class="a-toolbar"><button data-tab="sources">來源檔案</button><button data-action="config-profiles">具名組態</button></div>'+defineUI.render();
    if(tab==='connections')return '<div class="r119-connections">'+renderConnections(rows)+'</div>';
    if(tab==='sources')return renderSources();
    if(tab==='ports'||tab==='nets')return renderNets(tab==='ports');
    if(tab==='assigns')return E.heading('SIGNAL EXPRESSIONS','訊號運算','用於反相、常數驅動、切片與簡單組合運算。')+'<div class="a-toolbar"><button class="a-primary" data-action="assign-add">＋ 新增運算<\/button><\/div><div class="a-tablebox"><table class="a-table"><thead><tr><th>目的訊號／切片<\/th><th>運算式<\/th><th><\/th><\/tr><\/thead><tbody>'+project.assigns.map(a=>'<tr><td><input data-assign="'+esc(a.id)+'" data-field="target" value="'+esc(a.target)+'" aria-label="Assign 目的"><\/td><td><input class="a-expr" data-assign="'+esc(a.id)+'" data-field="expr" value="'+esc(a.expr)+'" aria-label="Assign 運算式"><\/td><td><button data-action="assign-delete" data-id="'+esc(a.id)+'">移除<\/button><\/td><\/tr>').join('')+'<\/tbody><\/table><\/div><p class="a-hint">例如 srst_etn = ~fpga_rstb。請先宣告使用的訊號。<\/p>';
    if(tab==='advanced')return renderAdvanced();
    return renderExport(all);
  }
  function emptyStart(){if(flowUI&&!project.modules.length)return flowUI.start();if(project.modules.length)return '<div class="a-empty"><span class="a-eyebrow">RTL 已匯入<\/span><h2>接著，把模組加入這個 Top。<\/h2><p>module 是介面定義；instance 是這個 Top 裡實際使用的一份模組。選一個加入後，就會看到它的接腳。<\/p>'+project.modules.map(m=>'<div class="a-card"><b>'+esc(m.name)+'<\/b> · '+m.ports.length+' ports <button data-action="instance-add" data-id="'+esc(m.name)+'">＋ 加入 instance<\/button><\/div>').join('')+'<\/div>';return '<div class="a-empty"><div class="a-eyebrow">WRAPITFUP · TOP 組裝<\/div><h2>先完成一個 Top，再處理大型設計。<\/h2><p>工具幫你宣告線名、展開接線並生成 .v 與 .org。第一次使用，可以用兩個小模組練習，不必先學 gen_top 語法。<\/p><div class="a-actions"><button class="a-primary" data-action="learning-start">開始 5 分鐘練習 →<\/button><button data-action="readme">先讀操作說明<\/button><\/div><div class="a-choice-grid a-start-options"><button data-action="import-rtl"><b>用我的子模組 RTL<\/b><span>匯入 .v／.sv，確認後直接建立 instances。<\/span><\/button><button data-action="load"><b>繼續上次的 WIU 專案<\/b><span>開啟 .wiu.json，恢復名稱、接線與設定。<\/span><\/button><button data-action="import-org"><b>從既有 org 開始<\/b><span>先備好子模組 RTL，再核對匯入結果。<\/span><\/button><\/div><p class="a-hint">原有繪圖功能在左上角「介面圖」。公司手冊與全部原圖在「gen_top 手冊」，需要查語法時再開啟。<\/p><\/div>';}
  function renderOrphans(){const keys=new Set(A.pinRows(project).map(r=>r.key));const lost=project.connections.filter(c=>!keys.has(c.instance+'::'+c.port));return lost.length?'<div class="a-note a-warn"><b>'+lost.length+' 個既有綁定找不到有效 pin<\/b><p>可能由 define 切換造成。先確認組態；也可以明確移除下面不再需要的綁定。<\/p>'+lost.map(c=>'<div class="a-include-row"><code>'+esc((project.instances.find(i=>i.id===c.instance)?.name||c.instance)+'.'+c.port+' → '+(c.expr||'刻意不接 NC'))+'<\/code><button data-action="orphan-remove" data-id="'+esc(c.id)+'">移除綁定…<\/button><\/div>').join('')+'<\/div>':'';}
  function connectionScopeSummary(rows,shown){const instance=project.instances.find(i=>i.id===instanceFilter),parts=[instance?'Instance：'+instance.name:'全部 instances'],visible=new Set(shown.map(r=>r.key)),valid=new Set(rows.map(r=>r.key)),count=[...selected].filter(k=>valid.has(k)).length,hidden=[...selected].filter(k=>valid.has(k)&&!visible.has(k)).length;if(graphTableOrigin?.pinKey)parts.push('指定 pin：'+graphTableOrigin.pinKey.split('::')[1]);if(filter)parts.push('搜尋：'+filter);if(onlyUnbound)parts.push('只看未設定');return '<div class="r118-connection-scope" role="status"><span>'+esc(parts.join(' · '))+'</span><b>顯示 '+shown.length+' / '+rows.length+' pins</b><span>已選 '+count+' 個'+(hidden?'（'+hidden+' 個在篩選外）':'')+'</span>'+((filter||onlyUnbound||instanceFilter||graphTableOrigin?.pinKey)?'<button data-action="clear-filters">顯示全部</button>':'')+(hidden?'<button data-action="clear-hidden-selection">清除篩選外選取</button>':'')+(count?'<button data-action="clear-selection">清除選取</button>':'')+'</div>';}
  function renderConnections(rows){
    const back='<nav class="r119-view-tabs r120-top-tabs r121-connection-tabs" aria-label="Top 工作檢視"><button type="button" data-action="wb-open" data-id="top">Top I/O</button><button type="button" data-action="wb-graph">接線圖</button><button type="button" data-action="graph-table" aria-current="page">接線表</button></nav>';
    if(!project.instances.length)return back+E.heading('03 / CONNECTIONS','先放入要接線的模組','匯入 RTL 或定義子模組介面後，就能設定每個接腳。','<button class="a-primary" data-tab="modules">放入模組 →<\/button>');
    const heading=back+E.heading('Top 接線','接腳與連線',connectionView==='table'?'直接編輯綁定，或選取多個接腳批次處理。':'選取接腳，設定右側的接線方式。');
    const modes='<div class="ux-connection-view a-toolbar" aria-label="接線顯示方式"><div class="ux-segmented"><button data-action="ux-connection-view" data-kind="cards" aria-pressed="'+(connectionView==='cards')+'">逐一接線<\/button><button data-action="ux-connection-view" data-kind="table" aria-pressed="'+(connectionView==='table')+'">表格／批次<\/button><\/div><button data-action="suggest">建議同名接線<\/button><button data-action="paste-connections">貼上接線表</button><button data-action="group-match">群組配對</button><details class="fg-related-tools"><summary>接腳與線的宣告<\/summary><button data-tab="ports">Top 對外接腳<\/button><button data-tab="nets">內部接線<\/button><button data-tab="assigns">訊號運算<\/button><button data-tab="defines">Defines<\/button><\/details><\/div>';
    if(connectionView==='table')return renderOrphans()+heading+modes+renderConnectionTable(rows);
    if(!project.instances.some(i=>i.id===instanceFilter))instanceFilter=project.instances[0].id;
    const shown=rows.filter(r=>(!instanceFilter||r.instance===instanceFilter)&&(!onlyUnbound||r.expr==null)&&(!filter||(r.instanceName+' '+r.port.name+' '+(r.expr||'')).toLowerCase().includes(filter.toLowerCase())));
    if(!shown.some(r=>r.key===focusedPin))focusedPin=(shown.find(r=>r.expr==null)||shown[0])?.key||'';
    const focus=rows.find(r=>r.key===focusedPin);
    const toolbar='<div class="a-toolbar fg-module-picker"><label>目前模組<select id="a-instance-filter" aria-label="選擇模組">'+project.instances.map(i=>'<option value="'+esc(i.id)+'" '+(i.id===instanceFilter?'selected':'')+'>'+esc(i.name)+'<\/option>').join('')+'<\/select><\/label><span>共 '+project.instances.length+' 份<\/span><details'+(filter||onlyUnbound?' open':'')+'><summary>搜尋／篩選接腳<\/summary><input id="a-filter" placeholder="搜尋目前模組的接腳或線名…" value="'+esc(filter)+'" aria-label="搜尋連線"><label><input type="checkbox" id="a-unbound" '+(onlyUnbound?'checked':'')+'> 只看未設定<\/label>'+(filter||onlyUnbound?'<button data-action="clear-filters">清除篩選<\/button>':'')+'<\/details><\/div>';
    const cards=project.instances.map(inst=>{
      const pins=shown.filter(r=>r.instance===inst.id);if(!pins.length)return '';
      const done=rows.filter(r=>r.instance===inst.id&&r.expr!=null).length,total=rows.filter(r=>r.instance===inst.id).length;
      return '<article class="ux-module-card"><header><div><h3>'+esc(inst.name)+'<\/h3><span>'+esc(inst.module)+'<\/span><\/div><small>'+done+' / '+total+' 已設定<\/small>'+((project.modules.find(m=>m.name===inst.module)?.parameters||[]).some(p=>!p.local)?'<button data-action="instance-edit" data-id="'+esc(inst.id)+'" title="設定 '+esc(inst.name)+' 的參數覆寫">Instance 參數<\/button>':'')+'<\/header>'+pins.map(r=>'<button class="ux-pin-row'+(focusedPin===r.key?' is-selected':'')+(r.expr==null?' is-pending':'')+'" data-action="ux-pin" data-id="'+esc(r.key)+'" aria-pressed="'+(focusedPin===r.key)+'"><span class="ux-pin-direction">'+esc(({input:'IN',output:'OUT',inout:'I/O'})[r.port.direction]||r.port.direction)+'<\/span><span class="ux-pin-name"><strong>'+esc(r.port.name)+'<\/strong><small>'+esc(pinRange(r))+'<\/small><\/span><span class="ux-pin-binding">'+esc(r.expr==null?'○ 尚未設定':r.expr===''?'— 刻意不接 NC':r.expr)+'<\/span><\/button>').join('')+'<\/article>';
    }).join('');
    return renderOrphans()+heading+modes+toolbar+connectionScopeSummary(rows,shown)+'<div class="ux-wiring-layout"><div class="ux-pin-board">'+(cards||'<p class="a-note">沒有符合的接腳。<button data-action="clear-filters">清除篩選<\/button><\/p>')+'<\/div><aside class="ux-pin-inspector" aria-label="目前接腳設定">'+(focus?renderPinInspector(focus):'<div class="ux-inspector-empty"><span class="ux-kicker">CONNECT A SIGNAL<\/span><h3>從一個接腳開始<\/h3><p>點選左側接腳，就能看到目前用途與可用的接線方式。<\/p><p class="a-hint">○ 尚未設定：會擋住匯出，不能視為空接<br>— 刻意不接 NC：org 寫 conn ""，RTL 寫 .pin()<\/p><\/div>')+'<\/aside><\/div><p class="a-hint">顯示 '+shown.length+' / '+rows.length+' 個接腳。需要切片、運算式或多選時，切換到「表格／批次編輯」。<\/p>';
  }
  function renderPinInspector(row){
    const peers=row.expr?A.pinRows(project).filter(r=>r.key!==row.key&&r.expr===row.expr):[];
    const net=project.nets.find(n=>n.name===row.expr);
    const choices=[['expression','選擇既有 net／運算式','先核對方向、位寬與既有驅動。'],['peer','接到其他接腳','選另一端，建立有名字的內部線。'],['external','接到 Top 外部','建立或使用最外層 input／output。'],['internal','使用命名接線','連到既有 net，或建立中間線。'],...(row.port.direction==='output'?[]:[['constant','接固定值','明確指定 0、1 或有位寬的常數。']]),['open',row.port.direction==='input'?'刻意不接 NC…':'刻意不接',row.port.direction==='input'?'先確認設計允許浮接。':'org 明寫 conn ""，RTL 輸出 .pin()。']];
    return '<span class="ux-kicker">SELECTED PIN<\/span><h3>'+esc(row.port.name)+'<\/h3><p class="a-mono">'+esc(row.instanceName)+'<\/p><p>'+badge(row.port.direction.toUpperCase())+' '+esc(pinRange(row))+'<\/p><div class="ux-current-connection"><small>目前設定<\/small><strong>'+esc(row.expr==null?'尚未決定用途':row.expr===''?'刻意不接 NC':row.expr)+'<\/strong>'+(net?'<span>'+esc(({wire:'Top 內部線',input:'來自 Top 外部',output:'送到 Top 外部',inout:'Top 雙向接腳'})[net.direction])+'<\/span>':'')+(peers.length?'<p>同一接線：'+peers.map(r=>esc(r.instanceName+'.'+r.port.name)).join('、')+'<\/p>':'')+'<\/div><div class="a-choice-grid">'+choices.map(([kind,title,desc])=>'<button data-action="connection-choice" data-kind="'+kind+'" data-id="'+esc(row.key)+'"><b>'+title+'<\/b><span>'+desc+'<\/span><\/button>').join('')+'<\/div>'+(row.expr!=null?'<button class="ux-unset" data-action="ux-unset" data-id="'+esc(row.key)+'">清除設定，待處理<\/button>':'');
  }
  function renderConnectionTable(rows){
    if(!project.instances.length)return emptyStart();
    const review=netReview(),NR=window.WIUNetReview;
    const searchable=r=>{const e=review.byKey.get(r.key);return [r.instanceName,e?.group,r.port.name,r.expr,...review.peers(r.key).map(p=>p.instanceName+' '+p.group+' '+p.pin)].join(' ').toLowerCase();};
    const shown=rows.filter(r=>(!graphTableOrigin?.pinKey||r.key===graphTableOrigin.pinKey)&&(!instanceFilter||r.instance===instanceFilter)&&(!onlyUnbound||r.expr==null)&&(!filter||searchable(r).includes(filter.toLowerCase())));
    return connectionScopeSummary(rows,shown)+'<p class="a-hint">每列依 Instance → Group → Pin 對照兩端；Group「—」表示未分組。目的欄列出同一 net 的驅動／接收端；assign 與切片保留運算式。不用的 pin 請選「刻意不接」，org 會明寫 conn ""；「未設定」仍需處理。可勾選多個接腳批次處理。<\/p><div class="a-toolbar"><input id="a-filter" placeholder="搜尋 instance、group、pin 或目的端…" value="'+esc(filter)+'" aria-label="搜尋連線"><select id="a-instance-filter" aria-label="依 instance 篩選"><option value="">全部 instances<\/option>'+project.instances.map(i=>'<option value="'+esc(i.id)+'" '+(i.id===instanceFilter?'selected':'')+'>'+esc(i.name)+'<\/option>').join('')+'<\/select><label><input type="checkbox" id="a-unbound" '+(onlyUnbound?'checked':'')+'> 只看未設定<\/label><button data-action="clear-filters">清除篩選<\/button><\/div><div class="a-toolbar r69-batch"><span>'+selected.size+' 個已選取<\/span><button data-action="batch-net" '+(!selected.size?'disabled':'')+'>接到 net／新建 net<\/button><button data-action="batch-slices" '+(!selected.size?'disabled':'')+'>切片分配<\/button><button data-action="batch-expose" '+(!selected.size?'disabled':'')+'>提升為 Top ports<\/button><button data-action="batch-tie" '+(!selected.size?'disabled':'')+'>常數<\/button><button data-action="batch-open" '+(!selected.size?'disabled':'')+'>刻意不接 NC<\/button><button data-action="batch-unset" '+(!selected.size?'disabled':'')+'>清除設定<\/button><\/div><div class="a-tablebox"><table class="a-table r132-review-table"><thead><tr><th><input type="checkbox" id="a-select-all" aria-label="選取目前顯示 pins" '+(shown.length&&shown.every(r=>selected.has(r.key))?'checked':'')+'><\/th><th>Instance / Group / Pin<\/th><th>方向<\/th><th>位寬<\/th><th>連到 Instance / Group / Pin<\/th><th>狀態<\/th><th>操作<\/th><\/tr><\/thead><tbody>'+shown.map(r=>'<tr data-row-key="'+esc(r.key)+'"><td><input type="checkbox" data-pin-select="'+esc(r.key)+'" '+(selected.has(r.key)?'checked':'')+' aria-label="選取 '+esc(r.instanceName+'.'+r.port.name)+'"><\/td><td>'+NR.endpointHTML(review.byKey.get(r.key))+'<\/td><td>'+badge(r.port.direction.toUpperCase())+'<\/td><td><span class="a-mono">'+esc(pinRange(r))+'<\/span><\/td><td><div class="r132-destinations">'+NR.destinationHTML(review.byKey.get(r.key),review.peers(r.key))+'</div><div class="r119-binding"><select class="r118-binding-mode" data-binding-mode="'+esc(r.key)+'" aria-label="'+esc(r.instanceName+'.'+r.port.name)+' 綁定狀態">'+[['unset','未設定'],['net','接線／運算式'],...(r.port.direction==='output'?[]:[['constant','常數']]),['open','刻意不接']].map(([value,label])=>'<option value="'+value+'" '+(HF.bindingKind(r.expr)===value?'selected':'')+'>'+label+'</option>').join('')+'</select><input class="a-expr" data-connection="'+esc(r.key)+'" value="'+esc(r.expr??'')+'" placeholder="'+(r.expr===''?'刻意不接：.pin()':'輸入 net／運算式；空白＝未設定')+'" list="a-net-list" spellcheck="false" aria-label="'+esc(r.instanceName+'.'+r.port.name)+' 連線"><small data-r118-edit-status role="status">'+''+'</small></div><\/td><td>'+pinStatus(r)+'<\/td><td><button data-action="pin-connect" data-id="'+esc(r.key)+'">設定接線…<\/button><\/td><\/tr>').join('')+'<\/tbody><\/table><\/div>'+(!shown.length?'<div class="a-note">'+(rows.length?'沒有符合篩選的 pins。':'此 instance 沒有可用的接腳；請先核對子模組 RTL。')+' <button data-action="clear-filters">顯示全部<\/button><\/div>':'')+'<datalist id="a-net-list">'+project.nets.map(n=>'<option value="'+esc(n.name)+'">'+esc(n.direction+' '+n.range)+'<\/option>').join('')+'<\/datalist><p class="a-hint">顯示 '+shown.length+' / '+rows.length+' pins。清空輸入並套用會回到「未設定」；選擇「刻意不接」才會輸出 .pin()。<\/p>';
  }
  function topContext(){const raw=C.projectView(project).parameters||[],defs=Array.isArray(raw)?raw:Object.entries(raw).map(([name,value])=>({name,value:String(value)}));return C.resolveParameters({parameters:defs},{}).context;}
  function pinRange(row){try{const pv=C.projectView(project),inst=pv.instances.find(i=>i.id===row.instance),m=pv.modules.find(m=>m.name===inst.module),ctx=C.resolveParameters(m,inst.parameters,topContext()).context;const r=C.parseRange(C.expandDefines(row.port.range,project),ctx);return (row.port.range||'1 bit')+(r.width>1?' · '+r.width+' bits':'');}catch{return row.port.range||'1 bit';}}
  function effectiveRange(row){const pv=C.projectView(project),inst=pv.instances.find(i=>i.id===row.instance),m=pv.modules.find(m=>m.name===inst.module),ctx=C.resolveParameters(m,inst.parameters,topContext()).context;const r=C.parseRange(C.expandDefines(row.port.range,project),ctx);return r.width===1?'':'['+r.msb+':'+r.lsb+']';}
  function renderNets(top){const nets=project.nets.filter(n=>top?n.direction!=='wire':n.direction==='wire');return '<h2>'+(top?'Top ports · 最上層對外介面':'內部 nets · 中間接線')+'<\/h2><p class="a-lead">'+(top?'名稱、方向與位寬決定最外層介面。範圍可填 [`DATA_W-1:0]，使用 Defines 中的數值巨集。':'把中間線命名並明確宣告。可用 [63:0] 切片，位寬也可填 [`DATA_W-1:0]，macro 在 Defines 設定。')+'<\/p><div class="a-toolbar"><button class="a-primary" data-action="net-add" data-kind="'+(top?'input':'wire')+'">＋ '+(top?'新增 Top port':'新增內部 net')+'<\/button>'+(!top?'<span class="a-hint">驅動／接收數是端點數；切片重疊由檢查器判定。<\/span>':'<button data-action="flow-top-interface">批次貼上 Top 介面<\/button><button data-action="flow-parameters">Top 參數<\/button>')+'<\/div><div class="a-tablebox"><table class="a-table"><thead><tr><th>名稱<\/th><th>方向<\/th><th>範圍<\/th><th>Signed<\/th><th>群組 / 備註<\/th><th>驅動 / 接收<\/th><th><\/th><\/tr><\/thead><tbody>'+nets.map(n=>{const u=A.netUsage(project,n.name);return '<tr><td><input class="a-name" data-net="'+esc(n.id)+'" data-field="name" value="'+esc(n.name)+'" aria-label="Net 名稱"><\/td><td><select data-net="'+esc(n.id)+'" data-field="direction" aria-label="Net 方向">'+['wire','input','output','inout'].map(d=>'<option '+(d===n.direction?'selected':'')+'>'+d+'<\/option>').join('')+'<\/select><\/td><td><input class="a-range" data-net="'+esc(n.id)+'" data-field="range" value="'+esc(n.range)+'" placeholder="純量或 [7:0]" aria-label="Net 範圍"><\/td><td><input type="checkbox" data-net="'+esc(n.id)+'" data-field="signed" '+(n.signed?'checked':'')+' aria-label="Signed"><\/td><td><input data-net="'+esc(n.id)+'" data-field="group" value="'+esc(n.group||'')+'" placeholder="群組" aria-label="Net 群組"><input data-net="'+esc(n.id)+'" data-field="comment" value="'+esc(n.comment||'')+'" placeholder="備註" aria-label="Net 備註"><\/td><td>'+u.drivers+' / '+u.sinks+' <button data-action="net-inspect" data-id="'+esc(n.id)+'">查看<\/button><\/td><td><button data-action="net-delete" data-id="'+esc(n.id)+'">移除<\/button><\/td><\/tr>';}).join('')+'<\/tbody><\/table><\/div>'+(!nets.length?'<div class="a-note">尚未建立'+(top?'對外 port。可在連線表選取 pins，按「提升為 Top ports」。':'內部 net。可在連線表選取要相接的 pins，按「接到 net／新建 net」。')+'<\/div>':'');}
  function renderAdvanced(){return '<h2>進階 org · 保留公司功能<\/h2><p class="a-lead">WIU 能理解的接線由結構化資料生成；尚未解析的指令保留在這裡。保留原文不代表 WIU 已驗證它的作用。<\/p><div class="a-note a-warn">啟用不透明進階語法後，完整 Verilog 匯出會暫停，避免兩種輸出產生不同硬體。可明確下載帶原文的 org 候選檔，再交由公司 gen_top 驗證。<\/div><h3>gen_top format<\/h3><p class="a-hint">匯出使用原始範例的五個基本選項；有大寫接腳時保留 case_sensitive。其他項目影響公司工具輸出，不保證 WIU 的文字排版相同。<\/p><div class="a-advanced-formats">'+C.FORMAT_OPTIONS.map(f=>'<label><input type="checkbox" data-format="'+f+'" '+(project.formats.includes(f)||['commented_inst_pin','commented_port','constraint_port_order','keep_inst_port_order','disable_unconstraint_port'].includes(f)?'checked':'')+' '+(['commented_inst_pin','commented_port','constraint_port_order','keep_inst_port_order','disable_unconstraint_port'].includes(f)?'disabled':'')+'> <span class="a-mono">'+f+'<\/span><\/label>').join('')+'<\/div><label>未解析／手寫 realtek 指令<textarea id="a-advanced" spellcheck="false" placeholder="例如 empty、empty_out、empty_port 或 c_code。原文保留，不在瀏覽器執行。">'+esc(project.advanced)+'<\/textarea><\/label><label>其他手寫前置內容<textarea id="a-prelude" spellcheck="false" placeholder="未建模的原始文字，請勿當作已驗證的 Verilog。">'+esc(project.prelude)+'<\/textarea><\/label><p class="a-hint">完整支援清單與命令列選項請見 README。<\/p>'+(project.originalOrg?'<button data-action="original-org">下載匯入時的原始 org<\/button>':'');}
  function renderExport(all){
    const verilogErrors=issues('verilog').filter(i=>i.severity==='error'),target=exportTab==='org'?'org':'verilog';
    let code='';try{code=target==='verilog'?C.renderVerilog(project):C.renderOrg(project,{allowRaw:true});}catch(e){code='// 無法建立預覽：'+e.message;}
    const ready=!verilogErrors.length&&project.instances.length>0;
    return E.heading('05 / DELIVERY','取得你的設計成果','選擇這次要交付的成果，設計仍可隨時返回修改。')+E.deliveryChoices('rtl')+
      '<section class="ux-rtl-delivery"><span class="ux-kicker">VERILOG TOP<\/span><h3>'+esc(filename())+'.v<\/h3><p>此檔案是目前組態的 Top 接線，編譯時需一併提供子模組 RTL 與相同 Defines。<\/p>'+
      (verilogErrors.length?'<div class="a-note a-warn">還有 '+verilogErrors.length+' 項問題，修正後可下載。<button data-tab="check">前往檢查設計 →<\/button><\/div>':!project.instances.length?'<p class="a-note">先放入子模組並完成接線。<\/p>':'<p class="ux-success">✓ 網站結構檢查通過'+(downloadState.verilog===JSON.stringify(project)?' · 此版本已送出下載':'')+'<\/p>')+
      '<div class="ux-delivery-actions"><button class="a-primary" data-action="download-output" data-kind="verilog" '+(!ready?'disabled':'')+'>下載目前單一組態 Top<\/button><button data-action="save">保存可續編專案<\/button><\/div><p class="a-hint">此處只下載目前單一組態。要取得同檔 FPGA／ASIC、子模組與腳本，請選「工作包 工作檔案」。<\/p><\/section>'+
      '<details class="a-reference-details a-code-preview"><summary>檢視產生的程式碼<\/summary><div class="a-toolbar"><button data-action="export-mode" data-kind="verilog" aria-pressed="'+(target==='verilog')+'">Verilog<\/button><button data-action="export-mode" data-kind="org" aria-pressed="'+(target==='org')+'">gen_top org<\/button><\/div><pre class="a-code" tabindex="0">'+esc(code)+'<\/pre><button data-action="copy-output">複製預覽<\/button><\/details>'+
      '<details class="a-reference-details"><summary>個別下載 Define／org<\/summary><p>單獨的 org 還需要子模組來源與公司執行環境；需要帶齊檔案時，請選上方公司工具包。<\/p><div class="a-actions"><button data-action="download-output" data-kind="defines" '+(D.validate(project.defineConfig).some(i=>i.severity==='error')?'disabled':'')+'>下載 Define 檔<\/button><button data-action="download-output" data-kind="org" '+(issues('org').some(i=>i.severity==='error')?'disabled':'')+'>下載 org<\/button>'+((project.advanced||project.prelude)?'<button data-action="download-raw">下載含進階原文的 org 候選檔…<\/button>':'')+'<\/div><\/details>';
  }
  function pick(mode,targetModule=''){fileMode=mode;fileInput.dataset.moduleTarget=targetModule;fileInput.value='';fileInput.multiple=mode==='rtl';fileInput.accept=mode==='defines'||mode==='define-include'?'.vh,.v,.svh,.sv,.txt':mode==='rtl'?'.v,.sv,.vp,.txt':mode==='org'?'.org,.v,.txt':'.json,.png,.svg,.pdf,.vbs';fileInput.click();}
  function importDialog(mode,targetModule=''){
    if(!targetModule)view('assembly');
    const draftKey=project.workbook.projectId+'::'+mode+'::'+targetModule;let state=intakeDrafts.get(draftKey);if(!state){state={materials:[],text:'',name:'',role:mode==='org'?'org':'rtl',counts:{},remaps:{},sourceChoices:{}};intakeDrafts.set(draftKey,state);}const materials=state.materials,pasteRole=state.role;let loading=false;
    const target=targetModule&&project.modules.find(m=>m.name===targetModule),config=D.normalize(project.defineConfig);
    openDialog(targetModule?'更新 RTL · '+targetModule:'匯入設計材料',
      '<p>RTL、org、Defines 與 include 可一次加入。先核對用途與相對路徑，再預覽模組與既有接線的影響；確認前不會改動專案。</p>'+
      '<p class="a-hint">目前材料：'+(project.rtlSources||[]).length+' 份 RTL · '+config.includes.length+' 份 include · '+config.rows.filter(r=>r.enabled).length+' 個啟用 define。</p>'+
      '<label>加入檔案<input id="r118-intake-files" type="file" multiple accept=".v,.sv,.vp,.org,.vh,.svh,.txt"></label>'+
      '<div id="r118-intake-materials"></div><p class="a-hint">.vh／.svh 預設作為 include；要在整個組態啟用的巨集，請選「Defines 清單」。含 include guard 的檔案請保留為 include。</p>'+
      '<details open><summary>貼上原文</summary><div class="a-grid2"><label>用途<select id="r118-paste-role"><option value="rtl" '+(pasteRole==='rtl'?'selected':'')+'>子模組 RTL</option><option value="org" '+(pasteRole==='org'?'selected':'')+'>Top org</option><option value="defines">Defines 清單</option><option value="include">include 原檔</option></select></label><label>來源檔名／相對路徑<input id="r118-paste-name" value="'+esc(state.name||target?.sourceFilename||target?.filename||'')+'" placeholder="RTL 可留白自動命名；include 須符合引用路徑"></label></div><textarea id="a-import-text" spellcheck="false" placeholder="'+(pasteRole==='rtl'?'module child (...); ... endmodule':'// realtek inst child')+'"></textarea><button type="button" id="r118-add-pasted">加入材料清單</button></details>',
      '預覽材料與影響',()=>{
        if(loading)throw Error('檔案仍在讀取，請稍候。');const rows=materials.map(f=>({...f})),pasted=readPaste();if(pasted)rows.push(pasted);
        state.text=$('#a-import-text',dialog).value;state.name=$('#r118-paste-name',dialog).value;state.role=$('#r118-paste-role',dialog).value;reviewSourceConflicts(rows,state,()=>{const plan=window.WIUImportReview.intake(project,rows,{targetModule});reviewIntake(plan,targetModule,()=>importDialog(mode,targetModule),state,draftKey);},()=>importDialog(mode,targetModule));
      });
    const roles=[['rtl','子模組 RTL'],['org','Top org'],['defines','Defines 清單'],['include','include 原檔']];
    function refreshMaterials(){const host=$('#r118-intake-materials',dialog);host.innerHTML=materials.length?'<div class="a-tablebox"><table class="a-table"><thead><tr><th>用途</th><th>來源路徑</th><th>大小</th><th></th></tr></thead><tbody>'+materials.map((f,i)=>'<tr><td><select data-intake-role="'+i+'" aria-label="'+esc(f.name)+' 用途">'+roles.map(([v,label])=>'<option value="'+v+'" '+(f.role===v?'selected':'')+'>'+label+'</option>').join('')+'</select></td><td><input data-intake-name="'+i+'" value="'+esc(f.name)+'" aria-label="材料 '+(i+1)+' 相對路徑"></td><td>'+new TextEncoder().encode(f.text).length+' B</td><td><button type="button" data-intake-remove="'+i+'">移除</button></td></tr>').join('')+'</tbody></table></div>':'<p class="a-note">尚未加入檔案。也可以直接貼上原文後預覽。</p>';
      host.querySelectorAll('[data-intake-role]').forEach(el=>el.addEventListener('change',()=>{materials[Number(el.dataset.intakeRole)].role=el.value;}));host.querySelectorAll('[data-intake-name]').forEach(el=>el.addEventListener('input',()=>{materials[Number(el.dataset.intakeName)].name=el.value;}));host.querySelectorAll('[data-intake-remove]').forEach(el=>el.addEventListener('click',()=>{materials.splice(Number(el.dataset.intakeRemove),1);refreshMaterials();}));}
    function readPaste(){const text=$('#a-import-text',dialog).value;if(!text.trim())return null;const role=$('#r118-paste-role',dialog).value,explicit=$('#r118-paste-name',dialog).value.trim(),moduleName=/\bmodule\s+([A-Za-z_][A-Za-z0-9_$]*)/.exec(P.stripComments(text))?.[1];if(role==='include'&&!explicit)throw Error('include 原檔請填寫 RTL 引用的相對路徑。');return {role,text,name:explicit||(role==='rtl'?(moduleName||'pasted')+'.v':role==='org'?'pasted.v.org':'intake_defines.vh')};}
    $('#r118-add-pasted',dialog).addEventListener('click',()=>safe(()=>{const f=readPaste();if(!f)throw Error('請先貼上原文。');materials.push(f);$('#a-import-text',dialog).value='';$('#r118-paste-name',dialog).value='';state.text='';state.name='';refreshMaterials();}));
    $('#r118-intake-files',dialog).addEventListener('change',async e=>{loading=true;try{const picked=[...e.target.files],staged=[];for(const file of picked){if(file.size>12*1024*1024)throw Error(file.name+' 超過 12 MB。');const text=await file.text();staged.push({name:file.webkitRelativePath||file.name,text,role:window.WIUImportReview.classify(file.name,text)});}materials.push(...staged);refreshMaterials();}catch(error){toast('讀取材料失敗：'+error.message);}finally{loading=false;e.target.value='';}});
    $('#a-import-text',dialog).value=state.text;$('#r118-paste-role',dialog).value=state.role;
    for(const [id,key]of [['a-import-text','text'],['r118-paste-name','name'],['r118-paste-role','role']])$('#'+id,dialog).addEventListener('input',e=>{state[key]=e.target.value;});
    const discard=document.createElement('button');discard.textContent='清空本次材料';discard.type='button';discard.onclick=()=>{intakeDrafts.delete(draftKey);importDialog(mode,targetModule);};$('.a-dialog-foot',dialog).prepend(discard);
    refreshMaterials();
  }
  function importRtl(source,targetModule=''){
    const target=targetModule&&project.modules.find(m=>m.name===targetModule),result=typeof source==='string'?P.parseRtl(source,{config:project.defineConfig,filename:target?(target.sourceFilename||target.filename):undefined}):source;
    if(result.issues.some(i=>i.severity==='error')){openDialog('RTL 尚有無法解析的材料',issueList(result.issues)+'<p>補上 Defines／include 或修正來源後，再從「匯入設計材料」重試。未修改目前專案。</p>');return;}
    const merged=window.WIUImportReview.mergeRtl(project,result,targetModule);
    reviewIntake({project:merged.project,modules:result.modules,issues:result.issues,materials:(result.sources||[]).map(f=>({name:f.name,role:'rtl',bytes:new TextEncoder().encode(f.text).length})),sourceChanges:merged.changes,defineChanges:[],impact:window.WIUImportReview.compareInterfaces(project,merged.project)},targetModule);
  }
  function reviewIntake(plan,targetModule='',back=null,state=null,draftKey=''){
    const before=JSON.stringify(project),I=window.WIUImportReview,changed=plan.impact.changed,labels={kept:'已保留',changed:'需要核對',missing:'失去端點',added:'新增接腳'};
    const pinText=p=>p?p.direction+' · '+(p.error?'未解析：'+p.error:(p.width==null?'未解析':p.width+' bits'))+' · '+(p.expr==null?'未設定':p.expr===''?'刻意不接':p.expr):'不存在';
    const impactTable=changed.length?'<div class="a-tablebox"><table class="a-table"><thead><tr><th>影響對象</th><th>目前</th><th>匯入後</th><th>處理</th></tr></thead><tbody>'+changed.map(row=>{
      const connection=row.before?.connectionId&&plan.project.connections.find(c=>c.id===row.before.connectionId),inst=plan.project.instances.find(i=>i.id===row.instance),m=inst&&plan.project.modules.find(m=>m.name===inst.module);
      const remap=row.state==='missing'&&connection&&m?'<select data-import-remap="'+esc(connection.id)+'" aria-label="重新對應 '+esc(row.instanceName+'.'+row.port)+'"><option value="">保留舊綁定，稍後修正</option>'+m.ports.filter(p=>!plan.project.connections.some(c=>c.instance===inst.id&&c.port===p.name)).map(p=>'<option value="'+esc(p.name)+'">改接 '+esc(p.name)+' · '+esc(p.direction+' '+(p.range||'1 bit'))+'</option>').join('')+'</select>':labels[row.state];
      return '<tr><td><code>'+esc(row.instanceName+'.'+row.port)+'</code><small>'+labels[row.state]+'</small></td><td>'+esc(pinText(row.before))+'</td><td>'+esc(pinText(row.after))+'</td><td>'+remap+'</td></tr>';
    }).join('')+'</tbody></table></div>':'<p class="a-note">既有 instances 的接腳與有效位寬沒有變更。</p>';
    openDialog('確認材料與影響','<p>'+plan.materials.length+' 份材料 · '+plan.modules.length+' 個讀入模組。'+(plan.org?'這份 org 將取代目前 Top 組裝；模組來源與組態一起保存。':'模組定義會保存；下方顆數只控制這次新增多少 instances。')+'</p>'+
      '<details><summary>材料清單與來源變更</summary><ul>'+plan.materials.map(f=>'<li><code>'+esc(f.name)+'</code> · '+esc(({rtl:'RTL',org:'org',defines:'Defines',include:'include'})[f.role])+' · '+f.bytes+' B</li>').join('')+'</ul>'+arrImportChanges(plan.sourceChanges)+'</details>'+
      (plan.defineChanges?.length?'<h3>Defines 變更</h3><ul>'+plan.defineChanges.map(c=>'<li><code>'+esc(c.name)+'</code>：'+esc(c.before)+' → '+esc(c.after)+'</li>').join('')+'</ul>':'')+
      '<h3>既有接線影響</h3><p>'+plan.impact.kept+' 個接腳保持原狀 · '+changed.length+' 個差異 · '+plan.impact.affectedInstances.length+' 顆 instances 受影響。新增、移除與位寬變化不會默默猜測對應關係。</p>'+impactTable+
      (plan.orgNeedsName?'<label>Top 名稱<input id="r118-intake-top-name" value="'+esc(project.top==='top'?'':project.top)+'" placeholder="例如 etn_top"></label>':'')+
      (plan.modules.length?'<h3>'+(plan.org?'org 已指定使用的 instances':'保存模組／新增 instances')+'</h3>'+plan.modules.map(m=>'<div class="a-card"><b>'+esc(m.name)+'</b> · '+m.ports.length+' ports · 已使用 '+project.instances.filter(i=>i.module===m.name).length+' 顆'+(!plan.org?'<label>這次新增顆數（0＝只保存模組）<input type="number" min="0" max="64" value="0" data-import-count="'+esc(m.name)+'" aria-label="'+esc(m.name)+' 新增顆數"></label>':'')+'<details><summary>方向與位寬</summary><div class="a-tablebox"><table class="a-table"><tbody>'+m.ports.map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+esc(p.direction)+'</td><td>'+esc(p.range||'1 bit')+'</td></tr>').join('')+'</tbody></table></div></details></div>').join(''):'')+
      (plan.issues?.length?issueList(plan.issues.filter(i=>i.code!=='TOP_NAME_MISSING')):'')+'<p class="a-hint">整筆匯入可 Undo。既有 instance 名稱與未受影響的綁定保持不動。</p>',
      '套用材料與選定顆數',()=>{
        if(JSON.stringify(project)!==before)throw Error('專案已變更，請重新預覽匯入。');let next=A.clone(plan.project);
        if(plan.orgNeedsName){const name=$('#r118-intake-top-name',dialog).value.trim();if(!C.validName(name))throw Error('請輸入有效的 Top 名稱。');next.top=name;next.importUnresolved=(next.importUnresolved||[]).filter(i=>i.code!=='TOP_NAME_MISSING');}
        const remaps=Object.fromEntries($$('[data-import-remap]',dialog).filter(el=>el.value).map(el=>[el.dataset.importRemap,el.value]));next=I.remapBindings(next,remaps);
        const counts=Object.fromEntries($$('[data-import-count]',dialog).map(el=>[el.dataset.importCount,Number(el.value)]));const added=I.addInstances(next,counts);next=added.project;
        const errors=C.validate(next).filter(i=>i.severity==='error');if(state)for(const [file,choice]of Object.entries(state.sourceChoices))if(choice==='incoming')delete next.workbook.guiEditedSources?.[file];commit(()=>{project=next;resetFilters();if(!project.entryRoute)project.entryRoute='bottom-up';tab=errors.length?'check':project.instances.length?'graph':'modules';view('assembly');},'已匯入 '+plan.materials.length+' 份材料，新增 '+added.added.length+' 顆 instances。',{scope:'project',label:'匯入設計材料'});dialog.close();
        if(draftKey)intakeDrafts.delete(draftKey);
        if(added.added.length===1)locateGraphInstance(added.added[0].id);
        else if(added.added.length>1){go('connections');connectionView='table';selected=new Set(A.pinRows(project).filter(r=>added.added.some(i=>i.id===r.instance)).map(r=>r.key));render();}
        else {const m=project.modules.find(m=>m.name===(targetModule||plan.modules[0]?.name));if(m&&!(m.parameters||[]).some(p=>p.local))openSheet(m.id);else if(plan.org)go('graph');}
        if(errors.length){issueQueueOpen=true;refreshIssueQueue();toast('已匯入；'+errors.length+' 項待核對。可從右側問題清單定位。');}
      });
    if(state){for(const el of $$('[data-import-count]',dialog)){el.value=state.counts[el.dataset.importCount]??0;el.addEventListener('input',()=>state.counts[el.dataset.importCount]=el.value);}for(const el of $$('[data-import-remap]',dialog)){el.value=state.remaps[el.dataset.importRemap]||'';el.addEventListener('change',()=>state.remaps[el.dataset.importRemap]=el.value);}}
    if(back){const b=document.createElement('button');b.type='button';b.textContent='← 返回修改／補材料';b.addEventListener('click',back);$('.a-dialog-foot',dialog).prepend(b);}
    function arrImportChanges(changes){return changes?.length?'<ul>'+changes.map(c=>'<li>'+esc(c.message||c.filename||String(c))+'</li>').join('')+'</ul>':'';}
  }
  function previewOrg(source,filename){
    const plan=window.WIUImportReview.intake(project,[{name:filename||'pasted.v.org',text:source,role:'org'}]);reviewIntake(plan);
  }
  function instanceForm(id,moduleName){
    const existing=project.instances.find(i=>i.id===id),m=project.modules.find(m=>m.name===(existing?.module||moduleName));if(!m)throw Error('缺少子模組 RTL，請先匯入。');let name=m.name+'_inst',n=1;while(!existing&&project.instances.some(i=>i.name===name))name=m.name+'_inst'+n++;
    openDialog(existing?'此 instance 覆寫 · '+existing.name:'加入 instance · '+m.name,'<label>Instance 名稱<input id="a-inst-name" value="'+esc(existing?.name||name)+'" spellcheck="false"></label><p class="a-hint">'+esc(m.name)+' · 空白＝模組預設；數值／表達式＝此 instance 獨立覆寫；填入 Top 參數名稱＝明確引用 Top。只影響這一顆。</p>'+(m.parameters||[]).filter(p=>!p.local).map(p=>'<label>'+esc(p.name)+' <small>（模組預設 '+esc(p.value)+'）</small><input data-param-name="'+esc(p.name)+'" value="'+esc(existing?.parameters?.[p.name]??'')+'" placeholder="使用模組預設；或輸入數值／Top 參數"></label>').join('')+((m.parameters||[]).some(p=>!p.local)?'':'<p class="a-note">此模組沒有可覆寫參數。可修改 instance 名稱，或更新來源 RTL。</p>')+'<div id="r83-param-preview" class="r83-param-preview"></div><div id="r118-port-width-preview"></div>',existing?'套用此 instance':'加入',()=>{
      const name=$('#a-inst-name',dialog).value.trim();if(!C.validName(name))throw Error('Instance 名稱不是有效識別字。');if(project.instances.some(i=>i.name===name&&i.id!==id))throw Error('Instance 名稱已存在。');const parameters=collectParams();const candidate={...(existing||{id:uid(),module:m.name}),name,parameters};
      commit(()=>{if(existing){existing.name=name;existing.parameters=parameters;}else project.instances.push(candidate);project.orgEdited=true;tab=tab==='graph'?'graph':'connections';},'已套用 '+name+'；接腳位寬與接線已重新檢查。',{label:'修改 '+name+' 參數'});dialog.close();
    });
    function collectParams(){return Object.fromEntries($$('[data-param-name]',dialog).filter(input=>input.value.trim()).map(input=>[input.dataset.paramName,input.value.trim()]));}
    const preview=()=>{
      const parameters=collectParams(),trial=A.clone(project),i={...(existing||{id:'r118-preview',name,module:m.name}),parameters};trial.instances=trial.instances.filter(x=>x.id!==i.id).concat(i);const rows=C.instanceParameterRows(trial,i);
      $('#r83-param-preview',dialog).hidden=!rows.length;$('#r83-param-preview',dialog).innerHTML=rows.map(r=>'<div class="'+(r.error?'r73-error':'')+'"><code>'+esc(r.name)+'</code> <b>'+esc(r.error?'未解析':r.value)+'</b> <span>'+esc(r.sourceLabel)+' · '+esc(r.expression)+(r.error?' · '+esc(r.error):'')+'</span></div>').join('');
      const impact=window.WIUImportReview.parameterImpact(project,i,parameters),width=p=>p?(p.error?'未解析':p.width+' bits'):'不存在';
      $('#r118-port-width-preview',dialog).innerHTML='<details><summary>接腳位寬與接線影響</summary><div class="a-tablebox"><table class="a-table"><thead><tr><th>接腳</th><th>宣告</th><th>目前</th><th>套用後</th></tr></thead><tbody>'+impact.rows.map(r=>'<tr'+(r.state==='changed'?' class="r118-width-changed"':'')+'><td>'+esc(r.port)+'</td><td><code>'+esc(r.after?.range||'scalar')+'</code></td><td>'+esc(width(r.before))+'</td><td>'+esc(width(r.after))+(r.after?.error?'<small>'+esc(r.after.error)+'</small>':'')+'</td></tr>').join('')+'</tbody></table></div>'+(impact.errors.length?'<p class="a-note a-warn">套用後此 instance 有 '+impact.errors.length+' 項接線／參數需核對：</p>'+issueList(impact.errors):'<p class="a-hint">此 instance 目前沒有偵測到接線寬度或參數錯誤。</p>')+'</details>';
    };$$('[data-param-name]',dialog).forEach(input=>input.addEventListener('input',preview));preview();
  }
  function selectedRows(keys=selected){return A.pinRows(project).filter(r=>keys.has(r.key));}
  function changePlan(title,changes,newNets=[]){if(!changes.length){toast('没有符合條件的 pins。');return;}const before=JSON.stringify(project),trial=A.clone(project);trial.nets.push(...newNets);A.applyConnections(trial,changes);const review=C.validate(trial).filter(i=>i.severity==='error');openDialog(title,'<p>將更新 '+changes.length+' 個 pins'+(newNets.length?'，新增 '+newNets.length+' 個宣告':'')+'。'+(changes.some(c=>project.connections.some(x=>x.instance===c.instance&&x.port===c.port))?'其中包含已有設定的 pins，套用會取代原設定。':'')+'<\/p><div class="a-tablebox"><table class="a-table"><thead><tr><th>PIN<\/th><th>新設定<\/th><\/tr><\/thead><tbody>'+changes.map(c=>'<tr><td>'+esc(project.instances.find(i=>i.id===c.instance)?.name+'.'+c.port)+'<\/td><td class="a-mono">'+esc(c.expr===null?'未設定':c.expr===''?'刻意不接 NC':c.expr)+'<\/td><\/tr>').join('')+'<\/tbody><\/table><\/div>'+(newNets.length?'<p>新增宣告：'+newNets.map(n=>'<code>'+esc(n.direction+' '+n.range+' '+n.name)+'<\/code>').join('、')+'<\/p>':'')+(L.isLearning(project)&&tab==='lesson'?'<div class="a-note">這一步完成後，還有 '+A.pinRows(trial).filter(r=>r.expr==null).length+' 個接腳待設定。下一步會繼續帶你完成。<\/div>':review.length?'<div class="a-note a-warn">套用後仍有 '+review.length+' 項需修正。可先保存未完成接線，正式匯出前須修正。<\/div>':''),'套用這些變更',()=>{if(JSON.stringify(project)!==before)throw Error('專案已變更，請重新預覽。');commit(()=>{project.nets.push(...newNets);A.applyConnections(project,changes);project.orgEdited=true;selected.clear();});dialog.close();});}
  function newNetForm(kind='wire',keys,preset={}){const rows=keys?selectedRows(keys):[],first=rows[0],guided=tab==='lesson'&&L.isLearning(project)&&!!preset.name;let range='';try{if(first)range=effectiveRange(first);}catch{}openDialog(rows.length?'接到 net／建立命名接線':'新增 '+(kind==='wire'?'內部 net':'Top port'),(rows.length?'<p>連接：'+rows.map(r=>'<code>'+esc(r.instanceName+'.'+r.port.name)+'<\/code>').join(' ↔ ')+'<\/p>':'')+(guided?'<p class="a-note">這個練習使用固定線名與位寬，方便對照右側圖。完成後可切換「自由編輯」修改自己的設計。<\/p>':'')+'<div class="a-grid2"><label>接線名稱<input id="a-net-name" '+(guided?'readonly':'')+' value="'+esc(preset.name??first?.port.name??'')+'" list="a-dialog-nets" placeholder="例如 txd_lane" spellcheck="false"><\/label><label>方向<select id="a-net-direction" '+(guided?'disabled':'')+'>'+['wire','input','output','inout'].map(d=>'<option value="'+d+'" '+(d===kind?'selected':'')+'>'+({wire:'wire · 只在 Top 內部',input:'input · 從 Top 外部輸入',output:'output · 送到 Top 外部',inout:'inout · 雙向介面'}[d])+'<\/option>').join('')+'<\/select><\/label><\/div><label>範圍<input id="a-net-range" '+(guided?'readonly':'')+' value="'+esc(preset.range??range)+'" placeholder="純量留空；[127:0] 或 [`DATA_W-1:0]"><\/label><label>備註<input id="a-net-comment"><\/label><datalist id="a-dialog-nets">'+project.nets.map(n=>'<option value="'+esc(n.name)+'">'+esc(n.range)+'<\/option>').join('')+'<\/datalist><div class="a-note">'+(rows.length?'已選 '+rows.length+' 個 pins。若使用既有 net，沿用它的宣告；若需要切片，建立後可在連線欄輸入 net[63:0]。':'中間線用 wire；只有 input／output／inout 會出現在 Top 介面。')+'<\/div>',rows.length?'預覽接線':'建立宣告',()=>{const name=$('#a-net-name',dialog).value.trim(),r=$('#a-net-range',dialog).value.trim(),d=$('#a-net-direction',dialog).value,comment=$('#a-net-comment',dialog).value;if(guided&&(name!==preset.name||r!==preset.range||d!==kind))throw Error('練習請使用圖上的 '+preset.name+' 與預設方向／位寬；自訂接線請切換自由編輯。');if(!C.validName(name))throw Error('請輸入有效的 net 名稱。');const exists=project.nets.find(n=>n.name===name);if(exists&&!rows.length)throw Error('這個名稱已存在。');if(exists&&(exists.direction!==d||String(exists.range||'').replace(/\s/g,'')!==r.replace(/\s/g,'')))throw Error('既有 '+name+' 的宣告為 '+exists.direction+' '+(exists.range||'1 bit')+'。請選擇相符方向／範圍，或換一個名稱；不會默默忽略你的設定。');if(!exists)C.parseRange(C.expandDefines(r,project),topContext());const ns=exists?[]:[{id:uid(),name,range:r,direction:d,signed:false,comment,group:''}];if(rows.length)changePlan('預覽命名接線',rows.map(x=>({instance:x.instance,port:x.port.name,expr:name})),ns);else{commit(()=>{project.nets.push(...ns);project.orgEdited=true;});dialog.close();}});}
  function expose(){const rows=selectedRows();const changes=[],ns=[],names=new Set(project.nets.map(n=>n.name));for(const r of rows){let name=r.port.name;if(names.has(name))name=r.instanceName+'_'+r.port.name;let base=name,n=1;while(names.has(name))name=base+'_'+n++;names.add(name);ns.push({id:uid(),name,range:effectiveRange(r),direction:r.port.direction,signed:!!r.port.signed,comment:r.port.comment||'',group:r.instanceName});changes.push({instance:r.instance,port:r.port.name,expr:name});}changePlan('預覽提升為 Top ports',changes,ns);}
  function slicePlan(){const rows=selectedRows();if(!rows.length)return;let order=rows.map(r=>r.key);
    openDialog('批次分配 bus 切片','<div class="r119-grid3"><label>Bus 名稱<input id="a-slice-name" value="data_bus"></label><label>起始 bit<input id="a-slice-start" type="number" min="0" value="0"></label><label>分配方向<select id="r119-slice-direction"><option value="up">由低位往高位</option><option value="down">由高位往低位</option></select></label></div><p>可調整接腳順序。依有效位寬連續分配，下一步核對每筆切片與宣告範圍。</p><div id="r119-slice-order"></div>','預覽切片',()=>{const plan=R119.slices(project,order,{name:$('#a-slice-name',dialog).value.trim(),start:Number($('#a-slice-start',dialog).value),direction:$('#r119-slice-direction',dialog).value});changePlan('核對切片順序與範圍',plan.changes,plan.nets);});
    function draw(){const host=$('#r119-slice-order',dialog);host.innerHTML=order.map((key,n)=>{const row=rows.find(r=>r.key===key);return '<div class="r119-preview-order"><code>'+esc(row.instanceName+'.'+row.port.name)+'</code><span>'+esc(pinRange(row))+'</span><button type="button" data-r119-up="'+n+'" '+(!n?'disabled':'')+' aria-label="上移 '+esc(row.port.name)+'">↑</button><button type="button" data-r119-down="'+n+'" '+(n===order.length-1?'disabled':'')+' aria-label="下移 '+esc(row.port.name)+'">↓</button></div>';}).join('');host.querySelectorAll('button').forEach(b=>b.onclick=()=>{const n=Number(b.dataset.r119Up??b.dataset.r119Down),to=n+(b.dataset.r119Up!==undefined?-1:1);[order[n],order[to]]=[order[to],order[n]];draw();});}draw();
  }
  function saveProject(){if(dialog.open){const message='尚未送出專案下載：請先套用或關閉目前視窗，再按 Ctrl+S。';const error=$('#a-dialog-error',dialog);if(error){error.textContent=message;error.hidden=false;}else toast(message);return false;}document.activeElement?.blur();saveState();if(pendingField&&!pendingField.element.isConnected){tab=pendingField.tab;view(pendingField.currentView);render();}if(pendingField?.element?.id==='r124-name'){toast('名稱尚未套用；請修正紅色欄位，或 Esc 取消，再儲存專案。');pendingField.element.focus({preventScroll:true});return false;}if(pendingField?.element?.dataset.wireName){toast('線名尚未套用；請修正後按 Enter，或 Esc 取消，再儲存專案。');pendingField.element.focus({preventScroll:true});return false;}if(pendingField){toast('尚未儲存：請先修正紅色欄位，或按 Esc 取消。');pendingField.element?.focus({preventScroll:true});return false;}if(window.WIUBridge?.prepareSave?.()===false)return false;const data=workbookSnapshot(),name=(sessionKind==='practice'?'practice-':'')+filename()+'.wiu.json';download(name,asciiJson(data),'application/json');saved=JSON.stringify(project);downloadState.project=saved;Object.assign(saveRecord(),{downloadAt:new Date().toISOString(),downloadName:name});render();notifySaveState();toast('專案下載已送出：'+name+'。請在裝置下載列表確認；本機草稿與下載檔分開保存。');return true;}
  function topViewTabs(active){return '<nav class="r119-view-tabs" aria-label="Top 檢視"><button data-action="wb-open" data-id="top" '+(active==='io'?'aria-current="page"':'')+'>Top I/O</button><button data-action="wb-graph" '+(active==='graph'?'aria-current="page"':'')+'>接線圖</button><button data-action="graph-table" '+(active==='table'?'aria-current="page"':'')+'>接線表</button></nav>';}
  function reconcileHistorySelection(){const valid=new Set(A.pinRows(project).map(r=>r.key));selected=new Set([...selected].filter(k=>valid.has(k)));if(!valid.has(focusedPin))focusedPin='';}
  function showHistoryEffect(entry,reverse){
    const a=JSON.parse(reverse?entry.after:entry.before),b=project;
    const changed=b.instances.filter(i=>JSON.stringify(i)!==JSON.stringify(a.instances.find(x=>x.id===i.id))),bindings=b.connections.filter(c=>JSON.stringify(c)!==JSON.stringify(a.connections.find(x=>x.id===c.id)));
    lastHistoryEffect={label:entry.label,instances:changed.map(i=>i.id),keys:bindings.map(c=>c.instance+'::'+c.port)};
    for(const el of $$('[data-row-key],[data-graph-drag],[data-action="ux-pin"]',shell)){const id=el.dataset.rowKey||el.dataset.id||el.dataset.graphDrag;if(lastHistoryEffect.instances.includes(id)||lastHistoryEffect.keys.includes(id)){el.classList.add('r119-history-feedback');setTimeout(()=>el.classList.remove('r119-history-feedback'),2500);}}
    if(changed.length===1&&tab==='graph'){selectGraphInstance(changed[0].id);const b=$$('[data-graph-drag]',shell).find(e=>e.dataset.graphDrag===changed[0].id);b?.classList.add('r119-history-feedback');setTimeout(()=>b?.classList.remove('r119-history-feedback'),2500);}
  }
  function reviewSourceConflicts(rows,state,proceed,back){
    const conflicts=rows.filter(f=>f.role==='rtl'&&project.workbook.guiEditedSources?.[f.name]&&project.rtlSources.find(s=>s.name===f.name)?.text!==f.text);
    if(!conflicts.length){proceed();return;}
    const saved={...state.sourceChoices};
    openDialog('核對 GUI 修改與新 RTL','<p>下列檔案在 GUI 修改過介面。請逐檔選擇保留目前完整 RTL，或採用新匯入的完整 RTL。選擇作用於整份來源，包括同檔其他 modules；不會自動合併實作內容。</p>'+conflicts.map((f,n)=>{const base=project.workbook.guiEditedSources[f.name];return '<section class="a-card"><b>'+esc(f.name)+'</b><p>'+esc(f.text===base.baseText?'匯入來源仍是 GUI 修改前的版本。':'GUI 與匯入來源都已變更。')+'</p><label>保留版本<select data-r119-source-choice="'+n+'"><option value="">請選擇</option><option value="current">保留目前 GUI 修改後的完整 RTL</option><option value="incoming">採用新匯入的完整 RTL</option></select></label><details><summary>比較完整來源</summary><div class="r118-layout-compare"><label>目前 RTL<textarea readonly>'+esc(project.rtlSources.find(s=>s.name===f.name)?.text)+'</textarea></label><label>匯入 RTL<textarea readonly>'+esc(f.text)+'</textarea></label></div></details></section>';}).join(''),'繼續核對介面',()=>{for(const [n,f]of conflicts.entries()){const choice=$('[data-r119-source-choice="'+n+'"]',dialog).value;if(!choice)throw Error('請選擇 '+f.name+' 的保留版本。');state.sourceChoices[f.name]=choice;if(choice==='current')f.text=project.rtlSources.find(s=>s.name===f.name).text;}proceed();});
    conflicts.forEach((f,n)=>{const el=$('[data-r119-source-choice="'+n+'"]',dialog);el.value=saved[f.name]||'';el.onchange=()=>state.sourceChoices[f.name]=el.value;});if(back){const b=document.createElement('button');b.textContent='← 返回修改材料';b.onclick=back;$('.a-dialog-foot',dialog).prepend(b);}
  }
  function sourceFiles(){return [...(project.rtlSources||[]).map(f=>({path:f.name,text:f.text,role:'RTL',description:'專案保存的完整 RTL 來源'})),...D.normalize(project.defineConfig).includes.map(f=>({path:f.name,text:f.text,role:'include',description:'RTL 引用檔原文'})),{path:D.fileName(project),text:K.header(D.normalize(project.defineConfig)),role:'Defines',description:'目前啟用的 Defines'}];}
  function renderSources(){const files=sourceFiles();return E.heading('來源','來源檔案','完整 RTL、include 與目前 Defines。')+'<div class="a-toolbar"><button data-action="import-rtl">＋ 匯入／補齊材料</button><button data-tab="defines">編輯 Defines</button><button data-action="config-profiles">切換具名組態</button></div><div class="a-tablebox"><table class="a-table r119-source-list"><thead><tr><th>路徑</th><th>用途</th><th>使用者／依賴</th><th>大小</th><th></th></tr></thead><tbody>'+files.map((f,n)=>{const users=project.modules.filter(m=>(m.sourceFilename||m.filename)===f.path||(m.includeDependencies||[]).some(x=>(typeof x==='string'?x:x.name||x.path)===f.path));return '<tr><td><code>'+esc(f.path)+'</code>'+(project.workbook.guiEditedSources?.[f.path]?'<small>GUI 已修改介面</small>':'')+'</td><td>'+f.role+'</td><td>'+esc(users.map(m=>m.name).join(', ')||'組態／輔助來源')+'</td><td>'+new TextEncoder().encode(f.text).length+' B</td><td><button data-action="source-preview" data-id="'+n+'">查看／複製</button></td></tr>';}).join('')+'</tbody></table></div>'+issueList(issues().filter(i=>/INCLUDE|PREPROCESS|DEFINE/.test(i.code)));}
  function sourcePreview(index){const files=sourceFiles();flowUI.showFiles(files,Number(index)||0);}
  function pasteConnections(text=''){
    const row=A.pinRows(project).find(r=>r.port.direction==='input')||A.pinRows(project)[0],net=project.nets.find(n=>n.direction==='input')||project.nets[0];
    const example=row?row.instanceName+'.'+row.port.name+'\t'+(net?.name||"1'b0"):'example_inst.enable\t1\'b1';
    openDialog('貼上接線表','<p>每行兩欄：<b>instance.pin</b>、<b>連線運算式</b>。從試算表複製會保留 Tab；也接受第一個空白後為完整運算式。NC＝刻意不接，UNSET＝清除設定。</p><button id="r126-copy-example">複製 Tab 範例</button><small>範例需依你的訊號與位寬調整。</small><label>接線表<textarea id="r119-paste-connections" rows="10" spellcheck="false" placeholder="'+esc(example)+'">'+esc(text)+'</textarea></label>','預覽批次接線',()=>reviewPastedConnections($('#r119-paste-connections',dialog).value));
    $('#r126-copy-example',dialog).onclick=()=>safe(async()=>{await navigator.clipboard.writeText(example);toast('已複製兩欄 Tab 範例。');});
  }
  function reviewPastedConnections(text){
    const before=JSON.stringify(project),plan=R119.pastedConnections(project,text);
    openDialog('核對並修正接線列','<p>來源 → 目的依接腳方向顯示；紅色列可直接修改。</p>'+plan.errors.map(e=>'<p class="a-note a-warn">'+esc(e)+'</p>').join('')+'<div class="a-tablebox"><table class="a-table"><thead><tr><th>行</th><th>instance.pin</th><th>連線</th><th>來源 → 目的／錯誤</th></tr></thead><tbody>'+plan.rows.map((r,i)=>'<tr><td>'+r.line+'</td><td><input data-paste-pin="'+i+'" aria-label="第 '+r.line+' 行接腳" value="'+esc(r.name)+'" aria-invalid="'+!!r.errors.length+'"></td><td><input data-paste-expr="'+i+'" aria-label="第 '+r.line+' 行連線" value="'+esc(r.raw)+'" aria-invalid="'+!!r.errors.length+'"></td><td>'+esc(r.errors.length?r.errors.join('；'):r.source+' → '+r.destination)+'</td></tr>').join('')+'</tbody></table></div>','重新檢查／套用',()=>{
      if(JSON.stringify(project)!==before)throw Error('專案已變更，請重新預覽。');const revised=$$('[data-paste-pin]',dialog).map(el=>el.value+'\t'+$('[data-paste-expr="'+el.dataset.pastePin+'"]',dialog).value).join('\n'),review=R119.pastedConnections(project,revised);
      if(review.errors.length||JSON.stringify(review.changes)!==JSON.stringify(plan.changes)){reviewPastedConnections(revised);return;}
      if(!review.changes.length)throw Error('沒有可套用的接線。');commit(()=>{A.applyConnections(project,review.changes);project.orgEdited=true;},'已整批套用接線；可一次復原。',{scope:'top',label:'批次接線 '+review.changes.length+' 列'});dialog.close();
    });
  }

  function candidateForm(key){
    const candidates=R119.netCandidates(project,key),row=A.pinRows(project).find(r=>r.key===key);if(!row)return;
    openDialog('選擇 '+row.instanceName+'.'+row.port.name+' 的 net','<p>'+esc(row.port.direction+' · '+pinRange(row))+'。完整 net 會核對位寬與驅動；需要切片時可使用下方運算式入口。</p><input id="r119-net-search" placeholder="搜尋 net…" aria-label="搜尋相容 net"><div class="a-tablebox"><table class="a-table"><thead><tr><th>net</th><th>方向／位寬</th><th>既有驅動</th><th>相容性</th></tr></thead><tbody>'+candidates.map((n,i)=>'<tr data-r119-net-row="'+esc(n.name.toLowerCase())+'"><td><button type="button" data-r119-net-index="'+i+'" '+(n.errors.length?'disabled':'')+'>'+esc(n.name)+'</button></td><td>'+esc(n.direction+' '+n.range)+'</td><td>'+esc(n.drivers.join(', ')||'尚無來源')+'</td><td>'+esc(n.errors.join('；')||'可連接，套用前核對')+'</td></tr>').join('')+'</tbody></table></div><button data-action="connection-expression" data-id="'+esc(key)+'">輸入切片／拼接／運算式</button>');
    $('#r119-net-search',dialog).oninput=e=>{for(const tr of $$('[data-r119-net-row]',dialog))tr.hidden=!tr.dataset.r119NetRow.includes(e.target.value.toLowerCase());};
    for(const b of $$('[data-r119-net-index]',dialog))b.onclick=()=>changePlan('核對 net 接線',[{instance:row.instance,port:row.port.name,expr:candidates[Number(b.dataset.r119NetIndex)].name}]);
  }
  function groupMatchForm(){
    let keys=[...selected];if(graphGroupFocus.size)keys=window.WIUWorkflowR118.groupPinKeys(project,window.WIUTopScene.create(project),[...graphGroupFocus]);
    if(!keys.length){toast('先選取一個 Group，或在接線表勾選來源 pins，再按群組配對。');return;}
    const rows=selectedRows(new Set(keys));openDialog('群組接腳配對','<p>來源 '+rows.length+' 個 pins；以名稱、相反方向及有效位寬配對。已接線成員會保留並列為略過。</p><label>目標 instance<select id="r119-group-target">'+project.instances.map(i=>'<option value="'+esc(i.id)+'">'+esc(i.name)+'</option>').join('')+'</select></label><label>忽略名稱前綴（選用，兩端同規則）<input id="r119-group-prefix" placeholder="例如 tx_"></label>','預覽配對',()=>{
      const plan=R119.groupPairs(project,keys,$('#r119-group-target',dialog).value,$('#r119-group-prefix',dialog).value),reserved=new Set(project.nets.map(n=>n.name)),nets=[],changes=[];
      for(const pair of plan.pairs){const a=pair.source,b=pair.target;let name=a.port,n=1;while(reserved.has(name))name=a.port+'_'+n++;reserved.add(name);nets.push({id:uid(),name,range:a.width>1?'['+(a.width-1)+':0]':'',direction:'wire',signed:false,group:'',comment:''});changes.push({instance:a.instance,port:a.port,expr:name},{instance:b.instance,port:b.port,expr:name});}
      if(!changes.length){openDialog('沒有可套用的群組配對','<ul>'+plan.skipped.map(x=>'<li>'+esc(x.name+'：'+x.reason)+'</li>').join('')+'</ul>');return;}
      changePlan('核對群組配對 · '+plan.pairs.length+' 組',changes,nets);if(plan.skipped.length){const note=document.createElement('div');note.className='a-note';note.innerHTML='<b>保留未配對成員</b><ul>'+plan.skipped.map(x=>'<li>'+esc(x.name+'：'+x.reason)+'</li>').join('')+'</ul>';$('.a-dialog-content',dialog).prepend(note);}
    });
  }
  function configProfiles(){
    const cfg=window.WIUBundle.normalize(project.bundleConfig),profiles=project.workbook.defineProfiles||cfg.profiles||[],returnView={view:currentView,module:activeModule,tab},before=JSON.stringify(project);
    const returnToWork=()=>{dialog.close();if(returnView.view==='diagram')openSheet(returnView.module);else go(returnView.tab);};
    openDialog('具名 Defines 組態','<p>保存或切換 ASIC／FPGA／專案組態。切換先核對接腳與位寬，完成後返回原本工作位置。</p><label>保存名稱<input id="r119-profile-name" placeholder="例如 ASIC、FPGA"></label><button id="r119-profile-save">保存目前組態</button><h3>已保存</h3><div id="r119-profile-list">'+profiles.map((p,i)=>'<button data-r119-profile="'+i+'">'+esc(p.name)+' · '+(p.defineConfig?.rows||[]).filter(r=>r.enabled!==false).length+' Defines</button>').join('')+(profiles.length?'':'<p>尚無具名組態。先設定 Defines，再保存。</p>')+'</div>');
    $('#r119-profile-save',dialog).onclick=()=>safe(()=>{const name=$('#r119-profile-name',dialog).value.trim();if(!name)throw Error('請輸入組態名稱。');if(profiles.some(p=>p.name===name))throw Error('名稱已存在，請使用另一個名稱。');commit(()=>{project=R119.saveProfile(project,name);},'已保存組態 '+name,{scope:'project',label:'保存組態 '+name});configProfiles();});
    for(const b of $$('[data-r119-profile]',dialog))b.onclick=()=>safe(()=>{const profile=profiles[Number(b.dataset.r119Profile)],plan=D.plan(project,profile.defineConfig,P),impact=window.WIUImportReview.compareInterfaces(project,plan.project);openDialog('切換組態 · '+profile.name,'<p>'+plan.defineChanges.length+' 個 Defines 變化 · '+impact.changed.length+' 個接腳／位寬變化。</p><ul>'+plan.defineChanges.map(x=>'<li>'+esc(x.name+'：'+x.before+' → '+x.after)+'</li>').join('')+'</ul>'+interfaceImpactTable(impact.changed)+issueList(impact.errors),'套用並返回原位置',()=>{if(JSON.stringify(project)!==before)throw Error('專案已變更，請重新預覽。');commit(()=>{project=plan.project;},'組態已切換為 '+profile.name,{scope:'project',label:'切換組態 '+profile.name});returnToWork();});});
  }
  function interfaceImpactTable(rows){return '<div class="a-tablebox"><table class="a-table"><thead><tr><th>接腳</th><th>目前</th><th>變更後</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.instanceName+'.'+r.port)+'</td><td>'+esc(r.before?(r.before.direction+' '+r.before.range):'不存在')+'</td><td>'+esc(r.after?(r.after.direction+' '+r.after.range):'不存在')+'</td></tr>').join('')+'</tbody></table></div>';}
  function changeInstanceLayout(id,patch){
    const scene=window.WIUTopScene.create(project);graphNeedsPrepare=false;
    commit(()=>window.WIUInstanceLayout.set(project,id,patch,scene.placed),'已更新此實例圖面；RTL 接線不變，可一次復原。',{label:'調整 instance 版型',scope:'top'});
  }
  function toggleLayoutLock(){const id=graphObject?.kind==='instance'?graphObject.id:'';if(!id){toast('先選取要鎖定的 Block。');return;}commit(()=>{const locks=new Set(project.workbook.layoutLocks||[]);locks.has(id)?locks.delete(id):locks.add(id);project.workbook.layoutLocks=[...locks];},'已更新自動排列鎖定。',{label:'切換 Block 排列鎖定',scope:'top'});}
  function scopedLayoutForm(){
    const G=window.WIUTopScene,Ly=window.WIUGraphLayout,before=JSON.stringify(project),scene=G.create(project),locks=new Set(project.workbook.layoutLocks||[]),chosen=graphObject?.kind==='instance'?graphObject.id:'';
    openDialog('整理指定 Block','<p>只移動勾選的 Block；鎖定與未勾選的位置、Top ports 順序保持。手動線路保留，僅隨移動的端點延伸，套用後可查看圖面檢查。</p><div class="a-actions"><button id="r119-layout-all">選取全部未鎖定</button></div>'+scene.placed.map(b=>'<label><input type="checkbox" data-r119-layout="'+esc(b.instance.id)+'" '+(locks.has(b.instance.id)?'disabled':!chosen||chosen===b.instance.id?'checked':'')+'> '+esc(b.instance.name)+(locks.has(b.instance.id)?' · 已鎖定':'')+'</label>').join(''),'預覽局部排列',()=>{
      const ids=new Set($$('[data-r119-layout]:checked',dialog).map(el=>el.dataset.r119Layout));if(!ids.size)throw Error('請選取至少一個未鎖定 Block。');const next=A.clone(project);next.workbook.graphAutoR99=G.capture(project);const moving=scene.placed.filter(b=>ids.has(b.instance.id)),fixed=scene.placed.filter(b=>!ids.has(b.instance.id)),placed=fixed.slice();let x=Math.min(...moving.map(b=>b.x)),y=Math.min(...moving.map(b=>b.y));
      for(const b of moving){while(placed.some(o=>x<o.x+o.width+90&&x+b.width+90>o.x&&y<o.y+o.height+90&&y+b.height+90>o.y)){y=Math.max(...placed.filter(o=>x<o.x+o.width+90&&x+b.width+90>o.x&&y<o.y+o.height+90&&y+b.height+90>o.y).map(o=>o.y+o.height+100));}Ly.move(next,b.instance.id,x,y);placed.push({...b,x,y});y+=b.height+110;}
      const after=G.create(next,{fast:true}),moved=after.placed.filter(b=>{const old=scene.placed.find(x=>x.instance.id===b.instance.id);return old.x!==b.x||old.y!==b.y;});
      if(fixed.some(b=>{const n=after.placed.find(x=>x.instance.id===b.instance.id);return n.x!==b.x||n.y!==b.y;}))throw Error('局部排列會影響其他 Block，未套用。');
      const img=s=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(G.svg(s));openDialog('核對局部排列','<p>將移動 '+moved.length+' 顆 Block，未選取／鎖定的 '+fixed.length+' 顆保持位置。</p><div class="r118-layout-compare"><figure><figcaption>目前</figcaption><img src="'+img(scene)+'"></figure><figure><figcaption>預覽</figcaption><img src="'+img(after)+'"></figure></div>','套用局部排列',()=>{if(JSON.stringify(project)!==before)throw Error('專案已變更，請重新預覽。');commit(()=>{project=next;},'已套用局部排列。',{scope:'top',label:'整理指定 Block'});dialog.close();});
    });$('#r119-layout-all',dialog).onclick=()=>$$('[data-r119-layout]:not(:disabled)',dialog).forEach(el=>el.checked=true);
  }
  let recentDownload=null;
  function showRecentDownload(){if(!recentDownload){toast('目前尚無已產生的下載。');return;}const f=recentDownload;openDialog('最近一次匯出','<p><b>'+esc(f.name)+'</b> · '+f.bytes+' bytes</p><p>已送出下載，請在裝置下載列表確認。重試會使用同一次產生的內容。</p><div class="a-actions"><button id="r119-download-again">再次下載同一檔案</button>'+(f.text!=null?'<button id="r119-download-preview">查看／複製完整內容</button>':'')+'</div>');$('#r119-download-again',dialog).onclick=()=>download(f.name,f.data,f.type);if(f.text!=null)$('#r119-download-preview',dialog).onclick=()=>flowUI.showFiles([{path:f.name,text:f.text,description:f.name.endsWith('.vbs')?'文字備援為 UTF-8；原 VBS 下載保留 UTF-16LE 編碼。':'最近一次匯出的完整內容'}]);}

  const actions={
    'net-nav-list':b=>chooseEndpoint(b.dataset.kind),
    'net-nav-go':b=>navigateEndpoint(b.dataset.kind,b.dataset.id),
    'net-nav-step':b=>stepLoad(Number(b.dataset.delta)),
    'net-nav-back':returnNetView,
    'net-nav-assign':()=>{dialog.close();go('assigns');},
    'paste-connections':()=>pasteConnections(), 'group-match':groupMatchForm,'source-preview':b=>sourcePreview(b.dataset.id),'clear-hidden-selection':()=>{const visible=new Set($$('[data-pin-select]',shell).map(el=>el.dataset.pinSelect));selected=new Set([...selected].filter(k=>visible.has(k)));render();},
    'check-scope':b=>{checkScope=b.dataset.id;go('check');},'layout-scope':scopedLayoutForm,'layout-lock':toggleLayoutLock,'config-profiles':configProfiles,'recent-download':showRecentDownload,
    'net-candidates':b=>candidateForm(b.dataset.id),
    'r121-rtl-preview':()=>document.getElementById('r69-diagram-rtl')?.click(),
    'r121-rename':()=>focusHeaderName(activeModule),
    'canvas-vbs':()=>{const target=outputTarget();if(target.kind==='graph')return downloadVisioWithGates();if(currentView==='diagram'&&window.WIUBridge?.prepareSave?.()===false)return;const content=window.WIUBridge.exportSheetVbs(W.makeDiagram(project,target.id),workbookSnapshot()),bytes=new Uint8Array(2+content.length*2),v=new DataView(bytes.buffer);v.setUint16(0,0xfeff,true);for(let i=0;i<content.length;i++)v.setUint16(2+i*2,content.charCodeAt(i),true);download(target.name+'-interface-'+VERSION+'.vbs',bytes,'application/octet-stream');toast('已送出 '+target.name+' 介面 VBS 下載；請在瀏覽器確認檔案。');},
    'canvas-format':b=>{const target=outputTarget();if(target.kind!=='diagram')return;if(currentView!=='diagram'||activeModule!==target.id)openSheet(target.id);if(window.WIUBridge?.prepareSave()===false)return;const id={png:'pngBtn',pdf:'pdfBtn',svg:'svgBtn'}[b.dataset.format];if(id)document.getElementById(id)?.click();},
    'history-open':()=>window.WIUProjectHost?.openHistory?.(),
    'project-name':()=>focusHeaderName('top'),
    'stage-design':()=>lastDesignView==='diagram'?openSheet(lastDesignModule):go(lastDesignTab),
    'diagram-visio':()=>{if(window.WIUBridge?.prepareSave()===false)return;document.getElementById('vbsBtn').click();},
     'graph-view':b=>{graphArtwork=b.dataset.mode==='artwork';render();},
    'graph-crossing-review':()=>showGraphCrossingReview(),
    'graph-jump':b=>jumpGraphIssue(Number(b.dataset.graphX),Number(b.dataset.graphY)),
    'graph-table':b=>openGraphTable(b?.dataset),
    'instance-shape':b=>changeInstanceLayout(b.dataset.id,{shape:b.dataset.shape}),
    'instance-bottom':b=>{const scene=window.WIUTopScene.create(project),others=scene.placed.filter(x=>x.instance.id!==b.dataset.id);graphNeedsPrepare=false;commit(()=>{project.workbook.graphPositions||={};project.workbook.graphPositions[b.dataset.id]={x:Math.min(800,...others.map(x=>x.x)),y:Math.max(130,...others.map(x=>x.y+x.height))+180};delete project.workbook.graphAutoR99;},'已放到底部；可復原。',{scope:'top',label:'長條放到底部'});},
    'instance-compact':b=>changeInstanceLayout(b.dataset.id,{compact:!window.WIUInstanceLayout.settings(project,b.dataset.id).compact,expanded:[]}),
    'graph-background-toggle':()=>{if(graphJob?.status==='running')pauseGraph();else graphJob=null;render();},
    'graph-drawing-cancel':()=>{drawingRunner.cancel();dialog.close();},
    'bar-group-toggle':b=>{const layout=window.WIUInstanceLayout.settings(project,b.dataset.id),scene=window.WIUTopScene.create(project),block=scene.placed.find(x=>x.instance.id===b.dataset.id),set=new Set(layout.compact?layout.expanded||[]:block.barGroups.map(g=>g.key));set.has(b.dataset.group)?set.delete(b.dataset.group):set.add(b.dataset.group);changeInstanceLayout(b.dataset.id,{compact:true,expanded:[...set]});},
    'bar-pin-side':b=>{const e=window.WIUGraphWiring.endpoints(project).find(e=>e.key===b.dataset.id);if(!e?.port)return;const cfg=window.WIUInstanceLayout.settings(project,e.instance);changeInstanceLayout(e.instance,{pinSides:{...cfg.pinSides,[e.port.id]:b.dataset.side}});},
    'graph-select-instance':b=>selectGraphInstance(b.dataset.id),
    'graph-lock-current':toggleLayoutLock,
    'graph-locate-instance':b=>locateGraphInstance(b.dataset.id),
    'graph-group-ports':showGroupPorts,
    'graph-group-batch':()=>{const keys=window.WIUWorkflowR118.groupPinKeys(project,window.WIUTopScene.create(project),[...graphGroupFocus]);if(!keys.length){toast('此 Group 沒有可批次設定的 instance 接腳。');return;}openGraphTable({});selected=new Set(keys);render();toast('已帶入 '+keys.length+' 個組內接腳；請選接線、常數或刻意不接。');},
    'pin-quick-constant':b=>{const row=A.pinRows(project).find(r=>r.key===b.dataset.id);if(!row||row.port.direction==='output')return;const width=C.parseRange(effectiveRange(row),{}).width,value=b.dataset.value==='1'?'1':'0',expr=width+"'d"+value;const trial=A.clone(project);A.applyConnections(trial,[{instance:row.instance,port:row.port.name,expr}]);commit(()=>{project=trial;project.orgEdited=true;},row.instanceName+'.'+row.port.name+' 已接 '+value,{label:'設定 '+row.instanceName+'.'+row.port.name+' 常數',scope:'top'});},
    'interface-impact':()=>{const x=lastInterfaceImpact;if(!x)return;openDialog('共用介面修改影響',interfaceImpactBody(x)+'<button data-action="review">檢查受影響接線</button>');},
    'graph-start-at-pin':b=>{const key=b.dataset.id;if(!window.WIUGraphWiring.endpoints(project).some(e=>e.key===key))return;clearGraphNetFocus();graphQuickConnect=!graphConnectMode;graphConnectMode=true;graphStart=key;refreshGraphConnection();},
    'graph-instance-params':()=>{const id=$('#r95-instance-select',shell)?.value||project.instances[0]?.id;if(id)instanceForm(id);},
    'graph-arrange':()=>previewGraphLayout('arrange'),
    'graph-groups':()=>{graphGroupPanel=!graphGroupPanel;render();},
    'graph-route':()=>commit(()=>{project.workbook.topStyle={...window.WIUDiagramStyle.settings(project),route:window.WIUDiagramStyle.settings(project).route==='curve'?'orthogonal':'curve'};}),
    'graph-repair-jumps':()=>repairGraphJumps(),'graph-repair-fine':()=>previewGraphLayout('fine'),
    'graph-optimize':optimizeGraphRoutes,
    'graph-wire-edit':()=>commit(()=>{const st=window.WIUDiagramStyle.settings(project);project.workbook.topStyle={...st,editWireRoutes:!st.editWireRoutes};}),
    'graph-labels':()=>commit(()=>{const st=window.WIUDiagramStyle.settings(project);project.workbook.topStyle={...st,showWireNames:!st.showWireNames};}),
    'graph-monochrome':()=>commit(()=>{project.workbook.topStyle={...window.WIUDiagramStyle.settings(project),monochrome:!window.WIUDiagramStyle.settings(project).monochrome};}),
    'graph-colors-reset':()=>commit(()=>{project.workbook.topStyle={...window.WIUDiagramStyle.settings(project),colors:{}};}),
    'graph-fullscreen':async button=>{
      if(button.dataset.fullscreenExit!==undefined){
        if(document.fullscreenElement)await document.exitFullscreen();
        if(graphFocus)railOpen=focusRail;
        graphFocus=false;document.body.classList.remove('r82-fullscreen');render();return;
      }
      return presentDrawing();
    },
    'graph-focus':()=>{graphFocus=!graphFocus;if(graphFocus){focusRail=railOpen;railOpen=false;}else railOpen=focusRail;render();},
    'canvas-guide':()=>openDialog('從畫布完成設計',document.getElementById('r81-guide')?.innerHTML||'<p>點兩端接線；再點起點或 Esc 取消。滾輪縮放，Space＋拖曳平移，F 符合畫面。<\/p>'),
    'graph-visio-routed':()=>downloadVisioWithGates('native-routed'),
    'graph-visio-routed-legacy':()=>downloadVisioWithGates('native-routed-legacy'),
    'graph-visio-native':()=>downloadVisioWithGates('native'),
    'graph-visio':()=>downloadVisioWithGates('fixed'),
    'graph-zoom':b=>setGraphZoom(b.dataset.zoom),'graph-add':()=>openDialog('放入 instance','<p>選擇一個模組。加入後會留在接線圖。<\/p>'+project.modules.map(m=>'<button data-action="flow-instances" data-id="'+esc(m.name)+'">＋ '+esc(m.name)+' · '+m.ports.length+' pins<\/button>').join('')+'<hr><button data-action="wb-add">建立子模組<\/button><button data-action="import-rtl">匯入 RTL<\/button>'),'rail-toggle':()=>{if(['check','bundle','export','help'].includes(tab)&&currentView!=='diagram'){go('graph');railOpen=true;}else railOpen=!railOpen;renderWorkbook();if(graphViewportAuto)requestAnimationFrame(()=>setGraphZoom('all',null,true));},
    'diagram-settings':moduleParameters,
    'module-info':()=>{const m=W.moduleOf(project,activeModule),top=activeModule==='top',count=project.instances.filter(i=>i.module===m.name).length,source=m.sourceFilename||m.filename||'',index=sourceFiles().findIndex(f=>f.path===source);
      openDialog(m.name+' · 模組設定','<p>'+(top?'Top 對外介面':m.interfaceOnly?'模組定義 · 介面骨架':'模組定義 · 已匯入 RTL')+'</p><div class="r120-module-settings"><section><h3>模組預設</h3><button data-action="r121-rename" '+(W.editCapabilities(project,activeModule).renameReason?'title="'+esc(W.editCapabilities(project,activeModule).renameReason)+'"':'')+'>修改模組名稱</button><p>編輯這份定義，會影響所有使用它的實例。</p><button data-action="diagram-settings">'+(top?'Top 參數與位寬':'模組預設參數')+'</button></section>'+(!top?'<section><h3>RTL 來源</h3><p>'+esc(source||'尚未匯入正式 RTL')+'</p>'+(index>=0?'<button data-action="source-preview" data-id="'+index+'">查看來源</button>':'')+'<button data-action="module-update-rtl" data-id="'+esc(m.name)+'">'+(m.interfaceOnly?'匯入正式 RTL':'更新 RTL')+'</button></section><section><h3>Top 實例 · '+count+' 顆</h3><p>每顆實例的名稱與參數覆寫，請選取 Top 圖上的 Block 後編輯。</p><button data-action="quick-instance" data-id="'+esc(m.name)+'">＋ 加入 Top 實例</button><button data-action="module-usage" data-id="'+esc(m.id)+'">查看使用情況</button></section>':'')+'</div>');},
    'r122-review':()=>openDialog('公開版說明',window.WIUReleaseReview.html),
    'help-menu':()=>openDialog('說明與練習','<div class="r69-help-options"><button data-tool-action="r122-review"><strong>公開版說明</strong><span>公開範圍與操作方式</span></button><button data-tool-action="canvas-guide"><strong>從畫布完成設計<\/strong><span>Block、Top 接線、成圖與 Visio<\/span><\/button><button data-tool-action="wb-tour"><strong>快速導覽<\/strong><span>認識工作區與主要入口<\/span><\/button><button data-tool-action="wb-practice-intro"><strong>完整範本<\/strong><span>已具備 Top I/O、兩個模組與完整接線<\/span><\/button><button data-tool-tab="help"><strong>操作說明<\/strong><span>查閱接線、組態與交付方式<\/span><\/button><button data-tool-action="tool-directory"><strong>搜尋功能<\/strong><span>依名稱尋找較少使用的操作<\/span><\/button><\/div>'),
    'guide-next':b=>{commit(()=>{project=window.WIUFocusGuide.advance(project,b.dataset.id);tab='lesson';});focusStep();},
    'guide-back':()=>{commit(()=>{project=window.WIUFocusGuide.back(project);tab='lesson';});focusStep();},
    'guide-download':guideDownload,
    'tool-directory':()=>{openDialog('搜尋功能',E.tools());$('#fg-tool-search',dialog)?.focus();},
    'diagram-open':()=>{dialog.close();openSheet('top');},
    'rtl-preview-toggle':()=>{rtlOpen=!rtlOpen;render();const handle=$('.fg-rtl-handle',shell);handle?.focus({preventScroll:true});},
    'rtl-preview-copy':async()=>{const text=C.renderVerilog(project);try{await navigator.clipboard.writeText(text);toast('已複製目前 RTL 預覽。');}catch{const node=$('.fg-rtl-code',shell);if(node&&document.createRange){const range=document.createRange();range.selectNodeContents(node);const selected=window.getSelection();selected.removeAllRanges();selected.addRange(range);toast('已選取 RTL，請按 Ctrl+C 複製。');}else toast('請選取 RTL 預覽內容並複製。');}},
    'review-first-error':()=>{issueQueueIndex=0;locateQueuedIssue();},'issue-queue':()=>toggleIssueQueue(),'history-menu':openHistory,'history-undo':()=>{dialog.close();undo();},'history-redo':()=>{dialog.close();redo();},
    'orphan-remove':b=>confirmAction('移除失效的 pin 綁定','<p>只移除這一筆已不存在的 pin 綁定，nets 保留。若之後切回原組態，需要重新設定該 pin。<\/p>','移除綁定',()=>commit(()=>{project.connections=project.connections.filter(c=>c.id!==b.dataset.id);project.orgEdited=true;})),
    'learning-start':()=>startLearning(false),'learning-legacy-start':()=>startLearning(true),'learning-next':learningNext,'learning-stop':endPractice,
    'ux-home':()=>go('home'),'ux-help':()=>go('help'),'ux-resume':()=>go(L.isLearning(project)?'lesson':priorWorkTab),
    'ux-new':()=>{const start=()=>commit(()=>{project=C.newProject();resetFilters();focusedPin='';lessonTask='';tab='setup';});if(project.instances.length||project.modules.length||project.nets.length||dirty())confirmAction('建立新的 Top 設計','<p>目前設計可先下載專案檔保存。建立後仍可按復原回到原來的設計。<\/p>','建立新設計',start);else start();},
    'ux-free-edit':()=>{resetFilters();connectionView='cards';go('graph');},
    'ux-lesson-task':b=>{lessonTask=b.dataset.id;commit(()=>{project.learningGuide={version:59,step:b.dataset.id};tab='lesson';});},
    'ux-connection-view':b=>{connectionView=b.dataset.kind==='table'?'table':'cards';if(connectionView==='cards'){const chosen=A.pinRows(project).find(r=>selected.has(r.key)&&(!instanceFilter||r.instance===instanceFilter));if(chosen){focusedPin=chosen.key;instanceFilter=chosen.instance;}}render();},
    'ux-pin':b=>{focusedPin=b.dataset.id;render();if(window.matchMedia?.('(max-width: 960px)').matches){const panel=$('.ux-pin-inspector',shell);panel?.scrollIntoView?.({block:'start',behavior:'smooth'});panel?.setAttribute('tabindex','-1');panel?.focus({preventScroll:true});}},
    'ux-unset':b=>{const r=A.pinRows(project).find(r=>r.key===b.dataset.id);if(r)changePlan('取消接腳設定',[{instance:r.instance,port:r.port.name,expr:null}]);},
    'ux-delivery':b=>{exportTab='verilog';go(b.dataset.kind==='company'?'bundle':'export');},
    'pin-connect':b=>connectionChooser(b.dataset.id),
    'connection-expression':b=>actions['connection-choice']({dataset:{id:b.dataset.id,kind:'advanced'}}),
    'connection-choice':b=>{const key=b.dataset.id,row=A.pinRows(project).find(r=>r.key===key),keys=new Set([key]);if(!row)return;if(b.dataset.kind==='expression'){candidateForm(key);return;}if(b.dataset.kind==='advanced')openDialog('接線式 · '+esc(row.instanceName+'.'+row.port.name),'<label>Net 或接線式<input id="r77-expression" list="r77-net-list" spellcheck="false" value="'+esc(row.expr||'')+'" placeholder="例如 payload[31:0] 或 {hi, lo}"><\/label><datalist id="r77-net-list">'+project.nets.map(n=>'<option value="'+esc(n.name)+'">'+esc(n.direction+' '+n.range)+'<\/option>').join('')+'<\/datalist><p>可直接輸入切片／拼接，不需使用連線表。套用前檢查方向、位寬與多重驅動。<\/p>','套用接線',()=>{const expr=$('#r77-expression',dialog).value.trim();if(!expr)throw Error('請輸入接線式；留空請用「刻意不接 NC」');const trial=A.clone(project);A.applyConnections(trial,[{instance:row.instance,port:row.port.name,expr}]);const prior=new Set(C.validate(project).filter(i=>i.severity==='error').map(i=>JSON.stringify(i))),added=C.validate(trial).filter(i=>i.severity==='error'&&!prior.has(JSON.stringify(i)));if(added.length)throw Error(added.map(i=>i.message).join('；'));commit(()=>{project=trial;project.orgEdited=true;});dialog.close();});else if(b.dataset.kind==='peer')pairForm(key);else if(b.dataset.kind==='external')newNetForm(row.port.direction,keys);else if(b.dataset.kind==='internal')newNetForm('wire',keys);else if(b.dataset.kind==='constant')constantForm(keys);else changePlan('預覽刻意不接 NC',[{instance:row.instance,port:row.port.name,expr:''}]);},
    workflow:b=>{if(b.dataset.stage==='0'){if(!project.modules.length){tab='start';render();}else{tab='connections';resetFilters();render();$('.a-sidebar',shell)?.scrollTo?.(0,0);}}else{tab=b.dataset.stage==='1'?'connections':'export';render();}},
    'clear-filters':()=>{if(graphTableOrigin)delete graphTableOrigin.pinKey;filter='';instanceFilter='';onlyUnbound=false;render();},'clear-selection':()=>{selected.clear();render();},
    'next-pending':()=>{const rows=A.pinRows(project),current=rows.findIndex(r=>r.key===focusedPin),candidates=rows.slice(current+1).concat(rows.slice(0,current+1)),row=candidates.find(r=>r.expr==null);if(!row){toast('沒有未設定的接腳。可以前往「檢查設計」。');return;}resetFilters();focusedPin=row.key;instanceFilter=row.instance;tab='connections';render();if(connectionView==='table')connectionChooser(row.key);else $('.ux-pin-inspector',shell)?.scrollIntoView?.({block:'nearest'});},
    undo,redo,readme,manual:readme,save:saveProject,load:()=>pick('project'),review:()=>go('check'),
    new:()=>confirmAction('建立新組裝','<p>清空目前組裝。尚未下載的修改可先按關閉並儲存；清空後也能復原。<\/p>','建立新專案',()=>commit(()=>{project=C.newProject();resetFilters();tab='connections';})),
    demo:()=>confirmAction('載入功能示範','<p>以示範資料取代目前組裝：reset 反相、多個 64-bit 切片合成 128-bit bus、ready=1、valid=0 與輸出留空。這是測試 fixture，並非公司原始設計。<\/p>','載入示範',()=>commit(()=>{project=C.demoProject();resetFilters();tab='connections';})),
    restore:()=>{const d=draft;if(!d)return;const p=W.normalize(d.project);if(L.isLearning(p)||p.flow?.tutorial){beginPractice(p,L.isLearning(p)?'lesson':'connections');}else{commit(()=>{project=p;draft=null;});restoreWorkspace(d.workspace||{tab:'graph'});}},
    'discard-draft':()=>{draft=null;render();},'import-rtl':()=>importDialog('rtl'),'import-org':()=>importDialog('org'),
    'graph-find':()=>window.WIUProjectHost.findInModule('find'),'graph-copy':()=>graphCommand('copy'),'graph-paste':()=>graphCommand('paste'),'graph-duplicate':()=>graphCommand('duplicate'),'graph-delete':()=>graphCommand('delete'),
    'instance-add':b=>instanceForm(null,b.dataset.id),'instance-edit':b=>instanceForm(b.dataset.id),
    'module-update-rtl':b=>importDialog('rtl',b.dataset.id),
    'module-usage':b=>{const m=W.moduleOf(project,b.dataset.id),used=project.instances.filter(i=>i.module===m.name);
      openDialog(m.name+' · Top 直接使用 '+used.length+' 顆',used.length?'<p>選擇要在 Top 接線圖定位的 instance。</p>'+used.map(i=>'<button class="a-card a-mono" data-action="graph-locate-instance" data-id="'+esc(i.id)+'">'+esc(i.name)+'</button>').join(''):'<p>Top 沒有直接放入這份模組定義。</p>');},
    'module-delete':b=>{const m=project.modules.find(x=>x.name===b.dataset.id);if(!m)return;
      window.WIUBridge?.finish();
      const before=JSON.stringify(project);let removal;try{removal=W.retireModule(project,m.id,{cascade:true});}catch(e){openDialog('無法移除 '+m.name,'<p>'+esc(e.message)+'</p>'+((project.instances.some(i=>i.module===m.name))?'<button data-action="module-usage" data-id="'+esc(m.id)+'">查看 Top 使用位置</button>':'<button data-action="import-rtl">更新 RTL 來源</button>'));return;}
      const effects=removal.changes.map(c=>'<li><code>'+esc(c.filename)+'</code> · '+(c.kept?'保留來源中的其他內容'+(c.siblings.length?'（'+esc(c.siblings.join('、'))+'）':''):'移出專案來源與編譯清單')+'</li>').join('');
      const removed=removal.removedInstances,bindings=removed.reduce((n,r)=>n+r.connections.length+r.disconnected.length,0);
      const impact='<p>將刪除 <strong>'+esc(m.name)+'</strong> 模組定義與介面圖'+(removed.length?'，以及 Top 中使用它的 '+removed.length+' 顆 instances 和 '+bindings+' 筆相關接腳綁定':'；目前 Top 沒有使用它')+'。</p>'+
        (removed.length?'<ul>'+removed.map(r=>'<li><code>'+esc(r.instance.name)+'</code></li>').join('')+'</ul>':'')+
        '<p>這是一筆操作：Undo 一次還原模組、instances、接線與圖面位置；Redo 再次刪除。</p>';
      confirmAction('刪除模組 '+m.name+'？',impact+(effects?'<details><summary>RTL 來源變更</summary><ul>'+effects+'</ul></details>':''),removed.length?'刪除模組與 Top 接線':'刪除此模組',()=>{
        if(JSON.stringify(project)!==before)throw Error('專案已變更，請重新確認刪除操作。');
        activeModule='top';lastDesignModule='top';lastDesignView='assembly';lastDesignTab='graph';tab='graph';view('assembly');
        finishGraphConnection();graphObject=null;graphNetFocus.clear();graphDirectNetFocus.clear();graphGroupFocus.clear();resetFilters();
        commit(()=>{project=removal.project;},'已刪除 '+m.name+(removed.length?' 及 '+removed.length+' 顆 instances 與相關接線':'')+'；Ctrl+Z 復原。',{scope:'project',label:'刪除模組 '+m.name});
      });},
    'instance-filter':b=>{instanceFilter=b.dataset.id;tab='connections';render();},
    'instance-delete':b=>{
      const id=b.dataset.id,i=project.instances.find(item=>item.id===id);if(!i)return;
      const before=JSON.stringify(project),impact=A.removeInstance(A.clone(project),id);
      const other=project.instances.filter(item=>item.module===i.module&&item.id!==id).length;
      const peers=impact.disconnected.map(c=>(project.instances.find(item=>item.id===c.instance)?.name||c.instance)+'.'+c.port);
      const details='<p>將移除此 instance 與 '+impact.connections.length+' 筆接腳綁定。</p>'+
        (peers.length?'<p>另有 '+peers.length+' 筆接收端綁定將因失去來源而清除，接腳回到待設定。</p><ul>'+peers.map(name=>'<li><code>'+esc(name)+'</code></li>').join('')+'</ul>':'')+
        (impact.nets.length?'<p>清除 '+impact.nets.length+' 條已無引用的自動產生內部線。</p>':'')+
        (impact.assigns.length?'<p>清除 '+impact.assigns.length+' 筆由接線圖產生的對外接線 assign。</p>':'')+
        '<p><code>'+esc(i.module)+'</code> 另外有 '+other+' 顆 instance。可按 Ctrl+Z 復原此次移除。</p>';
      confirmAction('從 Top 移除 '+i.name+'？',details,'從 Top 移除此顆',()=>{
        if(JSON.stringify(project)!==before)throw Error('專案已變更，請重新確認移除操作。');
        commit(()=>removeGraphInstance(id),'已移除 '+i.name+' 與相關接線，可按 Ctrl+Z 復原。');
      });
    },
    'module-view':b=>{const m=project.modules.find(m=>m.name===b.dataset.id);openDialog('Module / '+m.name,'<div class="a-tablebox"><table class="a-table"><thead><tr><th>PORT<\/th><th>方向<\/th><th>範圍<\/th><\/tr><\/thead><tbody>'+m.ports.map(p=>'<tr><td>'+esc(p.name)+'<\/td><td>'+esc(p.direction)+'<\/td><td>'+esc(p.range||'1 bit')+'<\/td><\/tr>').join('')+'<\/tbody><\/table><\/div>'+issueList(m.issues||[])+'<pre>'+esc(m.source||'示範模型；未附原始 RTL')+'<\/pre>');},
    'net-add':b=>newNetForm(b.dataset.kind),'batch-net':()=>newNetForm('wire',selected),'pin-net':b=>newNetForm('wire',new Set([b.dataset.id])),
    'net-delete':b=>{const plan=A.planRemoveNets(project,[b.dataset.id]),before=JSON.stringify(project);if(plan.blockers.length)throw Error(plan.blockers.join('\n'));confirmAction('刪除宣告與相關設定？',removalBody(plan),'刪除並清理相關設定',()=>{if(JSON.stringify(project)!==before)throw Error('專案已變更，請重新預覽。');commit(()=>A.removeNets(project,plan.ids),undefined,{scope:'top',label:'刪除 '+plan.nets.length+' 個接腳及相關設定'});});},
    'net-inspect':b=>{const n=project.nets.find(n=>n.id===b.dataset.id),rows=A.pinRows(project).filter(r=>r.expr&&new RegExp('(^|[^A-Za-z0-9_$])'+n.name.replace(/[$]/g,'\\$&')+'([^A-Za-z0-9_$]|$)').test(r.expr));openDialog(n.name+' · 連線端點','<p><code>'+esc(n.direction+' '+n.range+' '+n.name)+'<\/code><\/p>'+rows.map(r=>'<div class="a-card"><b>'+esc(r.instanceName+'.'+r.port.name)+'<\/b> '+badge(r.port.direction)+' → <code>'+esc(r.expr)+'<\/code><\/div>').join('')+'<p>Assign：'+esc(project.assigns.filter(a=>(a.target+' '+a.expr).includes(n.name)).map(a=>a.target+' = '+a.expr).join('; ')||'無')+'<\/p>');},
    'batch-expose':expose,'batch-slices':slicePlan,'batch-open':()=>changePlan('預覽刻意不接 NC',selectedRows().map(r=>({instance:r.instance,port:r.port.name,expr:''}))),
    'pin-open':b=>changePlan('預覽刻意不接 NC',selectedRows(new Set([b.dataset.id])).map(r=>({instance:r.instance,port:r.port.name,expr:''}))),
    'batch-unset':()=>changePlan('預覽取消設定',selectedRows().map(r=>({instance:r.instance,port:r.port.name,expr:null}))),
    'batch-tie':()=>constantForm(),
    suggest:()=>flowUI.actions['flow-auto'](),
    'assign-add':()=>commit(()=>{project.assigns.push({id:uid(),target:'',expr:''});project.orgEdited=true;}),
    'assign-delete':b=>commit(()=>{project.assigns=project.assigns.filter(a=>a.id!==b.dataset.id);project.orgEdited=true;}),
    'diagram-import':()=>openSheet('top'),'diagram-export':()=>openSheet('top'),
    'export-mode':b=>{if(b.dataset.kind==='defines'){go('defines');return;}exportTab=b.dataset.kind==='org'?'org':'verilog';render();const preview=$('.a-code-preview',shell);if(preview)preview.open=true;},
    'download-output':b=>{const target=b?.dataset.kind||exportTab;if(target==='defines'){defineUI.actions['defines-download']();downloadState.defines=JSON.stringify(project);render();return;}const t=target==='verilog'?K.verilog(project):K.org(project);download(filename()+(target==='verilog'?'.v':'.v.org'),t);downloadState[target]=JSON.stringify(project);render();toast('已送出下載。請一併保存 .wiu.json，方便下次繼續編輯。');},
    'first-error':()=>{const issue=issues(exportTab).find(i=>i.severity==='error');if(issue?.ref)actions['issue-locate']({dataset:{ref:JSON.stringify(issue.ref)}});},
    'download-raw':()=>confirmAction('匯出含進階原文的 org','<p>此檔案可能包含 WIU 未解析的 empty、C code、條件或其他語法，無法保證與直接 Verilog 相同。請在公司環境檢查 gen_top 日誌與產出的 RTL。<\/p>','下載未驗證候選檔',()=>download(filename()+'.candidate.v.org',C.exportOrg(project,{allowRaw:true}))),
    'copy-output':async()=>{const t=exportTab==='verilog'?C.renderVerilog(project):C.renderOrg(project,{allowRaw:true});try{await navigator.clipboard.writeText(t);toast('已複製預覽。');}catch{const range=document.createRange();range.selectNodeContents($('.a-code',shell));const s=window.getSelection();s.removeAllRanges();s.addRange(range);toast('已選取預覽，請按 Ctrl+C 複製。');}},
    'original-org':()=>download(filename()+'.original.v.org',project.originalOrg),
    'issue-locate':b=>{if(b.dataset.issueKey)issueQueueKey=b.dataset.issueKey;issueQueueOpen=true;const ref=JSON.parse(b.dataset.ref);let selector='';if(ref.type==='defines'){tab='defines';}else if(ref.type==='net'){const n=project.nets.find(n=>n.id===ref.id);tab=n?.direction==='wire'?'nets':'ports';selector='[data-net="'+CSS.escape(ref.id)+'"]'+(ref.field?'[data-field="'+CSS.escape(ref.field)+'"]':'');}else if(ref.type==='connection'){connectionView='table';const c=project.connections.find(c=>c.id===ref.id);tab='connections';filter='';onlyUnbound=false;instanceFilter=c?.instance||'';selector=c?'[data-connection="'+CSS.escape(c.instance+'::'+c.port)+'"]':'';}else if(ref.type==='instance'){connectionView='table';tab='connections';filter='';onlyUnbound=false;instanceFilter=ref.id;const row=A.pinRows(project).find(r=>r.instance===ref.id&&(ref.port?r.port.name===ref.port:r.expr==null));if(row)selector='[data-connection="'+CSS.escape(row.key)+'"]';}else if(ref.type==='assign'){tab='assigns';selector='[data-assign="'+CSS.escape(ref.id)+'"]';}else if(ref.type==='top'){actions['project-name']();return;}else if(ref.type==='module'){const m=project.modules.find(m=>m.name===ref.id||m.id===ref.id);if(m){actions['module-view']({dataset:{id:m.name}});refreshIssueQueue();return;}}else{tab='advanced';selector=ref.type==='prelude'?'#a-prelude':'#a-advanced';}dialog.close();view('assembly');render();const el=selector?$(selector,selector==='#a-top-name'?switchbar:shell):$('.a-panel',shell);if(el){el.classList.add('r68-located');el.setAttribute('aria-invalid','true');el.scrollIntoView({block:'center'});el.focus();}}
  };
  defineUI=window.WIUDefinePanel({showFiles:(...args)=>flowUI.showFiles(...args),getProject:()=>project,setProject:p=>{project=p;selected.clear();tab='defines';},commit,openDialog,download,esc,toast,dialog,pick,show:()=>{dialog.close();view('assembly');tab='defines';render();}});
  flowUI=window.WIUWorkflowPanel?.({locateInstance:locateGraphInstance,startPractice:beginPractice,getProject:()=>project,setProject:(p,next)=>{project=p;selected.clear();resetFilters();tab=tab==='graph'&&next==='connections'?'graph':next||'connections';view('assembly');},commit,openDialog,download,esc,toast,dialog,pick,show:next=>{dialog.close();view('assembly');tab=next;render();}});
  Object.assign(actions,defineUI.actions,flowUI?.actions||{});
  Object.assign(actions,{
    'wb-practice-demo':()=>practiceStep(true),'wb-practice-check':()=>practiceStep(false),'wb-coach-toggle':()=>{practiceCoachExpanded=!practiceCoachExpanded;renderPracticeCoach();},
    'wb-graph':()=>{window.WIUBridge?.finish();activeModule='top';go('graph');},
    'wb-open':b=>openSheet(b.dataset.id), 'wb-add':newSheet,
    'wb-start-design':()=>{tab='graph';openSheet('top');},
    'wb-practice-intro':practiceIntro,'wb-practice-exit':endPractice,
    'wb-practice-save':()=>{const p=W.asUser(project);download(p.top+'.wiu.json',asciiJson(W.envelope(p,{...workspace(),tab:'graph',view:'assembly'},'user')),'application/json');toast('已另存為可自由編輯的專案；原本工作保持不變。');},
    'wb-recovered':b=>recoveredSheet(b.dataset.id),
    'discard-recovered':b=>{const entry=project.workbook.recovered.find(x=>x.id===b.dataset.id);if(!entry)return;
      confirmAction('捨棄舊版保留圖面？','<p>只移除「'+esc(entry.label)+'」這份尚未加入模組的保留圖面，可復原。</p>','捨棄圖面',()=>commit(()=>{project.workbook.recovered=project.workbook.recovered.filter(x=>x.id!==entry.id);},'已捨棄保留圖面，可復原。'));},
    'wb-child-rtl':()=>{const m=W.moduleOf(project,activeModule);download(m.name+'.v',m.source||W.skeleton(m));toast(m.interfaceOnly?'已下載介面骨架；尚未加入功能邏輯。':'已下載保存的 RTL 來源。');},
    'graph-port-step':b=>graphPortStep(b.dataset.id,b.dataset.step),'graph-disconnect':b=>{const row=A.pinRows(project).find(r=>r.key===b.dataset.id);if(row){finishGraphConnection();commit(()=>A.applyConnections(project,[{instance:row.instance,port:row.port.name,expr:null}]),'已取消接線；Ctrl+Z 復原');}},'wb-pin':(b,e)=>graphPin(b.dataset.id,e,b.hasAttribute('data-graph-wire-pad')),'wb-pin-cancel':()=>{finishGraphConnection();refreshGraphConnection();},'graph-connect-mode':()=>{graphConnectMode=!graphConnectMode;graphQuickConnect=false;graphStart='';clearGraphNetFocus();refreshGraphConnection();},
    'wb-tour':showTour,'wb-tour-prev':()=>{tourStep=Math.max(0,tourStep-1);showTour();},
    'wb-tour-next':()=>{if(tourStep===tourStops.length-1)closeTour();else{tourStep++;showTour();}},'wb-tour-close':closeTour,
    'flow-module-interface':newSheet,
    'flow-tutorial-stop':endPractice,
    'example-info':exampleInfo,
    demo:startTemplate,
    'module-view':b=>openSheet(project.modules.find(m=>m.name===b.dataset.id).id)
  });
  for(const element of [rail,diagramBar,coach,practiceCoach,stagebar])element.addEventListener('click',e=>safe(()=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.tab){go(b.dataset.tab);return;}if(b.dataset.action&&actions[b.dataset.action])return actions[b.dataset.action](b);}));
  window.WIUProjectHost={snapshot:workbookSnapshot,read:raw=>W.read(raw),load:previewWorkbook,loadLegacy:readLegacyDiagram,
    save:saveProject,historyState,saveState,openHistory,toggleIssueQueue,issueCount:()=>orderedIssues().length,
    findInModule:mode=>{if(dialog.open||window.WIUManualOpen){toast('請先關閉目前視窗，再尋找／取代模組訊號。');return false;}if(currentView==='assembly'&&tab==='graph')return openGraphFind(mode);if(currentView!=='diagram')openSheet(activeModule);return window.WIUFindReplace?.open(mode);},
    presentDrawing,
    isDiagramActive:()=>currentView==='diagram'&&!diagramGuard,
    portNotice:toast,openModuleByName:name=>{const m=project.modules.find(m=>m.name===name);openSheet(name===project.top?'top':m?.id||'top');},parameterSettings:moduleParameters,
    portWidthContext:()=>({parameters:W.moduleOf(project,activeModule).parameters||[],top:activeModule==='top'}),
    portWidthClipboard:items=>window.WIUPortWidths.clipboardParameters(items,W.moduleOf(project,activeModule).parameters||[],project),
    portPastePlan:(items,snapshot)=>window.WIUPortWidths.pasteParameterPlan(items,snapshot,W.moduleOf(project,activeModule).parameters||[],project,W.moduleOf(project,activeModule).ports.map(p=>p.name).concat(activeModule==='top'?project.nets.map(n=>n.name):[])),
    reviewPortPaste:(plan,origin,apply)=>{
      const scope=activeModule,projectId=project.workbook.projectId;
      const body='<p>來源 '+esc(origin?.moduleName||origin?.module||'剪貼簿')+' → '+esc(W.moduleOf(project,activeModule).name)+'。同名 parameter 屬於不同模組，請選擇本次貼上的含義。<\/p><table><thead><tr><th>參數<\/th><th>來源宣告<\/th><th>目的宣告<\/th><th>獨立複製後<\/th><\/tr><\/thead><tbody>'+plan.rows.map(r=>'<tr><td>'+esc(r.name)+'<\/td><td class="'+(r.source===undefined?'r73-error':'')+'">'+esc(r.source??'未宣告／未知')+'<\/td><td class="'+(r.destination===undefined||r.destination!==r.source?'r73-error':'')+'">'+esc(r.destination??'未宣告')+'<\/td><td>'+esc(plan.mapping[r.name]||'無來源宣告')+'<\/td><\/tr>').join('')+'<\/tbody><\/table><label>貼上方式<select id="r73-param-paste"><option value="">請選擇…<\/option><option value="source" '+(plan.sourceErrors.length?'disabled':'')+'>獨立複製來源參數；同名自動編號<\/option><option value="destination" '+(plan.destinationErrors.length?'disabled':'')+'>明確改用目的模組參數（位寬可能改變）<\/option><\/select><\/label><p class="r73-error">'+esc(plan.sourceErrors.length?'無法複製來源：'+plan.sourceErrors.join('；'):'')+'<\/p><p class="r73-error">'+esc(plan.destinationErrors.length?'無法沿用目的：'+plan.destinationErrors.join('；'):'')+'<\/p><p>獨立複製會一起改寫位寬與參數依賴；來源模組不變。取消不會新增接腳。<\/p>';
      openDialog('跨模組貼上 · 確認參數',body,'貼上',()=>{const mode=$('#r73-param-paste',dialog).value;if(!mode)throw Error('請選擇參數來源。');if(activeModule!==scope||project.workbook.projectId!==projectId)throw Error('模組已切換，請重新貼上。');dialog.close();apply(mode);});
      const button=$('[data-dialog="apply"]',dialog);button.disabled=true;button.title='請先選擇參數來源';$('#r73-param-paste',dialog).addEventListener('change',e=>{button.disabled=!e.target.value;button.title=e.target.value?'':'請先選擇參數來源';});
    },
    portWidthPlan:(value,values)=>window.WIUPortWidths.planWidth(value,W.moduleOf(project,activeModule).parameters||[],project,values,[...W.moduleOf(project,activeModule).ports.map(p=>p.name),...(activeModule==='top'?project.nets.filter(n=>n.direction==='wire').map(n=>n.name):[])]),
    widthInfo:range=>window.WIUPortWidths.width(range,W.moduleOf(project,activeModule).parameters||[],project),
    portEditContext:()=>{const m=W.moduleOf(project,activeModule),edit=W.portEditStatus(project,m);return {project:project.workbook.projectId,module:activeModule,reserved:[...edit.reserved,...[...(m.parameters||[]).map(x=>x.name),...(activeModule==='top'?[...project.nets.filter(n=>n.direction==='wire').map(n=>n.name),...project.instances.map(i=>i.name)]:[])]],reason:edit.reason,note:edit.note||''};},
    pastePortText:()=>openDialog('貼上接腳名稱','<p>本次新增到'+(window.WIUPortEditing.targetSide()==='right'?'右側，純名稱預設 output':'左側，純名稱預設 input')+' / 1 bit。<\/p><p>每行一個名稱，也可貼上 Tab 分隔的「名稱、位寬、方向、群組、備註」。同名會自動加上 _2、_3；套用後可一次復原。<\/p><label>接腳清單<textarea id="r70-port-list" rows="8" spellcheck="false" placeholder="req\nack\nvalid"><\/textarea><\/label>','新增接腳',()=>{if(!$('#r70-port-list',dialog).value.trim())throw Error('請貼上至少一個接腳名稱。');if(window.WIUPortEditing.pasteText($('#r70-port-list',dialog).value))dialog.close();}),
    moduleNameError(value){const name=String(value).trim(),m=W.moduleOf(project,activeModule);if(!C.validName(name))return '名稱需以英文字母或底線開頭，後接英數字、底線或 $；例如 example_register。';if((activeModule!=='top'&&name===project.top)||project.modules.some(x=>x.id!==activeModule&&x.name===name))return '模組名稱「'+name+'」已使用，請改用其他名稱。';return W.editCapabilities(project,activeModule).renameReason;},
    requestConditionEdit(){const reason=W.editCapabilities(project,activeModule).conditionReason,m=W.moduleOf(project,activeModule);openDialog('條件編輯尚未套用','<p>'+esc(reason)+'</p>'+(activeModule!=='top'?'<button data-action="module-update-rtl" data-id="'+esc(m.name)+'">更新 RTL</button>':'<button data-action="import-rtl">匯入 RTL</button>')+'<button data-tab="defines">查看 Defines 組態</button>');return false;},
    reportRejected:message=>toast(message),
    diagramChanged,undo,redo,canUndo:()=>historyCan(past),canRedo:()=>historyCan(future),
    markSaved:()=>{saved=JSON.stringify(project);renderWorkbook();},
    newModule:newSheet,importRtl:()=>importDialog('rtl'),open:()=>pick('project'),
    config:()=>project.defineConfig,
    carrierName:raw=>{const r=W.read(raw);return (r.origin==='practice'?'practice-':'')+W.moduleOf(r.project,r.workspace.activeModule||'top').name;}
  };

  /* R85_MANUAL_WIRE_BENDS: visual-only route state follows project JSON and Visio scene. */
  let wireDrag=null;
  shell.addEventListener('pointerdown',e=>{const hit=e.target.closest('[data-wire-route]');if(!hit||e.button!==0)return;
    const canvas=hit.closest('.wb-canvas'),zoom=Number(canvas?.style.zoom)||1;
    wireDrag={key:hit.dataset.wireRoute,pointer:e.pointerId,startX:e.clientX,startY:e.clientY,x:parseFloat(hit.style.left)+8,y:parseFloat(hit.style.top)+8,zoom,moved:false};
    e.preventDefault();hit.focus();shell.setPointerCapture(e.pointerId);
  });
  shell.addEventListener('pointermove',e=>{const d=wireDrag;if(!d||d.pointer!==e.pointerId)return;
    const x=d.x+(e.clientX-d.startX)/d.zoom,y=d.y+(e.clientY-d.startY)/d.zoom;
    if(!d.moved&&Math.hypot(x-d.x,y-d.y)<3)return;d.moved=true;
    const hit=[...shell.querySelectorAll('[data-wire-route]')].find(n=>n.dataset.wireRoute===d.key);
    if(hit){hit.style.left=(x-8)+'px';hit.style.top=(y-8)+'px';hit.classList.add('r85-bend-dragging');}
  });
  function finishWireDrag(cancel=false){const d=wireDrag;if(!d)return;wireDrag=null;
    try{shell.releasePointerCapture(d.pointer);}catch{}
    if(d.moved&&!cancel){const pt={x:Math.round((d.x)/4)*4,y:Math.round((d.y)/4)*4};
      // Use final pointer move position in canvas coordinates.
      const hit=[...shell.querySelectorAll('[data-wire-route]')].find(n=>n.dataset.wireRoute===d.key);
      if(hit){pt.x=Math.round((parseFloat(hit.style.left)+8)/4)*4;pt.y=Math.round((parseFloat(hit.style.top)+8)/4)*4;}
      commit(()=>{project.workbook.wireRoutes||={};project.workbook.wireRoutes[d.key]=pt;});
      const actual=window.WIUTopScene.create(project).edges.find(e=>e.routeKey===d.key);
      if(actual&&!actual.manual)toast('此轉折點撞到 block，已保留設定並暫時使用自動路由；將控制點拉至空曠位置再調整。');
    }else if(d.moved||cancel)render();
  }
  shell.addEventListener('pointerup',()=>finishWireDrag());
  shell.addEventListener('pointercancel',()=>finishWireDrag(true));
  shell.addEventListener('lostpointercapture',()=>finishWireDrag(true));
  shell.addEventListener('keydown',e=>{const h=e.target.closest('[data-wire-route]');if(!h||!e.key.startsWith('Arrow'))return;
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta)return;
    e.preventDefault();e.stopImmediatePropagation();const step=e.shiftKey?32:8,key=h.dataset.wireRoute,
      base=project.workbook?.wireRoutes?.[key]||{x:parseFloat(h.style.left)+8,y:parseFloat(h.style.top)+8};
    commit(()=>{project.workbook.wireRoutes||={};project.workbook.wireRoutes[key]={x:base.x+delta[0]*step,y:base.y+delta[1]*step};});
    [...shell.querySelectorAll('[data-wire-route]')].find(n=>n.dataset.wireRoute===key)?.focus({preventScroll:true});
  },true);
    // View navigation never commits a design edit or enters project undo history.
  let graphSpace=false,graphPanDrag=null,graphSuppressClick=false;
  const graphEditable=t=>{const el=t?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]');return !!(el&&!el.readOnly&&!el.disabled);};
  const graphActive=()=>currentView==='assembly'&&tab==='graph'&&!dialog.open&&!window.WIUManualOpen;
  window.addEventListener('keydown',e=>{
    if(!graphActive()||graphEditable(e.target)||e.target.closest?.('#r111-find'))return;
    const mod=e.ctrlKey||e.metaKey,key=String(e.key).toLowerCase();
    const cmd=mod?({c:'copy',x:'cut',v:'paste',d:'duplicate'})[key]:e.key==='Delete'?'delete':e.key==='F2'?'edit':null;
    if(cmd&&(graphObject?.kind==='instance'||cmd==='paste'||cmd==='delete'&&graphNetFocus.size===1)){e.preventDefault();e.stopImmediatePropagation();safe(()=>graphCommand(cmd));return;}
    if(e.key.startsWith('Arrow')&&e.target.closest?.('[data-graph-drag]'))return;
    if(e.code==='Space'&&e.target.closest?.('button,summary'))return;
    if(e.code==='Space'){e.preventDefault();e.stopImmediatePropagation();graphSpace=true;$('.wb-canvas-scroll',shell)?.classList.add('pan-ready');return;}
    if(e.key==='Escape'&&graphPanDrag){e.preventDefault();e.stopImmediatePropagation();finishGraphPan(true);return;}
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    // WaveASecond-style panning is available throughout the Top workspace,
    // not only when the otherwise tiny blank SVG viewport owns focus.
    // W/Up: view upward; S/Down: downward; A/Left: left; D/Right: right.
    const code=e.key?.toLowerCase(),motion={arrowup:[0,1],w:[0,1],arrowdown:[0,-1],s:[0,-1],arrowleft:[1,0],a:[1,0],arrowright:[-1,0],d:[-1,0]}[code];
    if(motion){e.preventDefault();e.stopImmediatePropagation();const step=e.shiftKey?160:60;graphViewportAuto=false;graphPan.x+=motion[0]*step;graphPan.y+=motion[1]*step;applyGraphZoom();return;}
    if(['+','=','-','0','f','F'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();setGraphZoom(e.key==='f'||e.key==='F'?'fit':e.key==='0'?'1':e.key==='-'?'out':'in');}
  },true);
  window.addEventListener('keyup',e=>{if(e.code==='Space'){graphSpace=false;$('.wb-canvas-scroll',shell)?.classList.remove('pan-ready');}},true);
  window.addEventListener('blur',()=>{graphSpace=false;$('.wb-canvas-scroll',shell)?.classList.remove('pan-ready');finishGraphPan(true);});
  shell.addEventListener('wheel',e=>{
    if(!graphActive()||!e.target.closest('.wb-canvas-scroll')||graphEditable(e.target))return;
    e.preventDefault();const z=Number($('.wb-canvas',shell)?.style.zoom)||1;
    setGraphZoom(z*Math.exp(-e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?600:1)*.00125),{x:e.clientX,y:e.clientY});
  },{passive:false});
  shell.addEventListener('pointerdown',e=>{
    const sc=e.target.closest('.wb-canvas-scroll');if(!graphActive()||!sc||graphEditable(e.target))return;
    const blank=!e.target.closest('.wb-block,.wb-top-rail,button,[data-top-drop-side],[data-wire-hit],[data-graph-group],[data-graph-group-select],[data-wire-name],[data-net-label]');
    if(e.button!==1&&!(e.button===0&&(graphSpace||blank)))return;
    e.preventDefault();e.stopImmediatePropagation();graphSuppressClick=false;
    graphPanDrag={pointer:e.pointerId,x:e.clientX,y:e.clientY,pan:{...graphPan},moved:false};
    sc.focus({preventScroll:true});sc.classList.add('is-panning');shell.setPointerCapture(e.pointerId);
  },true);
  shell.addEventListener('pointermove',e=>{
    const d=graphPanDrag;if(!d||e.pointerId!==d.pointer)return;
    const dx=e.clientX-d.x,dy=e.clientY-d.y;if(!d.moved&&Math.hypot(dx,dy)<4)return;
    d.moved=true;graphViewportAuto=false;e.preventDefault();e.stopImmediatePropagation();graphPan={x:d.pan.x+dx,y:d.pan.y+dy};applyGraphZoom();
  },true);
  function finishGraphPan(cancel=false){const d=graphPanDrag;if(!d)return;graphPanDrag=null;graphSuppressClick=d.moved;if(cancel){graphPan=d.pan;applyGraphZoom();}$('.wb-canvas-scroll',shell)?.classList.remove('is-panning');try{shell.releasePointerCapture(d.pointer);}catch{}}
  shell.addEventListener('pointerup',e=>{if(!graphPanDrag)return;e.preventDefault();e.stopImmediatePropagation();finishGraphPan();},true);
  shell.addEventListener('pointercancel',()=>finishGraphPan(true),true);
  shell.addEventListener('lostpointercapture',()=>finishGraphPan(true),true);
  shell.addEventListener('click',e=>{if(graphSuppressClick||graphSpace){graphSuppressClick=false;e.preventDefault();e.stopImmediatePropagation();}},true);
  shell.addEventListener('auxclick',e=>{if(e.button===1&&e.target.closest('.wb-canvas-scroll'))e.preventDefault();});

  window.addEventListener('resize',()=>{if(graphActive())applyGraphZoom();});

  let topPortDrag=null;
  const clearTopDrop=()=>{for(const el of $$('.is-drop-target,.is-drop-before,.is-drop-after',shell))el.classList.remove('is-drop-target','is-drop-before','is-drop-after');};
  shell.addEventListener('pointerdown',e=>{const h=e.target.closest('[data-top-drag]');if(!h||e.button!==0)return;e.preventDefault();h.focus();shell.classList.add('r104-top-port-drag');topPortDrag={id:h.dataset.topDrag,pointer:e.pointerId,x:e.clientX,y:e.clientY,moved:false,target:null};shell.setPointerCapture(e.pointerId);});
  shell.addEventListener('pointermove',e=>{const d=topPortDrag;if(!d||d.pointer!==e.pointerId)return;if(!d.moved&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<4)return;d.moved=true;const target=document.elementFromPoint(e.clientX,e.clientY),zone=target?.closest('[data-top-drop-side]');clearTopDrop();d.target=null;if(!zone)return;zone.classList.add('is-drop-target');const row=target.closest('[data-top-index]'),side=zone.dataset.topDropSide,sides=window.WIUGraphLayout.topPorts(project);let index=sides[side].length;if(row){const after=e.clientY>=row.getBoundingClientRect().top+row.getBoundingClientRect().height/2;index=Number(row.dataset.topIndex)+(after?1:0);row.classList.add(after?'is-drop-after':'is-drop-before');}const original=sides[side].findIndex(p=>p?.id===d.id);if(original>=0&&original<index)index--;d.target={side,index};});
  function finishTopDrag(cancel=false){shell.classList.remove('r104-top-port-drag');const d=topPortDrag;if(!d)return;topPortDrag=null;try{shell.releasePointerCapture(d.pointer);}catch{}clearTopDrop();if(!cancel&&d.moved&&d.target)graphPortMove(d.id,d.target.side,d.target.index);}
  shell.addEventListener('pointerup',()=>finishTopDrag());shell.addEventListener('pointercancel',()=>finishTopDrag(true));shell.addEventListener('lostpointercapture',()=>finishTopDrag(true));
  shell.addEventListener('keydown',e=>{const h=e.target.closest('[data-top-drag]');if(!h||!e.altKey||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();e.stopImmediatePropagation();const id=h.dataset.topDrag;if(['ArrowUp','ArrowDown'].includes(e.key))graphPortStep(id,e.key==='ArrowUp'?'up':'down');else{const side=e.key==='ArrowLeft'?'left':'right';graphPortMove(id,side,window.WIUGraphLayout.topPorts(project)[side].length);}$$('[data-top-drag]',shell).find(el=>el.dataset.topDrag===id)?.focus({preventScroll:true});},true);
  let graphDrag=null;
  shell.addEventListener('selectstart',e=>{if(e.target.closest?.('.wb-canvas')&&!e.target.closest?.('input:not([readonly]),textarea,[contenteditable]'))e.preventDefault();});
  shell.addEventListener('dragstart',e=>{if(e.target.closest?.('.wb-canvas'))e.preventDefault();});
  shell.addEventListener('pointerdown',e=>{
    const handle=e.target.closest('[data-graph-drag]');if(!handle||e.button!==0)return;
    const block=handle.closest('.wb-block');graphDrag={id:handle.dataset.graphDrag,pointer:e.pointerId,startX:e.clientX,startY:e.clientY,x:parseFloat(block.style.left),y:parseFloat(block.style.top),zoom:Number($('.wb-canvas',shell)?.style?.zoom)||1,preview:null,moved:false};
    handle.focus();e.preventDefault();handle.setPointerCapture(e.pointerId);
  });
  shell.addEventListener('pointermove',e=>{
    const d=graphDrag;if(!d||d.pointer!==e.pointerId)return;
    const x=d.x+(e.clientX-d.startX)/d.zoom,y=d.y+(e.clientY-d.startY)/d.zoom;if(!d.moved&&Math.hypot(e.clientX-d.startX,e.clientY-d.startY)<4)return;
    if(!d.moved){
      d.moved=true;d.preview=JSON.parse(JSON.stringify(project));
    // Cache only wires attached to this instance. Rubber-band these visually
    // without running graph-scene routing while the pointer moves.
    const scene=window.WIUTopScene.create(project),svg=$('.wb-canvas svg',shell);
    const attached=scene.edges.filter(w=>w.source.startsWith(d.id+'::')||w.target.startsWith(d.id+'::'));
    d.previewWires=attached.map(w=>({edge:w,from:{...scene.points[w.source]},to:{...scene.points[w.target]},points:[w.points[0].slice(0,2),...w.points.map(v=>v.slice(2))],node:[...(svg?.querySelectorAll('[data-wire-source]')||[])].find(n=>n.dataset.wireSource===w.source&&n.dataset.wireTarget===w.target&&n.dataset.wireNet===w.net)}));
    d.pinHits=[...shell.querySelectorAll('.wb-canvas [data-action="wb-pin"]')].filter(n=>n.dataset.id?.startsWith(d.id+'::'));
    }
    window.WIUGraphLayout.move(d.preview,d.id,x,y);
    // Deliberately avoid global routing and full DOM replacement while moving.
    // At pointerup the original paths are rubber-banded to the new pin positions.
    const visible=$('.wb-block[data-instance="'+CSS.escape(d.id)+'"]',shell);
    if(visible){visible.style.left=x+'px';visible.style.top=y+'px';}
    const svg=$('.wb-canvas svg',shell);
    if(svg){for(const node of svg.querySelectorAll('[data-owner-instance="'+CSS.escape(d.id)+'"]'))node.setAttribute('transform','translate('+(x-d.x)+' '+(y-d.y)+')');}
    const dx=x-d.x,dy=y-d.y;
    for(const pin of d.pinHits||[])pin.style.transform='translate('+dx+'px,'+dy+'px)';
    for(const w of d.previewWires||[]){
      if(!w.node)continue;
      const a=w.edge.source.startsWith(d.id+'::')?{...w.from,x:w.from.x+dx,y:w.from.y+dy}:w.from;
      const b=w.edge.target.startsWith(d.id+'::')?{...w.to,x:w.to.x+dx,y:w.to.y+dy}:w.to;
      const rubber=window.WIUTopScene.frozenPath({points:w.points},a,b);
      if(rubber){const coordinates=rubber.map(pt=>pt.x+','+pt.y).join(' ');
        for(const path of w.node.querySelectorAll('polyline'))path.setAttribute('points',coordinates);
      }
    }
  });
  function finishGraphDrag(cancel=false){const d=graphDrag;if(!d)return;graphDrag=null;try{shell.querySelector('[data-graph-drag="'+CSS.escape(d.id)+'"]')?.releasePointerCapture(d.pointer);}catch{}if(d.moved){graphSuppressClick=true;setTimeout(()=>{graphSuppressClick=false;},0);if(cancel)render();else{const p=d.preview.workbook.graphPositions[d.id],sc=$('.wb-canvas-scroll',shell),sx=sc?.scrollLeft||0,sy=sc?.scrollTop||0;commit(()=>window.WIUGraphLayout.move(project,d.id,p.x,p.y));const next=$('.wb-canvas-scroll',shell);if(next){next.scrollLeft=sx;next.scrollTop=sy;}}}}
  shell.addEventListener('pointerup',()=>finishGraphDrag());
  shell.addEventListener('pointercancel',()=>finishGraphDrag(true));
  shell.addEventListener('lostpointercapture',()=>finishGraphDrag(true));
  window.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&topPortDrag){e.preventDefault();e.stopImmediatePropagation();finishTopDrag(true);return;}if(e.key==='Escape'&&graphDrag){e.preventDefault();e.stopImmediatePropagation();finishGraphDrag(true);return;}
    const h=e.target.closest?.('[data-graph-drag]');if(!h||!e.key.startsWith('Arrow'))return;
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta)return;
    e.preventDefault();e.stopImmediatePropagation();const id=h.dataset.graphDrag,b=h.closest('.wb-block'),step=e.shiftKey?20:4;
    const x=parseFloat(b.style.left)+delta[0]*step,y=parseFloat(b.style.top)+delta[1]*step;
    const scroll=$('.wb-canvas-scroll',shell),sx=scroll?.scrollLeft,sy=scroll?.scrollTop;
    commit(()=>window.WIUGraphLayout.move(project,id,x,y));
    const next=$('.wb-canvas-scroll',shell);if(next){next.scrollLeft=sx;next.scrollTop=sy;}
    [...shell.querySelectorAll('[data-graph-drag]')].find(n=>n.dataset.graphDrag===id)?.focus({preventScroll:true});
  },true);

  shell.addEventListener('click',e=>safe(()=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.tab){go(b.dataset.tab);return;}if(actions[b.dataset.action])actions[b.dataset.action](b,e);}));
  switchbar.addEventListener('click',e=>safe(()=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.tab)go(b.dataset.tab);else if(b.dataset.view)view(b.dataset.view);else if(b.dataset.action&&actions[b.dataset.action])return actions[b.dataset.action](b);else if(b.dataset.nav==='home')go('home');else if(b.dataset.nav==='help')go('help');else if(b.dataset.nav==='manual')actions.manual();else readme();}));
  function runTool(b){
    const action=b.dataset.toolAction,scope=b.dataset.toolScope;
    if(scope==='instance'||scope==='module'){
      const list=scope==='instance'?project.instances:project.modules;
      const buttons=list.map(o=>E.commandButton(action,{id:scope==='instance'?o.id:o.name,label:o.name})).join('');
      openDialog(E.commandLabel(action),'<p>'+(!list.length?'目前沒有可選的項目。':scope==='instance'?'請選擇要操作的 instance。':'請選擇模組定義。')+'</p><div class="fg-tool-list">'+buttons+'</div>');return;
    }
    dialog.close();
    if(scope==='bundle'&&(currentView!=='assembly'||tab!=='bundle'))go('bundle');
    if(['graph','layout','review','pin','group'].includes(scope)&&(currentView!=='assembly'||tab!=='graph'))go('graph');
    if(scope==='pin'){
      const key=graphObject?.kind==='pin'&&graphObject.projectId===project.workbook.projectId&&graphObject.id;
      if(key&&(action==='graph-start-at-pin'||!key.startsWith('top::')))return actions[action]({dataset:{id:key}});
      toast(action==='graph-start-at-pin'?'請點選起點 pad，再按「從此接線」或「從此改接」。':'請點選 instance 上的 pad，再按「設定綁定」。');
      return;
    }
    if(scope==='group'&&!graphGroupFocus.size){$('[data-graph-group-picker]',shell)?.focus();toast('選擇要追蹤的 Group，再按「組內接腳」。');return;}
    if(scope==='layout'){
      const menu=$('#r107-graph-layout',shell);
      if(menu){menu.open=true;menu.querySelector('[data-action="'+action+'"]')?.focus();}
      return;
    }
    if(scope==='review'){showGraphCrossingReview();return;}
    if(actions[action])return actions[action](b);
  }
  dialog.addEventListener('click',e=>safe(()=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.toolTab){go(b.dataset.toolTab);return;}if(b.dataset.toolAction){if(b.dataset.toolScope==='layout')e.stopImmediatePropagation();return runTool(b);}if(b.dataset.dialog==='close')dialog.close();if(b.dataset.dialog==='apply'){
      if(dialogBusy)return;const action=modalAction,generation=dialogGeneration;dialogBusy=true;b.disabled=true;
      const status=document.createElement('p');status.setAttribute('role','status');status.textContent='處理中，請稍候…';$('.a-dialog-foot',dialog).prepend(status);
      return new Promise(resolve=>setTimeout(resolve,24)).then(()=>{if(generation===dialogGeneration&&dialog.open)return action?.();}).finally(()=>{if(generation===dialogGeneration){dialogBusy=false;b.disabled=false;status.remove();}});
    }if(b.dataset.dialogFile)pick(b.dataset.dialogFile,b.dataset.moduleTarget||'');if(b.dataset.action&&actions[b.dataset.action])return actions[b.dataset.action](b);}));
  dialog.addEventListener('input',e=>{if(e.target.id!=='fg-tool-search')return;const query=e.target.value.trim().toLowerCase();let found=0;for(const item of $$('[data-tool-search]',dialog)){item.hidden=!item.dataset.toolSearch.includes(query);if(!item.hidden)found++;}$('#fg-tool-empty',dialog).hidden=found>0;});
  function setPendingField(el){if(el.value===el.defaultValue){clearPendingField(el);const note=el.closest('td')?.querySelector('[data-r118-edit-status]');if(note)note.textContent='與目前設定相同';return;}const label=el.dataset.connection?(A.pinRows(project).find(r=>r.key===el.dataset.connection)?.instanceName+'.'+el.dataset.connection.split('::')[1]):el.dataset.wireName?'線名 '+el.dataset.wireName:el.id==='r124-name'?'模組名稱':'Top 名稱';const domKey=window.WIUInteractionR128.key(el),key=project.workbook.projectId+'::'+domKey;pendingField={element:el,label,key,domKey,projectId:project.workbook.projectId,tab,currentView};fieldDrafts.set(key,pendingField);el.dataset.r118Editing='true';el.setAttribute('aria-description','編輯中；Enter 或 Tab 套用，Esc 取消。');const note=el.closest('td')?.querySelector('[data-r118-edit-status]');if(note)note.textContent='編輯中 · Enter／Tab 套用 · Esc 取消';notifySaveState();}
  function clearPendingField(el){delete el.dataset.r118Editing;for(const [key,d] of fieldDrafts)if(d.element===el)fieldDrafts.delete(key);if(pendingField?.element===el)pendingField=null;notifySaveState();}
  function handleInput(e){if(e.target.dataset.connection||e.target.dataset.wireName||e.target.dataset.net||e.target.dataset.assign||e.target.id==='a-top-name'){if(e.target.dataset.wireName)e.target.removeAttribute('aria-invalid');setPendingField(e.target);if(e.target.id==='a-top-name')inlineTop();return;}if(e.target.id==='ux-help-search'){helpQuery=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{if(tab!=='help')return;const pos=e.target.selectionStart;render();const input=$('#ux-help-search',shell);input?.focus();input?.setSelectionRange?.(pos,pos);},180);return;}if(e.target.id!=='a-filter')return;if(graphTableOrigin)delete graphTableOrigin.pinKey;filter=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{if(tab!=='connections')return;const focused=document.activeElement?.id==='a-filter',start=e.target.selectionStart,end=e.target.selectionEnd;render();if(focused){const input=$('#a-filter',shell);input.focus();input.setSelectionRange?.(start,end);}},180);}
  for(const el of [shell,switchbar])el.addEventListener('input',handleInput);
  window.addEventListener('keydown',e=>{const el=e.target;if(e.isComposing||e.keyCode===229||!(el?.dataset?.connection||el?.dataset?.net||el?.dataset?.assign||el?.id==='a-top-name'))return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();el.value=el.defaultValue;clearPendingField(el);window.WIUTextEditing?.reset(el);const note=el.closest('td')?.querySelector('[data-r118-edit-status]');if(note)note.textContent='已取消輸入';el.blur();inlineTop();}else if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();el.blur();}},true);
  window.addEventListener('fullscreenchange',()=>{if(window.WIUPresentation?.isOpen())return;document.body.classList.toggle('r82-fullscreen',!!document.fullscreenElement);const button=$('[data-action="graph-fullscreen"]',shell);if(button)button.textContent='⛶ 全螢幕看圖 F5';const exit=$('[data-fullscreen-exit]',shell);if(exit)exit.hidden=!(document.fullscreenElement||graphFocus);applyGraphZoom();});
  function applyWireField(el){
    if(el.value===el.defaultValue){el.removeAttribute('aria-invalid');clearPendingField(el);el.readOnly=true;delete el.dataset.wireEditing;return true;}
    try{const match=/^([A-Za-z_$][\w$]*)\s*(\[[^\]\r\n]+:[^\]\r\n]+\])?$/.exec(el.value.trim());if(!match)throw Error('請輸入 wire_name 或 wire_name[MSB:LSB]。');const trial=A.clone(project),net=trial.nets.find(n=>n.name===el.dataset.wireName);if(!net)throw Error('找不到目前編輯的 net。');const value=window.WIUInteractionR128.wireValue(el.value,net.range);C.parseRange(C.expandDefines(value.range,trial),topContext());A.renameNet(trial,net.id,value.name);net.range=value.range;trial.orgEdited=true;clearPendingField(el);el.defaultValue=value.name+value.range;el.value=el.defaultValue;window.WIUTextEditing?.reset(el);el.readOnly=true;delete el.dataset.wireEditing;commit(()=>{project=trial;},'已更新 wire；相連端點同步改名。');el.defaultValue=el.value;el.removeAttribute('aria-invalid');el.readOnly=true;delete el.dataset.wireEditing;return true;}catch(error){el.readOnly=false;el.dataset.wireEditing='true';el.setAttribute('aria-invalid','true');setPendingField(el);toast(error.message+' 輸入已保留；請修正後按 Enter，或 Esc 取消。');return false;}
  }
  function cancelWireField(el){el.value=el.defaultValue;el.removeAttribute('aria-invalid');clearPendingField(el);window.WIUTextEditing?.reset(el);el.readOnly=true;delete el.dataset.wireEditing;el.blur();}
  shell.addEventListener('keydown',e=>{if(e.isComposing||e.keyCode===229||!e.target.matches('[data-wire-name]')||e.target.readOnly)return;if(e.key==='Escape'){e.preventDefault();cancelWireField(e.target);e.stopImmediatePropagation();}if(e.key==='Enter'||e.key==='Tab'){if(e.key==='Enter')e.preventDefault();if(applyWireField(e.target))e.target.blur();else e.preventDefault();e.stopImmediatePropagation();}},true);
  function handleChange(e){safe(()=>{const el=e.target;
    if(el.dataset.layoutWidth){const width=Number(el.value);if(!Number.isFinite(width)||width<580||width>20000)throw Error('寬度需介於 580 與 20000。');changeInstanceLayout(el.dataset.layoutWidth,{width});return;}
    if(el.id==='r95-instance-select'){selectGraphInstance(el.value);return;}
    if(el.dataset.topStyle){commit(()=>{project.workbook.topStyle={...window.WIUDiagramStyle.settings(project),[el.dataset.topStyle]:el.value};});return;}
    if(el.dataset.groupColor){commit(()=>{const st=window.WIUDiagramStyle.settings(project);st.colors={...st.colors,[el.dataset.groupColor]:el.value};project.workbook.topStyle=st;});return;}
    if(el.dataset.wireName){applyWireField(el);return;}

    quietEdit=!!(el.dataset.connection||el.dataset.net||el.dataset.assign||el.dataset.format||['a-top-name','a-advanced','a-prelude'].includes(el.id));try{
    if(el.id==='a-top-name'){const value=el.value.trim();clearPendingField(el);if(project.top!==value)commit(()=>{project.top=value;project.orgEdited=true;},null,{label:'Top 改名：'+project.top+' → '+value});el.defaultValue=value;if(currentView==='diagram')refreshSheet();}
    else if(el.id==='a-filter'){filter=el.value;}
    else if(el.id==='a-instance-filter'){if(graphTableOrigin?.pinKey){delete graphTableOrigin.pinKey;filter='';}instanceFilter=el.value;render();}
    else if(el.id==='a-unbound'){onlyUnbound=el.checked;render();}
    else if(el.id==='a-select-all'){const keys=$$('[data-pin-select]',shell).map(i=>i.dataset.pinSelect);keys.forEach(k=>el.checked?selected.add(k):selected.delete(k));render();}
    else if(el.dataset.pinSelect){el.checked?selected.add(el.dataset.pinSelect):selected.delete(el.dataset.pinSelect);if(el.checked)focusedPin=el.dataset.pinSelect;render();}
    else if(el.dataset.connection){if(el.value===el.defaultValue){clearPendingField(el);return;}const r=A.pinRows(project).find(r=>r.key===el.dataset.connection);if(!r)return;const expr=el.value.trim()||null;clearPendingField(el);if(r.expr!==expr)commit(()=>{A.applyConnections(project,[{instance:r.instance,port:r.port.name,expr}]);project.orgEdited=true;},null,{label:'修改 '+r.instanceName+'.'+r.port.name+' 綁定'});el.defaultValue=el.value;window.WIUTextEditing?.reset(el);const note=el.closest('td')?.querySelector('[data-r118-edit-status]');if(note)note.textContent=expr===null?'未設定（不是刻意不接）':'已套用';const mode=el.closest('td')?.querySelector('[data-binding-mode]');if(mode)mode.value=HF.bindingKind(expr);}
    else if(el.dataset.bindingMode){const r=A.pinRows(project).find(r=>r.key===el.dataset.bindingMode);if(!r)return;const mode=el.value;el.value=HF.bindingKind(r.expr);if(mode==='net'){$('[data-connection="'+CSS.escape(r.key)+'"]',shell)?.focus();toast('輸入 net 或運算式；Enter／Tab 套用，Esc 取消。');return;}if(mode==='constant'){constantForm(new Set([r.key]),HF.bindingKind(r.expr)==='constant'?r.expr:"1'b0");return;}const expr=mode==='open'?'':null;if(expr===r.expr)return;if(mode==='open'&&r.port.direction==='input'){changePlan('確認刻意浮接輸入',[{instance:r.instance,port:r.port.name,expr}]);return;}commit(()=>{A.applyConnections(project,[{instance:r.instance,port:r.port.name,expr}]);project.orgEdited=true;},mode==='open'?'已設為刻意不接；可復原。':'已取消設定；此 pin 仍待處理。',{label:(mode==='open'?'刻意不接 ':'取消設定 ')+r.instanceName+'.'+r.port.name});}
    else if(el.dataset.net){if(el.type!=='checkbox'&&el.value===el.defaultValue){clearPendingField(el);return;}const n=project.nets.find(n=>n.id===el.dataset.net);try{commit(()=>{if(el.dataset.field==='name')A.renameNet(project,n.id,el.value.trim());else n[el.dataset.field]=el.type==='checkbox'?el.checked:el.value.trim();project.orgEdited=true;});el.defaultValue=el.value;el.removeAttribute('aria-invalid');clearPendingField(el);window.WIUTextEditing?.reset(el);}catch(err){el.setAttribute('aria-invalid','true');setPendingField(el);throw err;}}
    else if(el.dataset.assign){if(el.value===el.defaultValue){clearPendingField(el);return;}commit(()=>{project.assigns.find(a=>a.id===el.dataset.assign)[el.dataset.field]=el.value.trim();project.orgEdited=true;});el.defaultValue=el.value;clearPendingField(el);window.WIUTextEditing?.reset(el);}
    else if(el.dataset.format)commit(()=>{project.formats=el.checked?[...new Set(project.formats.concat(el.dataset.format))]:project.formats.filter(f=>f!==el.dataset.format);project.orgEdited=true;});
    else if(el.id==='a-advanced'||el.id==='a-prelude')commit(()=>{project[el.id==='a-advanced'?'advanced':'prelude']=el.value;project.orgEdited=true;});
    }finally{quietEdit=false;}
  });}
  shell.addEventListener('change',e=>{if(!e.target.matches('[data-graph-group-picker]'))return;
    e.stopImmediatePropagation();if(e.target.value)selectGraphGroup(e.target.value,false);else clearGraphNetFocus();
  },true);
  for(const el of [shell,switchbar])el.addEventListener('change',handleChange);shell.addEventListener('focusout',e=>{if(e.target.dataset.wireName&&e.target.dataset.wireEditing==='true'&&e.target.getAttribute('aria-invalid')!=='true')applyWireField(e.target);});
  fileInput.addEventListener('change',async()=>{try{const files=[...fileInput.files];if(!files.length)return;if(files.some(f=>f.size>12*1024*1024))throw Error('單一檔案請小於 12 MB。');if(fileMode==='rtl'){const result={modules:[],issues:[],sources:[]};for(const f of files){const parsed=P.parseRtl(await f.text(),{config:project.defineConfig,filename:f.name});result.sources.push(...parsed.sources);parsed.modules.forEach(m=>m.filename=f.name);result.modules.push(...parsed.modules);result.issues.push(...parsed.issues);}importRtl(result,fileInput.dataset.moduleTarget||'');return;}const file=files[0];if(fileMode==='defines'){defineUI.imported(await file.text(),file.name);return;}if(fileMode==='define-include'){defineUI.includeEdit(null,await file.text(),file.name);return;}if(fileMode==='org'){previewOrg(await file.text(),file.name);return;}if(/\.(v|sv)$/i.test(file.name)){const result=P.parseRtl(await file.text(),{config:project.defineConfig,filename:file.name});result.modules.forEach(m=>m.filename=file.name);importRtl(result);return;}if(!/\.json$/i.test(file.name)){dialog.close();await window.__WSS_TEST__.loadProjectFile(file);return;}const data=JSON.parse(await file.text());if(data.format==='WrapItfUp-assembly'||data.schemaVersion!==undefined)previewWorkbook(data);else readLegacyDiagram(data);}catch(e){toast('載入失敗：'+e.message);}});
  // Capture before legacy shortcuts; only consume keys handled here, so native text editing survives.
  window.addEventListener('keydown',e=>{if(e.isComposing||e.keyCode===229||window.WIUManualOpen||e.target.closest?.('#r111-find'))return;if(tourStep>=0&&e.key==='Escape'){closeTour();return;}if(currentView!=='assembly'&&!dialog.open)return;const mod=e.ctrlKey||e.metaKey,k=e.key.toLowerCase(),editing=/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);if((e.altKey&&e.target.closest?.('[data-top-drag]'))||(e.key.startsWith('Arrow')&&e.target.closest?.('[data-wire-route]')))return;e.stopImmediatePropagation();if(dialog.open)return;if(e.key==='Escape'&&graphStart){finishGraphConnection();refreshGraphConnection();return;}if(e.target.dataset.wireName&&e.key==='Escape'){e.preventDefault();cancelWireField(e.target);return;}if(e.key==='Enter'&&editing&&e.target.tagName!=='TEXTAREA'){e.preventDefault();if(e.target.dataset.wireName&&!applyWireField(e.target))return;e.target.blur();return;}if(mod&&k==='s'){e.preventDefault();document.activeElement?.blur();saveProject();}else if(mod&&k==='o'){e.preventDefault();pick('project');}else if(mod&&!editing&&(k==='z'||k==='y')){e.preventDefault();k==='y'||e.shiftKey?redo():undo();}},true);
  window.addEventListener('beforeunload',e=>{if(dirty()||practiceReturn&&JSON.stringify(practiceReturn.project)!==practiceReturn.saved){e.preventDefault();e.returnValue='';}});
  window.WIUWorkspaceUI={selectionContext:()=>{const o=graphObject;if(!o)return null;const i=o.kind==='instance'&&project.instances.find(i=>i.id===o.id),m=i&&project.modules.find(m=>m.name===i.module);return {...o,name:i?.name||o.id,moduleId:m?.id,moduleName:m?.name,count:graphNetFocus.size};},dispatch:(button,event)=>safe(()=>button.dataset.tab?go(button.dataset.tab):actions[button.dataset.action]?.(button,event)),context:()=>stageNav(),moduleContext:()=>diagramBar.hidden?'':diagramBar.innerHTML,zoom:setGraphZoom};
  window.__WIU_ASSEMBLY__={getProject:()=>A.clone(project),loadProject:p=>{graphNeedsPrepare=true;graphNetFocus.clear();graphDirectNetFocus.clear();graphGroupFocus.clear();graphObject=null;graphTableOrigin=null;graphPinHint='';graphStart='';graphConnectMode=false;graphQuickConnect=false;return commit(()=>{project=W.normalize(p);resetFilters();focusedPin='';lessonTask='';tab=L.isLearning(project)?'lesson':'connections';});},render,view,issues,getSession:()=>({kind:sessionKind,activeModule,workspace:workspace()}),openSheet,snapshot:workbookSnapshot,learningTasks:()=>L?.tasks(project)||[]};
  window.WIUBridge?.install();view('assembly');render();
})();
